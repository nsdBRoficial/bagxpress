/**
 * scripts/setup-fee-payer.ts
 * Setup automático da wallet Fee Payer para o Gasless Engine
 *
 * Execução:
 *   npx tsx scripts/setup-fee-payer.ts
 *
 * O que faz:
 * 1. Gera um novo Keypair Solana
 * 2. Faz airdrop de 1 SOL em devnet
 * 3. Exibe o public key e o secret key em base64
 * 4. Instrui como adicionar ao .env.local
 *
 * IMPORTANTE: Jamais commitar o secret key no repositório.
 * Este script é apenas para geração inicial em ambiente de desenvolvimento.
 */

import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";

const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  console.log("\n🚀 BagxPress — Setup Fee Payer (Gasless Engine)\n");
  console.log("=".repeat(60));

  // 1. Gera keypair
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const secretKeyB64 = Buffer.from(keypair.secretKey).toString("base64");

  console.log(`\n📍 Fee Payer Public Key:\n   ${publicKey}`);

  // 2. Conecta ao devnet e faz airdrop
  const connection = new Connection(RPC_URL, "confirmed");

  console.log(`\n💸 Solicitando airdrop de 1 SOL em devnet...`);
  console.log(`   RPC: ${RPC_URL}`);

  try {
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL
    );

    console.log(`   Airdrop enviado: ${sig.slice(0, 8)}...`);

    // Aguarda confirmação
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    console.log("   ✅ Airdrop confirmado!");

    // Verifica saldo
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`   💰 Saldo atual: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Explorer link
    console.log(
      `   🔍 Explorer: https://explorer.solana.com/address/${publicKey}?cluster=devnet`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠️  Airdrop falhou: ${message}`);
    console.warn(
      "   Verifique se o devnet está disponível ou tente manualmente:"
    );
    console.warn(
      `   curl "https://faucet.solana.com/api/request_airdrop?pubkey=${publicKey}"`
    );
  }

  // 3. Exibe instruções de configuração
  console.log("\n" + "=".repeat(60));
  console.log("📋 PRÓXIMO PASSO — Adicione ao seu .env.local:\n");
  console.log(`ENABLE_GASLESS=true`);
  console.log(`FEE_PAYER_SECRET_KEY=${secretKeyB64}`);
  console.log("\n" + "=".repeat(60));

  console.log("\n⚠️  ATENÇÃO:");
  console.log("   • NUNCA commite FEE_PAYER_SECRET_KEY no git");
  console.log("   • O .env.local já está no .gitignore");
  console.log("   • Em produção, use um secrets manager (ex: Vercel Secrets)");
  console.log("   • Esta wallet de fee payer deve ser monitorada periodicamente");

  // Verifica saldo real para confirmar
  try {
    const finalBalance = await connection.getBalance(
      new PublicKey(publicKey)
    );
    if (finalBalance > 0) {
      console.log("\n✅ Gasless Engine pronto para uso!");
      console.log(
        `   Fee Payer: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
      );
      console.log(`   Saldo: ${finalBalance / LAMPORTS_PER_SOL} SOL`);
    }
  } catch {
    // ignora falha de verificação final
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Erro no setup:", err);
  process.exit(1);
});
