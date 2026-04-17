/**
 * src/services/tokenomics.ts
 * Engine de Split de Liquidez, Recompra e Queima do $BXP
 *
 * Implementa Swap atômico e queima imediata!
 */

import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { TOKEN_2022_PROGRAM_ID, createBurnInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import bs58 from "bs58";
import BN from "bn.js";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const BXP_MINT = process.env.BXP_TOKEN_MINT!;
const TARGET_POOL_ID = process.env.RAYDIUM_POOL_ID ?? null;
const NATIVE_MINT = "So11111111111111111111111111111111111111112";

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
    buybackFeeUsd: totalFeeUsd * 0.5,
  };
}

export async function treasuryDeposit(usdAmount: number, network: string): Promise<boolean> {
  console.log(`[Tokenomics] 🏦 Mantendo $${usdAmount.toFixed(4)} na Treasury... Rede: ${network}`);
  return true;
}

/**
 * Swap Real: Raydium (Principal) -> Jupiter (Fallback)
 */
export async function executeBuyback(usdAmount: number, network: string): Promise<{ success: boolean; bxpAmount: number; txHash: string | null; provider: string }> {
  console.log(`[Tokenomics] 💸 Iniciando buyback de $${usdAmount.toFixed(4)}...`);
  
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // Simulando conversão baseada num oracle estático pra Hackathon ($200 por SOL)
  const solAmount = usdAmount / 200;
  const amountInLamports = Math.floor(solAmount * 1e9);

  // Tentativa 1: RAYDIUM SDK DIRETO (Não há falha de indexação)
  if (TARGET_POOL_ID && TARGET_POOL_ID !== "COLOQUE_AQUI_O_POOL_ID") {
    try {
      console.log(`[Tokenomics] Roteando Buyback via Raydium SDK (Pool: ${TARGET_POOL_ID})`);
      const raydium = await Raydium.load({ owner, connection, cluster: "devnet", disableFeatureCheck: true, blockhashCommitment: "confirmed" });
      const poolInfo = await raydium.liquidity.getPoolInfoFromRpc({ poolId: TARGET_POOL_ID });

      const amountInParam = new BN(amountInLamports);
      const { amountOut } = raydium.liquidity.computeAmountOut({
        poolInfo,
        amountIn: amountInParam,
        mintIn: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        mintOut: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.quoteMint.address : poolInfo.baseMint.address,
        slippage: 0.1, // 10%
      });

      // 30% tolerância!
      const adjustedMinOut = new BN(amountOut.amount.raw).muln(70).divn(100); 

      const { execute } = await raydium.liquidity.swap({
        poolInfo,
        amountIn: amountInParam,
        amountOut: adjustedMinOut,
        fixedSide: 'in',
        inputMint: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        txVersion: TxVersion.V0,
        computeBudgetConfig: { units: 600000, microLamports: 100000 }
      });

      const { txId } = await execute({ sequential: true });
      return { success: true, bxpAmount: amountOut.amount.raw.toNumber(), txHash: txId, provider: "Raydium" };
    } catch (e: unknown) {
      console.warn(`[Tokenomics] Raydium falhou. Erro: ${e instanceof Error ? e.message : String(e)}. Tentando Jupiter Fallback...`);
    }
  }

  // Tentativa 2: JUPITER API FALLBACK
  try {
    console.log(`[Tokenomics] Roteando Buyback via Jupiter V6 Fallback API...`);
    const quoteRes = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${BXP_MINT}&amount=${amountInLamports}&slippageBps=1000`
    );
    if (!quoteRes.ok) throw new Error("Jupiter quote failed (pool pode não estar indexada)");
    const quote = await quoteRes.json();

    const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: owner.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });
    if (!swapRes.ok) throw new Error("Jupiter swap build failed");
    
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
 * Queima direta On-Chain usando o Padrão SPL Token-2022
 */
export async function executeBurn(bxpAmountRaw: number, network: string): Promise<{ success: boolean; txHash: string | null }> {
  if (bxpAmountRaw <= 0) return { success: false, txHash: null };

  console.log(`[Tokenomics] 🔥 Iniciando BURN atômico de ${bxpAmountRaw} unidades cruas de BXP...`);

  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  const connection = new Connection(SOLANA_RPC, "confirmed");

  try {
    const mintPubkey = new PublicKey(BXP_MINT);
    
    // Calcula ATA do dono
    const ata = await getAssociatedTokenAddress(
       mintPubkey,
       owner.publicKey,
       false,
       TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction().add(
      createBurnInstruction(
        ata,
        mintPubkey,
        owner.publicKey,
        BigInt(bxpAmountRaw),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txHash = await sendAndConfirmTransaction(connection, tx, [owner], { commitment: "confirmed" });
    console.log(`[Tokenomics] ✅ BXP QUEIMADO COM SUCESSO! Tx: ${txHash}`);
    return { success: true, txHash };
  } catch(e: unknown) {
    console.error(`[Tokenomics] Falha ao efetuar burn local:`, e instanceof Error ? e.message : String(e));
    return { success: false, txHash: null };
  }
}

export async function executeSweep(orderId: string, usdAmount: number, network: string): Promise<{
  feeInfo: FeeSplitResult,
  buybackTx: string | null,
  burnTx: string | null,
  bxpBurned: number,
  provider: string | null,
}> {
  console.log(`[Tokenomics] 🔄 Iniciando Sweep Action para a ORDEM ${orderId}`);
  
  const feeInfo = splitFee(usdAmount);
  
  // 1. Acumulo no balanço (Virtual)
  await treasuryDeposit(feeInfo.treasuryFeeUsd, network);
  
  // 2. Buyback Atômico (Sem travas) (WSOL -> BXP)
  const buybackResult = await executeBuyback(feeInfo.buybackFeeUsd, network);
  
  // 3. Burn Imediato
  let burnResult = { txHash: null, success: false };
  if (buybackResult.success) {
    burnResult = await executeBurn(buybackResult.bxpAmount, network);
  }

  return {
    feeInfo,
    buybackTx: buybackResult.txHash,
    burnTx: burnResult.txHash,
    bxpBurned: buybackResult.bxpAmount,
    provider: buybackResult.provider
  };
}
