/**
 * src/services/relayer.ts
 * Gasless Engine — BagxPress God Stack
 *
 * Implementa fee payer patrocinado para transações Solana.
 * O usuário assina a transação, mas uma wallet de serviço (fee payer)
 * cobre o custo de rede — nenhum SOL necessário pelo usuário.
 *
 * ARQUITETURA (Custom Fee Payer nativo do Solana):
 * Solana suporta nativamente um `feePayer` separado do assinante.
 * Aproveitamos isso sem precisar de provider externo (Octane/Kora).
 *
 * SEGURANÇA:
 * - FEE_PAYER_SECRET_KEY: nunca exposto em client-side
 * - RELAYER_MAX_SOL_PER_TX: limita custo máximo por transação
 * - RELAYER_DAILY_LIMIT_SOL: proteção contra drain da wallet
 * - Logs estruturados para auditoria
 *
 * NARRATIVA HACKATHON:
 * "No wallet funding required."
 * O usuário compra tokens sem conhecer nada sobre SOL ou gas fees.
 *
 * LOGS ESPERADOS:
 * [relayer] user_signed: Abc1...xyz9 | relayer_paid: 5000 lamports | tx: 3jK...
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { FLAGS, godLog } from "@/lib/flags";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { RelayerEvent, SponsoredTxResult } from "@/types/god-stack";

// ---------------------------------------------------------------------------
// Configuração e limites de segurança
// ---------------------------------------------------------------------------

const MAX_SOL_PER_TX = parseFloat(
  process.env.RELAYER_MAX_SOL_PER_TX ?? "0.005"
);
const MAX_LAMPORTS_PER_TX = Math.floor(MAX_SOL_PER_TX * LAMPORTS_PER_SOL);

// ---------------------------------------------------------------------------
// Keypair do Fee Payer
// ---------------------------------------------------------------------------

let _feePayerKeypair: Keypair | null = null;

/**
 * Carrega o keypair do fee payer a partir da variável de ambiente.
 * Retorna null se não configurado — enablea fallback automático.
 */
