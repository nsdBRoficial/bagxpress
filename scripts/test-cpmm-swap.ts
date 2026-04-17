/**
 * scripts/test-cpmm-swap.ts — Valida 1 swap real WSOL → BXP na CPMM Pool
 */
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import type { CpmmComputeData } from "@raydium-io/raydium-sdk-v2";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

const POOL_ID_STR = process.env.RAYDIUM_POOL_ID?.trim().replace(/['"#\s].*$/g, "").trim();
const NATIVE_MINT = "So11111111111111111111111111111111111111112";

async function main() {
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  if (!POOL_ID_STR || POOL_ID_STR.length < 30) throw new Error(`RAYDIUM_POOL_ID inválido: "${POOL_ID_STR}"`);

  const owner  = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const conn   = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const poolId = new PublicKey(POOL_ID_STR);

  console.log("🧪 TEST-CPMM-SWAP — 1 swap real\n");
  console.log(`   Pool: ${poolId.toBase58()}`);

  const raydium = await Raydium.load({ owner, connection: conn, cluster: "devnet", disableFeatureCheck: true, blockhashCommitment: "confirmed" });

  const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());
  console.log(`\n   MintA: ${poolInfo.mintA.address}`);
  console.log(`   MintB: ${poolInfo.mintB.address}`);
  console.log(`   vaultA: ${rpcData.vaultAAmount}  vaultB: ${rpcData.vaultBAmount}`);
  console.log(`   configInfo: ${rpcData.configInfo ? "OK" : "UNDEFINED ← problema!"}`);

  const wsolIsMintA = poolInfo.mintA.address === NATIVE_MINT;
  const baseIn      = wsolIsMintA;
  const outputMint  = wsolIsMintA ? poolInfo.mintB.address : poolInfo.mintA.address;

  // CpmmComputeData correto
  const poolCompute: CpmmComputeData = {
    id:         poolId,
    version:    7 as const,
    configInfo: rpcData.configInfo!,
    mintA:      poolInfo.mintA,
    mintB:      poolInfo.mintB,
    ...rpcData,
  };

  const inputAmount = new BN(100_000_000); // 0.1 SOL

  const { amountOut, minAmountOut, fee } = raydium.cpmm.computeSwapAmount({
    pool:       poolCompute,
    amountIn:   inputAmount,
    outputMint,
    slippage:   0.25,
    swapBaseIn: true,
  });

  console.log(`\n   amountOut   : ${(Number(amountOut) / 1e6).toFixed(6)} BXP`);
  console.log(`   minAmountOut: ${(Number(minAmountOut) / 1e6).toFixed(6)} BXP`);
  console.log(`   fee         : ${fee?.toString()} lamports`);

  const { execute } = await raydium.cpmm.swap({
    poolInfo,
    baseIn,
    inputAmount,
    swapResult: { inputAmount, outputAmount: minAmountOut },
    slippage:            0.25,
    computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
    txVersion:           TxVersion.LEGACY,
  });

  const { txId } = await execute({ sequential: true });
  console.log(`\n✅ SWAP OK!`);
  console.log(`   Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);
}

main().catch((e) => {
  console.error("\n❌ ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
