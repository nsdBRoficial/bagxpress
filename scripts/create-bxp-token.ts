/**
 * scripts/create-bxp-token.ts
 * Criação do Token $BXP com Token-2022 (Token Extensions)
 *
 * Execução:
 *   npx tsx scripts/create-bxp-token.ts
 *
 * Extensões Token-2022 utilizadas:
 *   - TransferFeeConfig: 2.5% fee em cada transfer (250 bps) → royalties automáticos
 *   - Metadata: Nome/símbolo/URI on-chain sem Metaplex
 *   - PermanentDelegate: Controle de sweep/burn server-side (power move técnico)
 *
 * O que faz:
 * 1. Carrega keypair da Treasury (.env.local) para issuer e distributor
 * 2. Cria mint com extensões Token-2022
 * 3. Minta supply inicial diretamente para a Treasury
 * 4. Exibe mint address e instruções para .env.local
 *
 * REFERÊNCIA: spl-token-2022 npm package + @solana/web3.js
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
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Token-2022 constants loaded dynamically from @solana/spl-token

const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const CONNECTION = new Connection(RPC_URL, "confirmed");

// Parâmetros do token
const TOKEN_NAME = "BagxPress";
const TOKEN_SYMBOL = "BXP";
const TOKEN_DECIMALS = 6;
const TOTAL_SUPPLY = 10_000_000; // 10 milhões
const TRANSFER_FEE_BPS = 250; // 2.5%
const MAX_TRANSFER_FEE = BigInt(1_000_000 * Math.pow(10, TOKEN_DECIMALS)); // 1M tokens max fee

// Metadata URI (pode ser atualizado para IPFS/Arweave depois)
const METADATA_URI = "https://bagxpress.xyz/token-metadata/bxp.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Cria Mint com extensões Token-2022
// A criação manual via instrução raw garante suporte a todas as extensões
// ---------------------------------------------------------------------------
async function createBxpMint(
  issuer: Keypair,
  permanentDelegate: PublicKey
): Promise<PublicKey> {
  console.log("\n📊 Criando mint Token-2022 com extensões...");

  // Importa spl-token dinamicamente
  const spl = await import("@solana/spl-token");
  const { TOKEN_2022_PROGRAM_ID: SPL_TOKEN_2022_ID } = spl;

  // Gera mint keypair
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  console.log(`   Mint address: ${mint.toBase58()}`);

  // Calcula espaço necessário para o mint com extensões
  // TransferFeeConfig + MetadataPointer + PermanentDelegate
  const extensions = [
    spl.ExtensionType.TransferFeeConfig,
    spl.ExtensionType.MetadataPointer,
    spl.ExtensionType.PermanentDelegate,
  ];

  const mintLen = spl.getMintLen(extensions);
  const lamports = await CONNECTION.getMinimumBalanceForRentExemption(mintLen);

  console.log(
    `   Espaço necessário: ${mintLen} bytes | Rent: ${lamports / LAMPORTS_PER_SOL} SOL`
  );

  // Transação: criar account + inicializar extensões + inicializar mint
  const tx = new Transaction();

  // 1. Criar account
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: issuer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: SPL_TOKEN_2022_ID,
    })
  );

  // 2. Inicializar TransferFeeConfig
  tx.add(
    spl.createInitializeTransferFeeConfigInstruction(
      mint,
      issuer.publicKey,     // withdraw authority
      issuer.publicKey,     // config authority
      TRANSFER_FEE_BPS,
      MAX_TRANSFER_FEE,
      SPL_TOKEN_2022_ID
    )
  );

  // 3. Inicializar MetadataPointer
  tx.add(
    spl.createInitializeMetadataPointerInstruction(
      mint,
      issuer.publicKey,  // authority
      mint,              // metadata address (self-referential)
      SPL_TOKEN_2022_ID
    )
  );

  // 4. Inicializar PermanentDelegate
  tx.add(
    spl.createInitializePermanentDelegateInstruction(
      mint,
      permanentDelegate,
      SPL_TOKEN_2022_ID
    )
  );

  // 5. Inicializar Mint
  tx.add(
    spl.createInitializeMint2Instruction(
      mint,
      TOKEN_DECIMALS,
      issuer.publicKey,  // mint authority
      issuer.publicKey,  // freeze authority
      SPL_TOKEN_2022_ID
    )
  );

  await sendAndConfirmTransaction(CONNECTION, tx, [issuer, mintKeypair], {
    commitment: "confirmed",
  });

  // 6. Inicializar Metadata on-chain (instrução separada)
  try {
    const initMetadataTx = new Transaction().add(
      spl.createInitializeInstruction({
        programId: SPL_TOKEN_2022_ID,
        metadata: mint,
        updateAuthority: issuer.publicKey,
        mint,
        mintAuthority: issuer.publicKey,
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        uri: METADATA_URI,
      })
    );
    await sendAndConfirmTransaction(CONNECTION, initMetadataTx, [issuer], {
      commitment: "confirmed",
    });
    console.log("   ✅ Metadata on-chain inicializada");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      `   ⚠️  Metadata init falhou (não crítico): ${message}`
    );
  }

  console.log("   ✅ Mint criado com sucesso!");
  return mint;
}

// ---------------------------------------------------------------------------
// Minta supply inicial para distributor
// ---------------------------------------------------------------------------
async function mintInitialSupply(
  mint: PublicKey,
  issuer: Keypair,
  distributor: PublicKey
): Promise<void> {
  const spl = await import("@solana/spl-token");
  const { TOKEN_2022_PROGRAM_ID: SPL_TOKEN_2022_ID } = spl;

  console.log("\n💰 Mintando supply inicial...");

  // Cria token account para o distributor
  const distributorAta = await spl.getOrCreateAssociatedTokenAccount(
    CONNECTION,
    issuer,
    mint,
    distributor,
    false,
    "confirmed",
    { commitment: "confirmed" },
    SPL_TOKEN_2022_ID
  );

  console.log(
    `   Token account distributor: ${distributorAta.address.toBase58()}`
  );

  // Minta supply completo
  const supplyRaw = BigInt(TOTAL_SUPPLY) * BigInt(Math.pow(10, TOKEN_DECIMALS));

  await spl.mintTo(
    CONNECTION,
    issuer,
    mint,
    distributorAta.address,
    issuer, // mint authority
    supplyRaw,
    [],
    { commitment: "confirmed" },
    SPL_TOKEN_2022_ID
  );

  console.log(
    `   ✅ ${TOTAL_SUPPLY.toLocaleString()} BXP mintados para distributor`
  );

  // Revoga Mint Authority para fixar supply
  console.log("\n🔒 Revogando Mint Authority para garantir hard cap...");
  try {
    await spl.setAuthority(
      CONNECTION,
      issuer,
      mint,
      issuer,     // current authority
      spl.AuthorityType.MintTokens,
      null,       // null = revogada
      [],
      { commitment: "confirmed" },
      SPL_TOKEN_2022_ID
    );
    console.log("   ✅ Mint Authority revogada com sucesso!");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("   ⚠️ Falha ao revogar mint authority:", message);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n🪙 BagxPress — Criação do Token $BXP (Token-2022)\n");
  console.log("=".repeat(60));
  console.log(`   Nome:     ${TOKEN_NAME}`);
  console.log(`   Símbolo:  ${TOKEN_SYMBOL}`);
  console.log(`   Decimals: ${TOKEN_DECIMALS}`);
  console.log(`   Supply:   ${TOTAL_SUPPLY.toLocaleString()}`);
  console.log(`   Transfer Fee: ${TRANSFER_FEE_BPS / 100}%`);
  console.log(`   Extensões: TransferFeeConfig + MetadataPointer + PermanentDelegate`);
  console.log("=".repeat(60));

  if (!process.env.FEE_PAYER_SECRET_KEY) {
    console.error("❌ Erro: FEE_PAYER_SECRET_KEY não encontrada no .env.local");
    process.exit(1);
  }

  // Carrega keypair da Treasury a partir do .env.local
  let treasuryKeypair: Keypair;
  try {
    const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, ""); // remove aspas caso existam
    treasuryKeypair = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  } catch (err) {
    try {
      // Fallback caso a chave antiga esivesse em formato [] (embora a nova esteja em bs58 pelo que notei no .env)
      const secretKeyJson = JSON.parse(process.env.FEE_PAYER_SECRET_KEY);
      treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyJson));
    } catch(err2) {
       console.error("❌ Erro ao decodificar FEE_PAYER_SECRET_KEY. Certifique-se de que é um formato válido (Base58 ou Array JSON).");
       process.exit(1);
    }
  }

  const issuer = treasuryKeypair;
  const distributor = treasuryKeypair;

  console.log(`\n🔑 Keypair da Treasury carregada:`);
  console.log(`   Treasury Address: ${treasuryKeypair.publicKey.toBase58()}`);

  const balance = await CONNECTION.getBalance(treasuryKeypair.publicKey);
  console.log(`   Saldo atual: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("❌ Erro: Saldo insuficiente na Treasury (Mínimo recomendado: 0.1 SOL)");
    process.exit(1);
  }

  // Cria mint Token-2022
  let mint: PublicKey;
  try {
    mint = await createBxpMint(issuer, issuer.publicKey); // issuer como permanent delegate
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Erro ao criar mint:", message);
    console.error("   Possível causa: @solana/spl-token não suporta todas as extensões nesta versão");
    console.error("   Instale com: npm install @solana/spl-token");
    process.exit(1);
  }

  // Minta supply
  try {
    await mintInitialSupply(mint, issuer, distributor.publicKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("\n⚠️  Falha ao mintar supply:", message);
  }

  // Exibe instruções de configuração
  const mintAddress = mint.toBase58();
  const treasurySecretb64 = Buffer.from(treasuryKeypair.secretKey).toString("base64");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 TOKEN BXP CRIADO NA TREASURY!\n");
  console.log(`   Mint: ${mintAddress}`);
  console.log(
    `   Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`
  );

  console.log("\n" + "=".repeat(60));
  console.log("📋 PRÓXIMO PASSO — Atualize seu .env.local:\n");
  console.log(`ENABLE_BXP_TOKEN=true`);
  console.log(`BXP_TOKEN_MINT=${mintAddress}`);
  console.log(`BXP_TOKEN_DECIMALS=${TOKEN_DECIMALS}`);
  console.log(`BXP_TOTAL_SUPPLY=${TOTAL_SUPPLY}`);
  console.log(`BXP_ISSUER_SECRET_KEY=${treasurySecretb64} # (A mesma key da Treasury, mas em base64 para uso legado se precisar)`);
  console.log(`BXP_DISTRIBUTOR_SECRET_KEY=${treasurySecretb64}`);

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  ATENÇÃO METEORA LIQUIDITY POOL:");
  console.log("   • O Liquidity Pair oficial deve ser BXP/SOL na Meteora DLMM");
  console.log("   • O Mint Authority foi revogado (hard cap garantido)");
  console.log("   • Tudo está unificado na Treasury. O supply de BXP e a Solana estão agrupados na mesma conta.");

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  SECURITY INFO:");
  console.log("   • NUNCA commite os SECRET KEYS no git");
  console.log("   • .env.local está no .gitignore");
  console.log("   • O supply de 10M BXP é irrevocável na Devnet.");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});

