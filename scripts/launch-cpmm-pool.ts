/**
 * scripts/launch-cpmm-pool.ts
 * ─────────────────────────────────────────────────────────────
 * Cria Pool CPMM (Raydium Devnet) com o token BXP_CLASSIC (SPL padrão)
 * Usa 10M BXP + 1.5 WSOL da Treasury como liquidez inicial.
 *
 * Pré-requisitos:
 *   - BXP_TOKEN_MINT no .env.local já é o SPL clássico (após create-classic-bxp.ts)
 *   - Treasury tem ≥ 1.5 WSOL na ATA
 *   - Treasury tem 10M BXP na ATA
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
import {
  Raydium,
  TxVersion,
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
  CpmmConfigInfoLayout,
} from "@raydium-io/raydium-sdk-v2";
import type { ApiCpmmConfigInfo } from "@raydium-io/raydium-sdk-v2";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import * as fs from "fs";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

// ─── Constantes ───────────────────────────────────────────────────────────────
const RPC_URL       = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const CPMM_PROGRAM  = new PublicKey(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM);
const CPMM_FEE_ACC  = new PublicKey(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC);
const BXP_MINT_ADDR = process.env.BXP_TOKEN_MINT!;
const WSOL_NEEDED   = 1.05; // 1 SOL de liquidez + 0.05 de folga

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Garantir WSOL ────────────────────────────────────────────────────────────
async function ensureWsol(conn: Connection, owner: Keypair): Promise<void> {
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner.publicKey, false, TOKEN_PROGRAM_ID);
  let current = 0;
  let exists  = false;

  try {
    const info = await getAccount(conn, ata, "confirmed", TOKEN_PROGRAM_ID);
    current = Number(info.amount) / LAMPORTS_PER_SOL;
    exists  = true;
    console.log(`   💧 WSOL na ATA: ${current.toFixed(6)}`);
  } catch {
    console.log("   💧 WSOL ATA não existe. Será criada.");
  }

  if (current >= WSOL_NEEDED) {
    console.log(`   ✅ WSOL suficiente (${current.toFixed(4)} SOL)`);
    return;
  }

  const delta  = WSOL_NEEDED - current;
  const solBal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  if (solBal < delta + 0.05) throw new Error(`SOL insuficiente para wrap! Tem ${solBal.toFixed(4)}, precisa ${(delta + 0.05).toFixed(4)}`);

  const tx = new Transaction();
  if (!exists) tx.add(createAssociatedTokenAccountInstruction(owner.publicKey, ata, owner.publicKey, NATIVE_MINT, TOKEN_PROGRAM_ID));
  tx.add(SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: ata, lamports: Math.ceil(delta * LAMPORTS_PER_SOL) }));
  tx.add(createSyncNativeInstruction(ata, TOKEN_PROGRAM_ID));

  console.log(`   ↳ Embrulhando ${delta.toFixed(4)} SOL → WSOL...`);
  const sig = await sendAndConfirmTransaction(conn, tx, [owner], { commitment: "confirmed" });
  console.log(`   ✅ WRAP: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

// ─── Config CPMM real on-chain ────────────────────────────────────────────────
async function getCpmmConfig(conn: Connection): Promise<ApiCpmmConfigInfo> {
  console.log("   Derivando CPMM config on-chain...");
  for (let idx = 0; idx < 6; idx++) {
    const { publicKey: pda } = getCpmmPdaAmmConfigId(CPMM_PROGRAM, idx);
    const info = await conn.getAccountInfo(pda);
    if (!info) continue;

    const d = CpmmConfigInfoLayout.decode(info.data);
    const cfg: ApiCpmmConfigInfo = {
      id:              pda.toBase58(),
      index:           idx,
      protocolFeeRate: d.protocolFeeRate.toNumber(),
      tradeFeeRate:    d.tradeFeeRate.toNumber(),
      fundFeeRate:     d.fundFeeRate.toNumber(),
      createPoolFee:   d.createPoolFee.toString(),
      creatorFeeRate:  d.creatorFeeRate?.toNumber?.() ?? 0,
    };

    console.log(`   ✅ Config[${idx}]: ${pda.toBase58()}`);
    console.log(`      tradeFee=${cfg.tradeFeeRate / 10000}%  createFee=${(Number(cfg.createPoolFee) / 1e9).toFixed(4)} SOL`);
    return cfg;
  }
  throw new Error("Nenhum CPMM config encontrado on-chain!");
}

// ─── Atualizar .env.local ────────────────────────────────────────────────────
function updateEnvLocal(key: string, value: string): void {
  const path = ".env.local";
  let c = fs.readFileSync(path, "utf8");
  const r = new RegExp(`^${key}=.*$`, "m");
  if (r.test(c)) { c = c.replace(r, `${key}=${value}`); }
  else            { c += `\n${key}=${value}`; }
  fs.writeFileSync(path, c, "utf8");
  console.log(`   ✅ .env.local → ${key}=${value}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   launch-cpmm-pool.ts  —  Raydium CPMM + SPL Classic ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente");
  if (!BXP_MINT_ADDR)                   throw new Error("BXP_TOKEN_MINT ausente no .env.local");

  const owner   = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const bxpMint = new PublicKey(BXP_MINT_ADDR.trim().replace(/['"#].*$/g, "").trim());
  const conn    = new Connection(RPC_URL, "confirmed");

  console.log(`🔑 Treasury  : ${owner.publicKey.toBase58()}`);
  console.log(`📦 BXP Mint  : ${bxpMint.toBase58()} [SPL Clássico]`);
  console.log(`🏊 CPMM Prog : ${CPMM_PROGRAM.toBase58()}\n`);

  // ── 1. SOL Balance
  const solBal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  console.log(`[ 1/5 ] SOL: ${solBal.toFixed(4)}`);
  if (solBal < 1) throw new Error("SOL insuficiente!");

  // ── 2. Garantir WSOL
  console.log("\n[ 2/5 ] Garantindo WSOL...");
  await ensureWsol(conn, owner);

  // ── 3. Verificar BXP ATA (SPL clássico)
  console.log("\n[ 3/5 ] Verificando BXP ATA (SPL clássico)...");
  const bxpAta  = getAssociatedTokenAddressSync(bxpMint, owner.publicKey, false, TOKEN_PROGRAM_ID);
  const bxpInfo = await getAccount(conn, bxpAta, "confirmed", TOKEN_PROGRAM_ID);
  const bxpBal  = Number(bxpInfo.amount) / 1e6;
  console.log(`   ATA    : ${bxpAta.toBase58()}`);
  console.log(`   Saldo  : ${bxpBal.toLocaleString()} BXP`);
  if (bxpBal < 1) throw new Error("BXP ATA vazia! Execute create-classic-bxp.ts primeiro.");

  // ── 4. Carregar SDK + Config CPMM
  console.log("\n[ 4/5 ] Carregando Raydium SDK + CPMM Config...");
  const raydium   = await Raydium.load({ owner, connection: conn, cluster: "devnet", disableFeatureCheck: true, blockhashCommitment: "confirmed" });
  const feeConfig = await getCpmmConfig(conn);

  // ── 5. Criar CPMM Pool
  console.log("\n[ 5/5 ] Criando CPMM Pool BXP/WSOL...");

  // Quantidades: todo o supply de BXP + 1 SOL
  const BXP_AMOUNT_RAW = new BN(bxpBal.toString()).mul(new BN(10 ** 6));
  const WSOL_AMOUNT    = new BN(1_000_000_000); // 1 WSOL = 1 SOL de liquidez

  console.log(`   Injetando ${bxpBal.toLocaleString()} BXP + 1 WSOL`);

  const cpmmResult = await raydium.cpmm.createPool({
    programId:      CPMM_PROGRAM,
    poolFeeAccount: CPMM_FEE_ACC,
    mintA: {
      address:   bxpMint.toBase58(),
      decimals:  6,
      programId: TOKEN_PROGRAM_ID.toBase58(), // ✅ SPL Clássico
    },
    mintB: {
      address:   NATIVE_MINT.toBase58(),
      decimals:  9,
      programId: TOKEN_PROGRAM_ID.toBase58(), // ✅ SPL Clássico
    },
    mintAAmount:  BXP_AMOUNT_RAW,
    mintBAmount:  WSOL_AMOUNT,
    startTime:    new BN(0),
    feeConfig,
    associatedOnly:      false,
    ownerInfo:           { feePayer: owner.publicKey, useSOLBalance: false },
    txVersion:           TxVersion.LEGACY,
    computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
  });

  console.log("   ↳ Enviando transação...");
  const { txId } = await cpmmResult.execute({ sequential: true });
  const poolId   = cpmmResult.extInfo.address.poolId;

  console.log(`   Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  // ── Verificar on-chain
  console.log("\n   Verificando Pool on-chain (aguardando 10s)...");
  await sleep(10_000);

  const poolAccount = await conn.getAccountInfo(poolId);
  if (!poolAccount) {
    console.error(`\n❌ Pool não confirmada on-chain. Verifique a Tx acima.`);
    process.exit(1);
  }

  console.log(`   ✅ Pool CONFIRMADA! ${poolAccount.data.length} bytes | Owner: ${poolAccount.owner.toBase58()}`);

  // ── Salvar no .env.local
  updateEnvLocal("RAYDIUM_POOL_ID",   poolId.toBase58());
  updateEnvLocal("RAYDIUM_POOL_TYPE", "cpmm");

  // ── Resultado
  const { address } = cpmmResult.extInfo;
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  🎉  CPMM POOL ATIVA NA DEVNET!                      ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\n   Pool ID    : ${address.poolId.toBase58()}`);
  console.log(`   LP Mint    : ${address.lpMint.toBase58()}`);
  console.log(`   Vault BXP  : ${address.vaultA.toBase58()}`);
  console.log(`   Vault WSOL : ${address.vaultB.toBase58()}`);
  console.log(`   Pool Tx    : https://explorer.solana.com/tx/${txId}?cluster=devnet`);
  console.log(`\n📣 .env.local atualizado. Próximo: npx tsx scripts/simulate-traction-cpmm.ts`);
}

main().catch((e) => {
  console.error("\n❌ ERRO FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
