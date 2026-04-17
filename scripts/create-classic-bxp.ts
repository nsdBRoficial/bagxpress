/**
 * scripts/create-classic-bxp.ts
 * ─────────────────────────────────────────────────────────────
 * Cria o token BXP_CLASSIC usando SPL Token padrão (TOKEN_PROGRAM_ID)
 * Compatible com Raydium CPMM Devnet (sem extensões Token-2022)
 *
 * Fluxo:
 *   1. Gera novo Keypair para o Mint
 *   2. Cria Mint com TOKEN_PROGRAM_ID (6 decimais)
 *   3. Cria ATA da Treasury
 *   4. Minta 10.000.000 BXP para a Treasury
 *   5. Revoga Mint Authority (hard cap imutável)
 *   6. Atualiza .env.local automaticamente
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
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

const RPC_URL       = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const DECIMALS      = 6;
const TOTAL_SUPPLY  = 10_000_000; // 10M BXP
const SUPPLY_RAW    = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);

function updateEnvLocal(key: string, value: string, commentOnly = false): void {
  const envPath = ".env.local";
  let content = fs.readFileSync(envPath, "utf8");

  if (commentOnly) {
    // Comenta a linha existente e adiciona a nova logo abaixo
    const regex = new RegExp(`^(${key}=.*)$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `# BXP_TOKEN2022_MINT=${"<value-commented>"}  ← Token-2022 (bloqueado pelo erro 6007 do Raydium Devnet)\n# $1`);
    }
  } else {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, content, "utf8");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   create-classic-bxp.ts  —  SPL Token Clássico      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY ausente no .env.local");

  const owner = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "")));
  const conn  = new Connection(RPC_URL, "confirmed");

  console.log(`🔑 Treasury: ${owner.publicKey.toBase58()}`);

  const solBal = (await conn.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  console.log(`💰 Saldo SOL: ${solBal.toFixed(4)}\n`);
  if (solBal < 0.1) throw new Error("SOL insuficiente para criar o token!");

  // ─── PASSO 1: Gerar Keypair do Mint ──────────────────────────────────────
  console.log("[ 1/5 ] Gerando keypair do Mint...");
  const mintKeypair = Keypair.generate();
  console.log(`   Mint Keypair: ${mintKeypair.publicKey.toBase58()}`);

  // ─── PASSO 2: Criar Mint Account ─────────────────────────────────────────
  console.log("\n[ 2/5 ] Criando Mint Account (SPL Token clássico)...");
  const lamports = await getMinimumBalanceForRentExemptMint(conn);

  const createMintTx = new Transaction().add(
    // Criar a conta do Mint
    SystemProgram.createAccount({
      fromPubkey:    owner.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space:         MINT_SIZE,
      lamports,
      programId:     TOKEN_PROGRAM_ID,
    }),
    // Inicializar como Mint com 6 decimais
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      owner.publicKey,  // mint authority
      null,             // freeze authority (nenhuma)
      TOKEN_PROGRAM_ID
    )
  );

  const createMintSig = await sendAndConfirmTransaction(conn, createMintTx, [owner, mintKeypair], { commitment: "confirmed" });
  console.log(`   ✅ Mint criado!`);
  console.log(`      Mint Address : ${mintKeypair.publicKey.toBase58()}`);
  console.log(`      Tx           : https://explorer.solana.com/tx/${createMintSig}?cluster=devnet`);

  // ─── PASSO 3: Criar ATA da Treasury ──────────────────────────────────────
  console.log("\n[ 3/5 ] Criando ATA da Treasury...");
  const treasuryAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    owner.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );

  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      owner.publicKey,
      treasuryAta,
      owner.publicKey,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID
    )
  );

  const createAtaSig = await sendAndConfirmTransaction(conn, createAtaTx, [owner], { commitment: "confirmed" });
  console.log(`   ✅ ATA criada: ${treasuryAta.toBase58()}`);
  console.log(`      Tx: https://explorer.solana.com/tx/${createAtaSig}?cluster=devnet`);

  // ─── PASSO 4: Mintar 10M BXP para a Treasury ─────────────────────────────
  console.log("\n[ 4/5 ] Mintando 10.000.000 BXP para a Treasury...");
  const mintTx = new Transaction().add(
    createMintToInstruction(
      mintKeypair.publicKey,
      treasuryAta,
      owner.publicKey,
      SUPPLY_RAW,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const mintSig = await sendAndConfirmTransaction(conn, mintTx, [owner], { commitment: "confirmed" });
  console.log(`   ✅ ${TOTAL_SUPPLY.toLocaleString()} BXP mintados!`);
  console.log(`      Tx: https://explorer.solana.com/tx/${mintSig}?cluster=devnet`);

  // ─── PASSO 5: Revogar Mint Authority (Hard Cap) ───────────────────────────
  console.log("\n[ 5/5 ] Revogando Mint Authority (hard cap imutável)...");
  const revokeTx = new Transaction().add(
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      owner.publicKey,
      AuthorityType.MintTokens,
      null,  // null = revoga permanentemente
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const revokeSig = await sendAndConfirmTransaction(conn, revokeTx, [owner], { commitment: "confirmed" });
  console.log(`   ✅ Mint Authority REVOGADA. Supply fixado em 10.000.000 BXP para sempre.`);
  console.log(`      Tx: https://explorer.solana.com/tx/${revokeSig}?cluster=devnet`);

  // ─── Atualizar .env.local ─────────────────────────────────────────────────
  console.log("\n📝 Atualizando .env.local...");
  const newMint = mintKeypair.publicKey.toBase58();

  // Lê conteúdo atual
  let envContent = fs.readFileSync(".env.local", "utf8");

  // Comenta a linha BXP_TOKEN_MINT antiga e adiciona a nova
  envContent = envContent.replace(
    /^(BXP_TOKEN_MINT=.*)$/m,
    `# BXP_TOKEN2022_MINT=$1  ← Token-2022 bloqueado pelo erro 6007 do Raydium Devnet\nBXP_TOKEN_MINT=${newMint}  # SPL Clássico — compatível com Raydium CPMM Devnet`
  );

  // Limpa antigos pool IDs inválidos
  envContent = envContent.replace(
    /^RAYDIUM_POOL_ID=.*$/m,
    `RAYDIUM_POOL_ID=  # Será preenchido após launch-cpmm-pool.ts`
  );
  envContent = envContent.replace(
    /^RAYDIUM_MARKET_ID=.*$/m,
    `RAYDIUM_MARKET_ID=  # CPMM não usa OpenBook Market`
  );

  fs.writeFileSync(".env.local", envContent, "utf8");
  console.log(`   ✅ BXP_TOKEN_MINT atualizado para: ${newMint}`);
  console.log(`   ✅ BXP_TOKEN2022_MINT preservado como comentário`);

  // ─── Resultado Final ───────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  🎉  BXP_CLASSIC CRIADO COM SUCESSO!                 ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`\n   Mint Address  : ${newMint}`);
  console.log(`   ATA Treasury  : ${treasuryAta.toBase58()}`);
  console.log(`   Supply        : 10.000.000 BXP (fixo)`);
  console.log(`   Decimais      : 6`);
  console.log(`   Mint Auth     : REVOGADA ✅`);
  console.log(`   Freeze Auth   : Nunca atribuída ✅`);
  console.log(`\n   Solana Explorer:`);
  console.log(`   https://explorer.solana.com/address/${newMint}?cluster=devnet`);
  console.log(`\n📣 Próximo passo: npx tsx scripts/launch-cpmm-pool.ts`);
}

main().catch((e) => {
  console.error("\n❌ ERRO FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
