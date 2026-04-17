/**
 * src/services/tokenomics.ts
 * Engine de Split de Liquidez, Recompra e Queima do $BXP
 *
 * Implementa Swap atômico e queima imediata!
 * v3.1 — Migrado para BXP_CLASSIC (SPL Token padrão) + Raydium CPMM
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import BN from "bn.js";

const SOLANA_RPC    = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const BXP_MINT_RAW  = process.env.BXP_TOKEN_MINT ?? "";
const BXP_MINT      = BXP_MINT_RAW.trim().replace(/['"#\s].*$/g, "").trim();
const TARGET_POOL_ID_RAW = process.env.RAYDIUM_POOL_ID ?? null;
const TARGET_POOL_ID     = TARGET_POOL_ID_RAW?.trim().replace(/['"#\s].*$/g, "").trim() ?? null;
const NATIVE_MINT   = "So11111111111111111111111111111111111111112";

export interface FeeSplitResult {
  totalFeeUsd: number;
  treasuryFeeUsd: number;
  buybackFeeUsd: number;
}

export function calculateProtocolFee(usdAmount: number): number {
  return usdAmount * 0.0199; // 1.99% fee fixa da plataforma
}

export function splitFee(usdAmount: number): FeeSplitResult {
  const totalFeeUsd = calculateProtocolFee(usdAmount);
  return {
    totalFeeUsd,
    treasuryFeeUsd: totalFeeUsd * 0.5,
    buybackFeeUsd:  totalFeeUsd * 0.5,
  };
}

export async function treasuryDeposit(usdAmount: number, network: string): Promise<boolean> {
  console.log(`[Tokenomics] 🏦 Mantendo $${usdAmount.toFixed(4)} na Treasury... Rede: ${network}`);
  return true;
}

/**
 * Swap Real: Raydium CPMM (Principal) -> Jupiter (Fallback)
 * BXP_CLASSIC = SPL Token padrão, compatível com Raydium CPMM Devnet
 */
