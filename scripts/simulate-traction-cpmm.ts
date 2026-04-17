/**
 * scripts/simulate-traction-cpmm.ts
 * ─────────────────────────────────────────────────────────────
 * Bot de Tração — CPMM Pool (SPL Token clássico + BXP_CLASSIC)
 *
 * API CPMM correta:
 *   getPoolInfoFromRpc(id) → { poolInfo, poolKeys, rpcData }
 *   computeSwapAmount({ pool: CpmmComputeData }) → { amountOut, minAmountOut }
 *   swap({ poolInfo, baseIn, inputAmount, swapResult: { inputAmount, outputAmount } })
 */

import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import type { CpmmComputeData } from "@raydium-io/raydium-sdk-v2";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

const RPC_URL     = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const POOL_ID_STR = process.env.RAYDIUM_POOL_ID?.trim().replace(/['"#\s].*$/g, "").trim();
const NATIVE_MINT = "So11111111111111111111111111111111111111112";

const TOTAL_SWAPS  = 90;
const SOL_PER_SWAP = 0.1;
const DELAY_MS     = 8_000;
const DELAY_ERR_MS = 12_000;
const SLIPPAGE     = 0.25; // 25% — pool pequena na Devnet

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  if (!POOL_ID_STR || POOL_ID_STR.length < 30) throw new Error(`RAYDIUM_POOL_ID inválido: "${POOL_ID_STR}"`);

  const owner  = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const conn   = new Connection(RPC_URL, "confirmed");
  const poolId = new PublicKey(POOL_ID_STR);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   simulate-traction-cpmm.ts  —  Bot de Tração       ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`🔑 Treasury : ${owner.publicKey.toBase58()}`);
  console.log(`🏊 Pool ID  : ${poolId.toBase58()}`);

  const raydium = await Raydium.load({
    owner,
    connection:          conn,
    cluster:             "devnet",
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });

  // Carga inicial para determinar direção do swap
  console.log("\n🔍 Carregando Pool Info inicial...");
  const { poolInfo: initPoolInfo, rpcData: initRpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());

  const wsolIsMintA = initPoolInfo.mintA.address === NATIVE_MINT;
  const baseIn      = wsolIsMintA; // true = input é mintA (WSOL)
  const outputMint  = wsolIsMintA ? initPoolInfo.mintB.address : initPoolInfo.mintA.address; // BXP

  console.log(`✅ Pool OK`);
  console.log(`   MintA: ${initPoolInfo.mintA.address} ${wsolIsMintA ? "(WSOL)" : "(BXP)"}`);
  console.log(`   MintB: ${initPoolInfo.mintB.address} ${wsolIsMintA ? "(BXP)" : "(WSOL)"}`);
  console.log(`   Reserves: ${initRpcData.vaultAAmount} / ${initRpcData.vaultBAmount}`);
  console.log(`   Direção: WSOL → BXP (baseIn=${baseIn})`);

  let successes = 0;
  let failures  = 0;

  console.log(`\n🤖 Iniciando ${TOTAL_SWAPS} swaps de ${SOL_PER_SWAP} WSOL cada...\n`);

  for (let i = 1; i <= TOTAL_SWAPS; i++) {
    const pct = ((i / TOTAL_SWAPS) * 100).toFixed(1);
    console.log(`━━━ SWAP ${i}/${TOTAL_SWAPS} (${pct}%) ━━━━━━━━━━━━━━━━━━━━`);

    try {
      // Recarrega estado fresco da pool (reserves mudam a cada swap)
      const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());

      // Monta CpmmComputeData: fusão de poolInfo + rpcData
      // rpcData já contém: baseReserve, quoteReserve, vaultAAmount, vaultBAmount, configInfo
      const computePool: CpmmComputeData = {
        id:         poolId,
        version:    7 as const,
        configInfo: rpcData.configInfo!,
        mintA:      poolInfo.mintA,
        mintB:      poolInfo.mintB,
        // Campos de CpmmParsedRpcData
        ...rpcData,
      };

      const inputAmount = new BN(Math.floor(SOL_PER_SWAP * 1e9)); // 0.1 SOL em lamports

      // computeSwapAmount retorna { amountOut, minAmountOut, fee, ... }
      const { amountOut, minAmountOut } = raydium.cpmm.computeSwapAmount({
        pool:       computePool,
        amountIn:   inputAmount,
        outputMint,
        slippage:   SLIPPAGE,
        swapBaseIn: true,
      });

      const bxpOut = (Number(amountOut) / 1e6).toFixed(4);
      console.log(`   💰 0.1 WSOL → ~${bxpOut} BXP (min: ${(Number(minAmountOut) / 1e6).toFixed(4)})`);

      const { execute } = await raydium.cpmm.swap({
        poolInfo,
        baseIn,
        inputAmount,
        swapResult: {
          inputAmount,
          outputAmount: minAmountOut, // usa minAmountOut para ser conservador
        },
        slippage:            SLIPPAGE,
        computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
        txVersion:           TxVersion.LEGACY,
      });

      const { txId } = await execute({ sequential: true });
      console.log(`   ✅ https://explorer.solana.com/tx/${txId}?cluster=devnet`);
      successes++;

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`   ❌ Swap ${i}: ${msg.slice(0, 150)}`);
      failures++;
      await sleep(DELAY_ERR_MS);
      continue;
    }

    if (i < TOTAL_SWAPS) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  🚀  BOT DE TRAÇÃO CONCLUÍDO                         ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`   Swaps OK  : ${successes}`);
  console.log(`   Falhas    : ${failures}`);
  console.log(`   Volume    : ~${(successes * SOL_PER_SWAP).toFixed(2)} SOL`);
  console.log(`   Pool      : https://explorer.solana.com/address/${poolId.toBase58()}?cluster=devnet`);
}

main().catch((e) => {
  console.error("\n❌ ERRO FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
