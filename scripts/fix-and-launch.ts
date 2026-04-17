/**
 * scripts/fix-and-launch.ts
 * ─────────────────────────────────────────────────────────────
 * Script de Reparo Definitivo — Engenharia Crítica
 *
 * Fluxo completo em 5 passos atômicos:
 *   1. Selecionar RPC disponível
 *   2. Verificar saldo SOL da Treasury
 *   3. Garantir WSOL (wrap automático se necessário)
 *   4a. Criar OpenBook Market (BXP/WSOL)
 *   4b. Aguardar 30s de indexação e criar AMM Pool V4
 *   5. Confirmar existência da Pool on-chain antes de declarar sucesso
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

// ─── Constantes ──────────────────────────────────────────────────────────────
const RPC_URLS = [
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "https://rpc.ankr.com/solana_devnet",
];

const BXP_MINT         = new PublicKey(process.env.BXP_TOKEN_MINT!);
const AMM_PROGRAM      = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"); // Devnet Raydium AMM V4
const OPENBOOK_PROGRAM = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"); // Devnet OpenBook (correto p/ Raydium AMM V4)
const FEE_DEST         = new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"); // Devnet Raydium fee
const WSOL_NEEDED      = 1.5; // 1 SOL de liquidez + 0.5 SOL de folga para fees

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Funções utilitárias ──────────────────────────────────────────────────────

async function getBestConnection(): Promise<Connection> {
  for (const url of RPC_URLS) {
    try {
      const conn = new Connection(url, "confirmed");
      const slot = await conn.getSlot();
      console.log(`✅ RPC OK: ${url} (slot ${slot})`);
      return conn;
    } catch {
      console.warn(`⚠️  RPC falhou: ${url}`);
    }
  }
  throw new Error("Nenhum RPC disponível!");
}

async function ensureWsol(conn: Connection, owner: Keypair): Promise<void> {
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner.publicKey);

  let current = 0;
  let exists = false;

  try {
    const info = await getAccount(conn, ata, "confirmed", TOKEN_PROGRAM_ID);
    current = Number(info.amount) / LAMPORTS_PER_SOL;
    exists = true;
    console.log(`   💧 WSOL existente: ${current.toFixed(4)}`);
  } catch {
    console.log("   💧 WSOL ATA não encontrada. Será criada.");
  }

  if (current >= WSOL_NEEDED) {
    console.log(`   ✅ WSOL suficiente (${current.toFixed(4)} ≥ ${WSOL_NEEDED})`);
    return;
  }

  const delta = WSOL_NEEDED - current;
  const solBal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  if (solBal < delta + 0.2) throw new Error(`SOL insuficiente para wrap (precisa ${delta + 0.2} SOL livres, tem ${solBal})`);

  const tx = new Transaction();
  if (!exists) tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, ata, owner.publicKey, NATIVE_MINT));
  tx.add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: ata, lamports: Math.ceil(delta * LAMPORTS_PER_SOL) }));
  tx.add(createSyncNativeInstruction(ata));

  console.log(`   ↳ Embrulhando ${delta.toFixed(4)} SOL → WSOL...`);
  const sig = await sendAndConfirmTransaction(conn, tx, [owner], { commitment: "confirmed" });
  console.log(`   ✅ WRAP confirmado: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   fix-and-launch.ts  —  Engenharia Crítica           ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Validações
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente no .env.local");
  if (!process.env.BXP_TOKEN_MINT)       throw new Error("BXP_TOKEN_MINT ausente no .env.local");

  const owner = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  console.log(`🔑 Treasury: ${owner.publicKey.toBase58()}\n`);

  // ─── PASSO 1: RPC ─────────────────────────────────────────────────────────
  console.log("[ PASSO 1 ] Selecionando RPC...");
  const conn = await getBestConnection();

  // ─── PASSO 2: Saldo SOL ───────────────────────────────────────────────────
  console.log("\n[ PASSO 2 ] Verificando saldo SOL...");
  const solBal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  console.log(`   SOL: ${solBal.toFixed(4)}`);
  if (solBal < 5) throw new Error(`SOL insuficiente! Treasury: ${solBal} SOL. Mínimo necessário: 5 SOL.`);

  // ─── PASSO 3: WSOL ───────────────────────────────────────────────────────
  console.log("\n[ PASSO 3 ] Garantindo WSOL na Treasury...");
  await ensureWsol(conn, owner);

  // ─── PASSO 4: Raydium SDK ─────────────────────────────────────────────────
  console.log("\n[ PASSO 4 ] Carregando Raydium SDK...");
  const raydium = await Raydium.load({
    owner,
    connection: conn,
    cluster: "devnet",
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });
  console.log("   ✅ SDK carregado.");

  // ─── PASSO 4a: OpenBook Market ────────────────────────────────────────────
  console.log("\n[ PASSO 4a ] Criando OpenBook Market (BXP/WSOL)...");
  console.log("   ⚠️  Custo: ~2.8 SOL  |  Tempo: ~30s");

  const { execute: exMkt, extInfo: mktExt } = await raydium.marketV2.create({
    baseInfo:  { mint: BXP_MINT,   decimals: 6 },
    quoteInfo: { mint: NATIVE_MINT, decimals: 9 },
    lotSize:   1,
    tickSize:  0.000001,
    dexProgramId: OPENBOOK_PROGRAM,
    txVersion: TxVersion.LEGACY,
    computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
  });

  const { txId: mktTx } = await exMkt({ sequential: true });
  const marketId = mktExt.address.marketId;

  console.log(`   ✅ Market criado!`);
  console.log(`      Market ID : ${marketId.toBase58()}`);
  console.log(`      Tx        : https://explorer.solana.com/tx/${mktTx}?cluster=devnet`);

  // Delay crítico — deixa a RPC indexar as contas do Market
  console.log("\n[ AGUARDANDO ] 30s de indexação do Market na Devnet RPC...");
  for (let i = 30; i > 0; i -= 5) {
    await sleep(5_000);
    process.stdout.write(`   ${i}s restantes...  \r`);
  }
  console.log("\n   ✅ Delay concluído.");

  // ─── PASSO 4b: AMM Pool ───────────────────────────────────────────────────
  console.log("\n[ PASSO 4b ] Criando AMM Pool V4 (10M BXP + 1 WSOL)...");

  const BASE_AMOUNT  = new BN(10_000_000).mul(new BN(10).pow(new BN(6))); // 10_000_000.000000 BXP
  const QUOTE_AMOUNT = new BN(1).mul(new BN(10).pow(new BN(9)));           // 1.000000000 WSOL

  const poolResult = await raydium.liquidity.createPoolV4({
    programId: AMM_PROGRAM,
    marketInfo: { marketId, programId: OPENBOOK_PROGRAM },
    baseMintInfo:  { mint: BXP_MINT,    decimals: 6 },
    quoteMintInfo: { mint: NATIVE_MINT, decimals: 9 },
    baseAmount:  BASE_AMOUNT,
    quoteAmount: QUOTE_AMOUNT,
    startTime:   new BN(0),
    ownerInfo:   { feePayer: owner.publicKey, useSOLBalance: false },
    associatedOnly: false,
    feeDestinationId: FEE_DEST,
    txVersion: TxVersion.LEGACY,
    computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
  });

  console.log("   Enviando transação da Pool...");
  const { txId: poolTx } = await poolResult.execute({ sequential: true });
  const poolId = poolResult.extInfo.address.ammId;
  const lpMint = poolResult.extInfo.address.lpMint;

  // ─── PASSO 5: Verificação on-chain ────────────────────────────────────────
  console.log("\n[ PASSO 5 ] Verificando conta da Pool on-chain...");
  await sleep(7_000);
  const poolAccount = await conn.getAccountInfo(poolId);

  if (!poolAccount) {
    console.error(`\n❌ FALHA: Pool Tx enviada mas conta NÃO existe on-chain!`);
    console.error(`   Verifique a transação: https://explorer.solana.com/tx/${poolTx}?cluster=devnet`);
    console.error(`   Provável causa: saldo insuficiente ou race condition no RPC.`);
    process.exit(1);
  }

  // ─── Sucesso ──────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  🎉 FAIRLAUNCH CONCLUÍDO — POOL CONFIRMADA ON-CHAIN  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\n   Pool ID  : ${poolId.toBase58()}`);
  console.log(`   Market ID: ${marketId.toBase58()}`);
  console.log(`   LP Mint  : ${lpMint.toBase58()}`);
  console.log(`   Pool Tx  : https://explorer.solana.com/tx/${poolTx}?cluster=devnet`);
  console.log(`\n📣  COLE ESTAS LINHAS NO SEU .env.local:`);
  console.log(`RAYDIUM_MARKET_ID="${marketId.toBase58()}"`);
  console.log(`RAYDIUM_POOL_ID="${poolId.toBase58()}"`);
  console.log(`\nDepois rode: npx tsx scripts/simulate-traction.ts`);
}

main().catch((e) => {
  console.error("\n❌ ERRO FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