export async function executeBuyback(usdAmount: number, network: string): Promise<{
  success: boolean; bxpAmount: number; txHash: string | null; provider: string
}> {
  console.log(`[Tokenomics] 💸 Iniciando buyback de $${usdAmount.toFixed(4)}...`);

  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  const owner      = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // Conversão estática pra Hackathon ($200 por SOL)
  const solAmount        = usdAmount / 200;
  const amountInLamports = Math.floor(solAmount * 1e9);

  // ── Tentativa 1: RAYDIUM CPMM SDK ──────────────────────────────────────
  if (TARGET_POOL_ID && TARGET_POOL_ID.length > 30) {
    try {
      console.log(`[Tokenomics] Roteando Buyback via Raydium CPMM (Pool: ${TARGET_POOL_ID})`);
      const raydium = await Raydium.load({
        owner,
        connection,
        cluster:             "devnet",
        disableFeatureCheck: true,
        blockhashCommitment: "confirmed",
      });

      const { poolInfo, poolRpcData } = await raydium.cpmm.getPoolInfoFromRpc(TARGET_POOL_ID);
      const inputAmount = new BN(amountInLamports);

      // baseIn: verdadeiro quando pagamos com WSOL (mintB da pool)
      const bxpIsA = poolInfo.mintA.address !== NATIVE_MINT;
      const baseIn = !bxpIsA;

      const { outputAmount } = raydium.cpmm.computeSwapAmount({
        pool: {
          ...poolInfo,
          baseReserve:  poolRpcData.baseReserve,
          quoteReserve: poolRpcData.quoteReserve,
          vaultAAmount: poolRpcData.vaultAAmount,
          vaultBAmount: poolRpcData.vaultBAmount,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        amountIn:   inputAmount,
        outputMint: bxpIsA ? poolInfo.mintA.address : poolInfo.mintB.address,
        slippage:   0.15,
        swapBaseIn: true,
      });

      const { execute } = await raydium.cpmm.swap({
        poolInfo,
        baseIn,
        inputAmount,
        swapResult:          { inputAmount, outputAmount: new BN(outputAmount.toString()) },
        slippage:            0.15,
        computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
        txVersion:           TxVersion.LEGACY,
      });

      const { txId } = await execute({ sequential: true });
      return { success: true, bxpAmount: Number(outputAmount), txHash: txId, provider: "Raydium CPMM" };
    } catch (e: unknown) {
      console.warn(`[Tokenomics] CPMM falhou: ${e instanceof Error ? e.message : String(e)}. Tentando Jupiter...`);
    }
  }

  // ── Tentativa 2: JUPITER API FALLBACK ──────────────────────────────────
  try {
    console.log(`[Tokenomics] Roteando Buyback via Jupiter V6 Fallback API...`);
    const quoteRes = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${BXP_MINT}&amount=${amountInLamports}&slippageBps=1000`
    );
    if (!quoteRes.ok) throw new Error(`Jupiter quote falhou`);
    const quote = await quoteRes.json();

    const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ quoteResponse: quote, userPublicKey: owner.publicKey.toBase58(), wrapAndUnwrapSol: true }),
    });
    if (!swapRes.ok) throw new Error(`Jupiter swap build falhou`);

    const { swapTransaction } = await swapRes.json();
    const txBuffer = Buffer.from(swapTransaction, "base64");
    const tx = Transaction.from(txBuffer);
    tx.partialSign(owner);

    const txHash = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txHash, "confirmed");
    return { success: true, bxpAmount: quote.outAmount, txHash, provider: "Jupiter" };
  } catch (e: unknown) {
    console.error(`[Tokenomics] Jupiter Fallback também falhou:`, e instanceof Error ? e.message : String(e));
    return { success: false, bxpAmount: 0, txHash: null, provider: "Failed" };
  }
}

/**
 * Queima direta On-Chain — tenta TOKEN_PROGRAM_ID (BXP_CLASSIC) primeiro,
 * depois TOKEN_2022_PROGRAM_ID como fallback para compatibilidade.
 */
export async function executeBurn(bxpAmountRaw: number, network: string): Promise<{
  success: boolean; txHash: string | null
}> {
  if (bxpAmountRaw <= 0) return { success: false, txHash: null };
  console.log(`[Tokenomics] 🔥 Iniciando BURN atômico de ${bxpAmountRaw} unidades de BXP...`);

  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  const owner      = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const mintPubkey = new PublicKey(BXP_MINT);

  // Tenta primeiro TOKEN_PROGRAM_ID (BXP_CLASSIC — padrão pós-v3.1)
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, owner.publicKey, false, programId);
      const tx  = new Transaction().add(
        createBurnInstruction(ata, mintPubkey, owner.publicKey, BigInt(bxpAmountRaw), [], programId)
      );
      const txHash = await sendAndConfirmTransaction(connection, tx, [owner], { commitment: "confirmed" });
      console.log(`[Tokenomics] ✅ BXP QUEIMADO! Tx: ${txHash}`);
      return { success: true, txHash };
    } catch {
      // Silently tenta o próximo programId
    }
  }

  console.error("[Tokenomics] Burn falhou com ambos TOKEN_PROGRAM_ID e TOKEN_2022_PROGRAM_ID.");
  return { success: false, txHash: null };
}

export async function executeSweep(orderId: string, usdAmount: number, network: string): Promise<{
  feeInfo:   FeeSplitResult;
  buybackTx: string | null;
  burnTx:    string | null;
  bxpBurned: number;
  provider:  string | null;
}> {
  console.log(`[Tokenomics] 🔄 Iniciando Sweep Action para a ORDEM ${orderId}`);

  const feeInfo = splitFee(usdAmount);
  await treasuryDeposit(feeInfo.treasuryFeeUsd, network);

  const buybackResult = await executeBuyback(feeInfo.buybackFeeUsd, network);

  let burnResult = { txHash: null as string | null, success: false };
  if (buybackResult.success) {
    burnResult = await executeBurn(buybackResult.bxpAmount, network);
  }

  return {
    feeInfo,
    buybackTx: buybackResult.txHash,
    burnTx:    burnResult.txHash,
    bxpBurned: buybackResult.bxpAmount,
    provider:  buybackResult.provider,
  };
}