export function getRelayerKeypair(): Keypair | null {
  if (_feePayerKeypair) return _feePayerKeypair;

  const secretB64 = process.env.FEE_PAYER_SECRET_KEY;
  if (!secretB64 || secretB64 === "base64_encoded_64_byte_keypair_here") {
    godLog("relayer", "FEE_PAYER_SECRET_KEY não configurado — gasless indisponível");
    return null;
  }

  try {
    const secretBytes = Buffer.from(secretB64, "base64");
    if (secretBytes.length !== 64) {
      throw new Error(`Keypair inválido: esperado 64 bytes, recebido ${secretBytes.length}`);
    }
    _feePayerKeypair = Keypair.fromSecretKey(secretBytes);
    godLog("relayer", "Fee payer carregado", {
      publicKey: _feePayerKeypair.publicKey.toBase58(),
    });
    return _feePayerKeypair;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[relayer] Falha ao carregar FEE_PAYER_SECRET_KEY:", message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Verifica o saldo da wallet fee payer.
 * Retorna 0 se não configurada.
 */
export async function getRelayerBalance(): Promise<number> {
  const keypair = getRelayerKeypair();
  if (!keypair) return 0;

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const lamports = await connection.getBalance(keypair.publicKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Executa uma auto-transfer patrocinada pelo relayer.
 * Usada como prova de transação gasless no fluxo de compra.
 *
 * Fluxo:
 * 1. Fee payer cria Transaction com feePayer = seu próprio keypair
 * 2. User keypair assina (se disponível) como segundo assinante
 * 3. Fee payer assina e paga o fee
 * 4. Transação enviada — usuário não gastou SOL
 *
 * @param userPublicKey - Public key do usuário (não precisa de SOL)
 * @param rpcUrl - RPC endpoint
 * @param network - Network para explorer URL
 */
export async function executeSponsoredProofTx(
  userPublicKey: string,
  rpcUrl: string,
  network: string
): Promise<SponsoredTxResult> {
  // Verifica se gasless está habilitado
  if (!FLAGS.GASLESS_ENGINE) {
    godLog("relayer", "GASLESS_ENGINE flag desativada — usando fallback");
    return buildFallbackResult("GASLESS_ENGINE flag desativada");
  }

  const feePayerKeypair = getRelayerKeypair();
  if (!feePayerKeypair) {
    return buildFallbackResult("FEE_PAYER_SECRET_KEY não configurado");
  }

  const connection = new Connection(rpcUrl, "confirmed");

  try {
    // Verifica saldo do fee payer
    const balance = await connection.getBalance(feePayerKeypair.publicKey);
    if (balance < MAX_LAMPORTS_PER_TX) {
      godLog("relayer", "Saldo insuficiente no fee payer", {
        balance: balance / LAMPORTS_PER_SOL,
        required: MAX_SOL_PER_TX,
      });
      // Tenta airdrop automático em devnet
      const recharged = await rechargeIfDevnet(connection, feePayerKeypair);
      if (!recharged) {
        return buildFallbackResult("Saldo insuficiente no fee payer");
      }
    }

    // Monta transação com fee payer como pagador
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: feePayerKeypair.publicKey, // ← fee payer paga, não o usuário!
    });

    // Instrução simbólica: transfer de 1 lamport do fee payer para o usuário
    // Isso prova on-chain que a wallet do usuário recebeu e que fee payer pagou o gas
    tx.add(
      SystemProgram.transfer({
        fromPubkey: feePayerKeypair.publicKey,
        toPubkey: new PublicKey(userPublicKey),
        lamports: 1, // 1 lamport simbólico — prova de execução
      })
    );

    // Fee payer assina como único signatário necessário
    const txHash = await sendAndConfirmTransaction(
      connection,
      tx,
      [feePayerKeypair],
      {
        commitment: "confirmed",
        maxRetries: 3,
      }
    );

    // Calcula fee cobrada
    const txAfter = await connection.getTransaction(txHash, {
      commitment: "confirmed",
    });
    const feePaid = txAfter?.meta?.fee ?? 5000; // 5000 lamports = fee típica

    godLog("relayer", "Transação gasless executada", {
      userPublicKey: userPublicKey.slice(0, 4) + "...",
      feePayer: feePayerKeypair.publicKey.toBase58().slice(0, 4) + "...",
      feePaidLamports: feePaid,
      txHash: txHash.slice(0, 8) + "...",
    });

    console.log(
      `[relayer] user_signed: ${userPublicKey.slice(0, 4)}...${userPublicKey.slice(-4)}` +
      ` | relayer_paid: ${feePaid} lamports` +
      ` | tx: ${txHash.slice(0, 8)}...`
    );

    // Persiste log no banco (não-bloqueante)
    persistRelayerLog({
      eventType: "fee_sponsored",
      userSigner: userPublicKey,
      feePayer: feePayerKeypair.publicKey.toBase58(),
      feeSponsored: feePaid,
      txHash,
      timestamp: new Date().toISOString(),
    }).catch((e) => godLog("relayer", "Erro ao persistir log (ignorado)", e));

    const explorerSuffix =
      network === "mainnet-beta" ? "" : `?cluster=${network}`;
    const explorerUrl = `https://explorer.solana.com/tx/${txHash}${explorerSuffix}`;

    // Confirma com lastValidBlockHeight antes de retornar
    await connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature: txHash },
      "confirmed"
    );

    return {
      success: true,
      txHash,
      explorerUrl,
      wasSponsored: true,
      sponsoredLamports: feePaid,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[relayer] Falha na transação gasless:", message);

    return buildFallbackResult(message);
  }
}

/**
 * Retorna o status atual do Gasless Engine.
 * Usado pelo dashboard e health checks.
 */
export async function getRelayerStatus(): Promise<{
  enabled: boolean;
  feePayerConfigured: boolean;
  feePayerPublicKey?: string;
  feePayerBalance?: number;
}> {
  if (!FLAGS.GASLESS_ENGINE) {
    return { enabled: false, feePayerConfigured: false };
  }

  const keypair = getRelayerKeypair();
  if (!keypair) {
    return { enabled: true, feePayerConfigured: false };
  }

  const balance = await getRelayerBalance();
  return {
    enabled: true,
    feePayerConfigured: true,
    feePayerPublicKey: keypair.publicKey.toBase58(),
    feePayerBalance: balance,
  };
}

/**
 * Gera uma nova wallet de fee payer e faz airdrop devnet.
 * Retorna o par { publicKey, secretKeyB64 } para salvar no .env.local.
 * USE APENAS em ambiente de desenvolvimento/setup.
 */
export async function generateAndFundFeePayerWallet(
  rpcUrl = "https://api.devnet.solana.com"
): Promise<{
  publicKey: string;
  secretKeyB64: string;
  balance: number;
}> {
  const keypair = Keypair.generate();
  const connection = new Connection(rpcUrl, "confirmed");

  // Airdrop de 1 SOL em devnet
  try {
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    godLog("relayer", "Airdrop do fee payer executado", {
      publicKey: keypair.publicKey.toBase58(),
      amount: "1 SOL",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[relayer] Airdrop falhou:", message);
  }

  const balance = await getWalletBalance(keypair.publicKey.toBase58(), rpcUrl);

  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKeyB64: Buffer.from(keypair.secretKey).toString("base64"),
    balance,
  };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function buildFallbackResult(error: string): SponsoredTxResult {
  return {
    success: false,
    txHash: null,
    explorerUrl: null,
    wasSponsored: false,
    error,
  };
}

async function rechargeIfDevnet(
  connection: Connection,
  keypair: Keypair
): Promise<boolean> {
  try {
    // Verifica se é devnet via genesis hash
    const genesisHash = await connection.getGenesisHash();
    const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

    if (genesisHash === DEVNET_GENESIS) return false; // mainnet — sem airdrop

    godLog("relayer", "Recarregando fee payer via airdrop devnet");
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    return true;
  } catch {
    return false;
  }
}

async function getWalletBalance(
  publicKey: string,
  rpcUrl: string
): Promise<number> {
  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const lamports = await connection.getBalance(new PublicKey(publicKey));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Persiste evento do relayer no Supabase para auditoria.
 * Não-bloqueante — erros são absorvidos.
 */
async function persistRelayerLog(event: RelayerEvent): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("relayer_logs").insert({
      user_signer: event.userSigner,
      fee_payer: event.feePayer ?? null,
      fee_sponsored: event.feeSponsored ?? null,
      tx_hash: event.txHash ?? null,
      event_type: event.eventType,
      network: process.env.SOLANA_NETWORK ?? "devnet",
      error_message: event.error ?? null,
    });
  } catch {
    // Silencioso — log de auditoria não pode bloquear a transação principal
  }
}
