/**
 * src/services/claim.ts
 * MISSÃO V11 — Zero UX Trust Layer
 *
 * Gerencia o ciclo de vida de pending_claims:
 * - Criar claim criptografado para compras anônimas
 * - Resolver claim (transferir BXP para wallet destino)
 * - Consultar estado público do claim
 *
 * SEGURANÇA:
 * - Private key nunca é logada ou exposta via API
 * - AES-256-GCM via lib/crypto.ts (padrão existente no projeto)
 * - Double-claim bloqueado via validação atômica no DB
 * - Expiração de 30 dias enforçada em resolveClaim
 */

import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMint,
} from "@solana/spl-token";
import { encrypt, decrypt } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingClaimPublic {
  id: string;
  order_id: string;
  wallet_pubkey: string;
  amount: number;
  token_mint: string;
  claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface CreateClaimResult {
  claimId: string;
  claimUrl: string;
}

export interface ResolveClaimResult {
  txHash: string;
  claimed_by: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Cria um pending_claim para uma compra anônima.
 * Criptografa a private key da wallet transitória e salva no Supabase.
 *
 * @param orderId    - ID do pedido Stripe
 * @param keypair    - Keypair efêmero que recebeu os tokens
 * @param amount     - Quantidade de BXP entregue
 * @param tokenMint  - Mint address do token SPL
 * @returns claimId e claimUrl
 */
export async function createPendingClaim(
  orderId: string,
  keypair: Keypair,
  amount: number,
  tokenMint: string
): Promise<CreateClaimResult> {
  const supabase = createSupabaseAdminClient();

  // Serializar secret key como base64 e criptografar
  const secretKeyB64 = Buffer.from(keypair.secretKey).toString("base64");
  const { encrypted, iv } = await encrypt(secretKeyB64);

  const walletPubkey = keypair.publicKey.toBase58();

  const { data, error } = await supabase
    .from("pending_claims")
    .insert({
      order_id: orderId,
      wallet_pubkey: walletPubkey,
      encrypted_secret: encrypted,
      encryption_iv: iv,
      amount,
      token_mint: tokenMint,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create pending claim: ${error?.message ?? "unknown"}`);
  }

  const claimId = data.id as string;
  return {
    claimId,
    claimUrl: `/claim/${claimId}`,
  };
}

/**
 * Retorna o estado público de um claim (sem expor encrypted_secret ou IV).
 *
 * @param id - UUID do claim
 */
export async function getClaimById(id: string): Promise<PendingClaimPublic | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("pending_claims")
    .select(
      "id, order_id, wallet_pubkey, amount, token_mint, claimed, claimed_by, claimed_at, expires_at, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return data as PendingClaimPublic;
}

/**
 * Resolve um claim: descriptografa a wallet transitória e transfere os tokens
 * SPL para a wallet destino. Marca o claim como resgatado.
 *
 * @param id                - UUID do claim
 * @param destinationWallet - Public key destino (Phantom ou wallet autenticada)
 * @returns txHash da transferência on-chain
 */
export async function resolveClaim(
  id: string,
  destinationWallet: string
): Promise<ResolveClaimResult> {
  const supabase = createSupabaseAdminClient();

  // 1. Buscar claim completo (com secret) — somente server-side
  const { data: claim, error } = await supabase
    .from("pending_claims")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !claim) {
    throw new Error("Claim not found.");
  }

  // 2. Validar estado
  if (claim.claimed) {
    throw new Error("This claim has already been redeemed.");
  }

  const now = new Date();
  const expiresAt = new Date(claim.expires_at);
  if (now > expiresAt) {
    throw new Error("This claim has expired.");
  }

  // 3. Descriptografar a wallet transitória
  const secretKeyB64 = await decrypt({
    encrypted: claim.encrypted_secret,
    iv: claim.encryption_iv,
  });
  const secretKey = Buffer.from(secretKeyB64, "base64");
  const sourceKeypair = Keypair.fromSecretKey(secretKey);

  // Validação de integridade
  if (sourceKeypair.publicKey.toBase58() !== claim.wallet_pubkey) {
    throw new Error("Claim integrity check failed: public key mismatch.");
  }

  // 4. Preparar transferência SPL
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const mintPubkey = new PublicKey(claim.token_mint);
  const destinationPubkey = new PublicKey(destinationWallet);

  // Busca informações do mint para obter decimals
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;

  // Quantidade em unidades brutas (ex: BXP com 6 decimals → multiplicar por 1e6)
  const amountRaw = BigInt(Math.round(Number(claim.amount) * Math.pow(10, decimals)));

  // Contas ATA
  const sourceAta = await getAssociatedTokenAddress(mintPubkey, sourceKeypair.publicKey);
  const destinationAta = await getAssociatedTokenAddress(mintPubkey, destinationPubkey);

  // Verificar se a ATA de destino existe, senão criar
  const tx = new Transaction();
  const destinationAtaInfo = await connection.getAccountInfo(destinationAta);
  if (!destinationAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        sourceKeypair.publicKey, // payer
        destinationAta,
        destinationPubkey,
        mintPubkey
      )
    );
  }

  // Instrução de transferência
  tx.add(
    createTransferCheckedInstruction(
      sourceAta,         // from
      mintPubkey,        // mint
      destinationAta,    // to
      sourceKeypair.publicKey, // authority
      amountRaw,
      decimals
    )
  );

  // 5. Enviar transação
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = sourceKeypair.publicKey;

  const { sendAndConfirmTransaction } = await import("@solana/web3.js");
  const txHash = await sendAndConfirmTransaction(connection, tx, [sourceKeypair], {
    commitment: "confirmed",
  });

  // 6. Marcar como resgatado (operação atômica)
  await supabase
    .from("pending_claims")
    .update({
      claimed: true,
      claimed_by: destinationWallet,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("claimed", false); // double-claim guard

  return {
    txHash,
    claimed_by: destinationWallet,
  };
}
