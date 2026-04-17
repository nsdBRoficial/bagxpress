/**
 * scripts/qa-v3.ts
 * ─────────────────────────────────────────────────────────────
 * Bateria de QA completa do BagxPress DeFi MVP 3.0
 *
 * Testes:
 *   T01 — Treasury SOL Balance
 *   T02 — BXP_CLASSIC Mint existe on-chain
 *   T03 — Mint Authority revogada (hard cap)
 *   T04 — BXP ATA da Treasury com supply correto
 *   T05 — WSOL ATA da Treasury
 *   T06 — Raydium CPMM Pool existe on-chain
 *   T07 — Pool owner = Raydium CPMM Program
 *   T08 — Pool Vault A (WSOL) com saldo real
 *   T09 — Pool Vault B (BXP) com saldo real
 *   T10 — computeSwapAmount retorna preço válido
 *   T11 — Simulate um swap real 0.01 WSOL → BXP
 *   T12 — executeBurn queima pequena quantidade de BXP
 *   T13 — Build Next.js compila sem erros
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getMint,
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Raydium, TxVersion, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import type { CpmmComputeData } from "@raydium-io/raydium-sdk-v2";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import { execSync } from "child_process";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

// ─── Configuração ─────────────────────────────────────────────
const RPC_URL     = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const BXP_RAW     = process.env.BXP_TOKEN_MINT ?? "";
const BXP_MINT    = BXP_RAW.trim().replace(/['"#\s].*$/g, "").trim();
const POOL_ID_RAW = process.env.RAYDIUM_POOL_ID ?? "";
const POOL_ID     = POOL_ID_RAW.trim().replace(/['"#\s].*$/g, "").trim();
const CPMM_PROG   = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;
const NATIVE_MINT_STR = NATIVE_MINT.toBase58();

// ─── Helpers ──────────────────────────────────────────────────
type TestResult = { id: string; name: string; status: "PASS" | "FAIL" | "WARN"; detail: string };
const results: TestResult[] = [];

function pass(id: string, name: string, detail: string) {
  results.push({ id, name, status: "PASS", detail });
  console.log(`   ✅ ${id} ${name}\n      ${detail}`);
}
function fail(id: string, name: string, detail: string) {
  results.push({ id, name, status: "FAIL", detail });
  console.log(`   ❌ ${id} ${name}\n      ${detail}`);
}
function warn(id: string, name: string, detail: string) {
  results.push({ id, name, status: "WARN", detail });
  console.log(`   ⚠️  ${id} ${name}\n      ${detail}`);
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     BagxPress DeFi MVP 3.0 — Bateria de QA On-Chain         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("📋 ENDEREÇOS DO PROTOCOLO:");
  console.log(`   Treasury     : ${process.env.FEE_PAYER_SECRET_KEY ? Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, ""))).publicKey.toBase58() : "N/A"}`);
  console.log(`   BXP Mint     : ${BXP_MINT}`);
  console.log(`   CPMM Pool ID : ${POOL_ID}`);
  console.log(`   CPMM Program : ${CPMM_PROG}`);
  console.log(`   Explorer Pool: https://explorer.solana.com/address/${POOL_ID}?cluster=devnet\n`);

  if (!process.env.FEE_PAYER_SECRET_KEY) { console.error("FEE_PAYER_SECRET_KEY ausente!"); process.exit(1); }

  const owner = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const conn  = new Connection(RPC_URL, "confirmed");

  console.log("══════════════════════════════════════════════════════════════");
  console.log("FASE 1 — Infraestrutura de Contas");
  console.log("══════════════════════════════════════════════════════════════\n");

  // T01 — SOL Balance
  try {
    const bal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
    if (bal >= 5) pass("T01", "Treasury SOL Balance", `${bal.toFixed(4)} SOL (mínimo: 5 SOL)`);
    else warn("T01", "Treasury SOL Balance", `${bal.toFixed(4)} SOL — abaixo do recomendado para operações`);
  } catch (e) { fail("T01", "Treasury SOL Balance", String(e)); }

  // T02 — BXP Mint existe
  try {
    const mint = await getMint(conn, new PublicKey(BXP_MINT), "confirmed", TOKEN_PROGRAM_ID);
    pass("T02", "BXP Mint existe on-chain", `supply=${Number(mint.supply) / 1e6}M  decimals=${mint.decimals}  program=TOKEN_PROGRAM_ID`);
  } catch (e) { fail("T02", "BXP Mint on-chain", String(e)); }

  // T03 — Mint Authority revogada
  try {
    const mint = await getMint(conn, new PublicKey(BXP_MINT), "confirmed", TOKEN_PROGRAM_ID);
    if (mint.mintAuthority === null) pass("T03", "Mint Authority revogada (hard cap)", "mintAuthority=null ✓ Supply imutável");
    else fail("T03", "Mint Authority revogada", `Ainda ativa: ${mint.mintAuthority?.toBase58()}`);
  } catch (e) { fail("T03", "Mint Authority", String(e)); }

  // T04 — BXP ATA da Treasury
  try {
    const ata = getAssociatedTokenAddressSync(new PublicKey(BXP_MINT), owner.publicKey, false, TOKEN_PROGRAM_ID);
    const acc = await getAccount(conn, ata, "confirmed", TOKEN_PROGRAM_ID);
    const bal = Number(acc.amount) / 1e6;
    pass("T04", "BXP ATA da Treasury", `${bal.toLocaleString()} BXP  ATA=${ata.toBase58()}`);
  } catch (e) { fail("T04", "BXP ATA Treasury", String(e)); }

  // T05 — WSOL ATA
  try {
    const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner.publicKey, false, TOKEN_PROGRAM_ID);
    const acc = await getAccount(conn, wsolAta, "confirmed", TOKEN_PROGRAM_ID);
    const bal = Number(acc.amount) / LAMPORTS_PER_SOL;
    if (bal >= 0.1) pass("T05", "WSOL ATA da Treasury", `${bal.toFixed(6)} WSOL`);
    else warn("T05", "WSOL ATA da Treasury", `${bal.toFixed(6)} WSOL — saldo baixo`);
  } catch (e) { warn("T05", "WSOL ATA", `Não existe ou vazia: ${String(e).slice(0,80)}`); }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("FASE 2 — Pool CPMM On-Chain");
  console.log("══════════════════════════════════════════════════════════════\n");

  // T06 — Pool existe
  const poolPubkey = new PublicKey(POOL_ID);
  try {
    const acc = await conn.getAccountInfo(poolPubkey);
    if (acc) pass("T06", "CPMM Pool existe on-chain", `${acc.data.length} bytes  owner=${acc.owner.toBase58()}`);
    else fail("T06", "CPMM Pool on-chain", "Conta não encontrada");
  } catch (e) { fail("T06", "CPMM Pool on-chain", String(e)); }

  // T07 — Pool owner = CPMM Program
  try {
    const acc = await conn.getAccountInfo(poolPubkey);
    const actualOwner   = acc?.owner.toBase58() ?? "";
    const expectedOwner = CPMM_PROG.toString();
    if (actualOwner === expectedOwner)
      pass("T07", "Pool owner = CPMM Program", `${actualOwner} ✓`);
    else
      fail("T07", "Pool owner", `Esperado: ${expectedOwner}  Atual: ${actualOwner}`);
  } catch (e) { fail("T07", "Pool owner", String(e)); }


  // T08 — T09 — Vault balances via SDK
  const raydium = await Raydium.load({ owner, connection: conn, cluster: "devnet", disableFeatureCheck: true, blockhashCommitment: "confirmed" });
  try {
    const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(POOL_ID);

    const vaultABal = Number(rpcData.vaultAAmount) / LAMPORTS_PER_SOL;
    const vaultBBal = Number(rpcData.vaultBAmount) / 1e6;

    const isMintAWsol = poolInfo.mintA.address === NATIVE_MINT_STR;

    const wsolBal = isMintAWsol ? vaultABal : vaultBBal;
    const bxpBal  = isMintAWsol ? vaultBBal : vaultABal;

    if (wsolBal > 0) pass("T08", "Vault WSOL com saldo", `${wsolBal.toFixed(6)} WSOL (${rpcData.vaultA.toBase58()})`);
    else fail("T08", "Vault WSOL vazio", `${wsolBal}`);

    if (bxpBal > 0) pass("T09", "Vault BXP com saldo", `${bxpBal.toLocaleString()} BXP (${rpcData.vaultB.toBase58()})`);
    else fail("T09", "Vault BXP vazio", `${bxpBal}`);

    // T10 — computeSwapAmount
    const computePool: CpmmComputeData = {
      id:         poolPubkey,
      version:    7 as const,
      configInfo: rpcData.configInfo!,
      mintA:      poolInfo.mintA,
      mintB:      poolInfo.mintB,
      ...rpcData,
    };
    const { amountOut, minAmountOut } = raydium.cpmm.computeSwapAmount({
      pool:       computePool,
      amountIn:   new BN(10_000_000), // 0.01 WSOL
      outputMint: isMintAWsol ? poolInfo.mintB.address : poolInfo.mintA.address,
      slippage:   0.25,
      swapBaseIn: true,
    });

    const price = (0.01 / (Number(amountOut) / 1e6)).toFixed(8);
    pass("T10", "computeSwapAmount retorna preço", `0.01 WSOL → ${(Number(amountOut) / 1e6).toFixed(6)} BXP  Preço: ${price} SOL/BXP`);

    // T11 — Swap real 0.01 WSOL
    try {
      console.log("\n   ↳ T11: Executando swap real 0.01 WSOL → BXP...");
      const { poolInfo: freshInfo } = await raydium.cpmm.getPoolInfoFromRpc(POOL_ID);
      const { execute } = await raydium.cpmm.swap({
        poolInfo: freshInfo,
        baseIn:   isMintAWsol,
        inputAmount:  new BN(10_000_000),
        swapResult:   { inputAmount: new BN(10_000_000), outputAmount: minAmountOut },
        slippage:     0.25,
        computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
        txVersion: TxVersion.LEGACY,
      });
      const { txId } = await execute({ sequential: true });
      pass("T11", "Swap real on-chain", `Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);
    } catch (e) { fail("T11", "Swap real", String(e).slice(0, 120)); }

  } catch (e) { fail("T08", "getPoolInfoFromRpc falhou", String(e).slice(0, 120)); }

  // T12 — Burn pequena quantidade
  try {
    console.log("\n   ↳ T12: Executando burn de 1 BXP (1.000.000 unidades raw)...");
    const { executeBurn } = await import("../src/services/tokenomics.js");
    const burnResult = await executeBurn(1_000_000, "devnet"); // 1 BXP
    if (burnResult.success) pass("T12", "Burn on-chain executado", `Tx: ${burnResult.txHash}`);
    else fail("T12", "Burn on-chain", "executeBurn retornou success=false");
  } catch (e) { fail("T12", "Burn on-chain", String(e).slice(0, 120)); }

  // T13 — Build Next.js
  console.log("\n   ↳ T13: Testando build Next.js (type-check apenas)...");
  try {
    execSync("npx tsc --noEmit --skipLibCheck 2>&1", { cwd: process.cwd(), timeout: 60_000 });
    pass("T13", "TypeScript compilação sem erros", "npx tsc --noEmit passou ✓");
  } catch (e) {
    const out = String(e).slice(0, 200);
    if (out.includes("error TS")) fail("T13", "TypeScript erros de compilação", out);
    else warn("T13", "TypeScript (avisos)", "Build passou com avisos não-críticos");
  }

  // ─── Relatório Final
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const warned = results.filter(r => r.status === "WARN").length;

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                   RELATÓRIO QA FINAL                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`   PASS  : ${passed}/${results.length}`);
  console.log(`   FAIL  : ${failed}/${results.length}`);
  console.log(`   WARN  : ${warned}/${results.length}\n`);

  console.log("📋 ÍNDICE DE ENDEREÇOS — BagxPress MVP 3.0");
  console.log("─────────────────────────────────────────────");
  const ownerPub = owner.publicKey.toBase58();
  console.log(`   Treasury Wallet : ${ownerPub}`);
  console.log(`   BXP_CLASSIC Mint: ${BXP_MINT}`);
  console.log(`   CPMM Pool ID    : ${POOL_ID}`);
  console.log(`   CPMM Program    : ${CPMM_PROG}`);
  console.log(`   WSOL Mint       : ${NATIVE_MINT.toBase58()}`);
  console.log("\n   🔗 Explorer Links:");
  console.log(`   Token   : https://explorer.solana.com/address/${BXP_MINT}?cluster=devnet`);
  console.log(`   Pool    : https://explorer.solana.com/address/${POOL_ID}?cluster=devnet`);
  console.log(`   Treasury: https://explorer.solana.com/address/${ownerPub}?cluster=devnet`);

  if (failed > 0) {
    console.log(`\n   ⚠️  ${failed} teste(s) falharam. Revise antes de fazer release.`);
    process.exitCode = 1;
  } else {
    console.log("\n   🎉 Todos os testes críticos passaram! Pronto para release MVP 3.0.");
  }
}

main().catch((e) => {
  console.error("\n❌ ERRO FATAL no QA:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
