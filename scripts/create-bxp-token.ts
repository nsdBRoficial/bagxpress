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
 * 1. Gera keypairs para issuer e distributor
 * 2. Faz airdrop em devnet
 * 3. Cria mint com extensões Token-2022
 * 4. Minta supply inicial para distributor
 * 5. Exibe mint address e instruções para .env.local
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

// Token-2022 program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const CONNECTION = new Connection(RPC_URL, "confirmed");

// Parâmetros do token
const TOKEN_NAME = "BagxPress";
const TOKEN_SYMBOL = "BXP";
const TOKEN_DECIMALS = 6;
const TOTAL_SUPPLY = 1_000_000_000; // 1 bilhão
const TRANSFER_FEE_BPS = 250; // 2.5%
const MAX_TRANSFER_FEE = BigInt(1_000_000 * Math.pow(10, TOKEN_DECIMALS)); // 1M tokens max fee

// Metadata URI (pode ser atualizado para IPFS/Arweave depois)
const METADATA_URI = "https://bagxpress.xyz/token-metadata/bxp.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function airdropIfDevnet(keypair: Keypair, sol = 1): Promise<void> {
  try {
    const sig = await CONNECTION.requestAirdrop(
      keypair.publicKey,
      sol * LAMPORTS_PER_SOL
    );
    const { blockhash, lastValidBlockHeight } =
      await CONNECTION.getLatestBlockhash("confirmed");
    await CONNECTION.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    console.log(
      `   ✅ Airdrop ${sol} SOL → ${keypair.publicKey.toBase58().slice(0, 8)}...`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠️  Airdrop falhou: ${message}`);
  }
}

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

  // Gera keypairs
  const issuer = Keypair.generate();
  const distributor = Keypair.generate();

  console.log(`\n🔑 Keypairs gerados:`);
  console.log(`   Issuer:      ${issuer.publicKey.toBase58()}`);
  console.log(`   Distributor: ${distributor.publicKey.toBase58()}`);

  // Airdrop
  console.log("\n💸 Solicitando airdrops em devnet...");
  await airdropIfDevnet(issuer, 2); // 2 SOL para cobrir todas as transações
  await sleep(2000);
  await airdropIfDevnet(distributor, 0.5);
  await sleep(2000);

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
  const issuerB64 = Buffer.from(issuer.secretKey).toString("base64");
  const distributorB64 = Buffer.from(distributor.secretKey).toString("base64");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 TOKEN BXP CRIADO!\n");
  console.log(`   Mint: ${mintAddress}`);
  console.log(
    `   Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`
  );

  console.log("\n" + "=".repeat(60));
  console.log("📋 PRÓXIMO PASSO — Adicione ao seu .env.local:\n");
  console.log(`ENABLE_BXP_TOKEN=true`);
  console.log(`BXP_TOKEN_MINT=${mintAddress}`);
  console.log(`BXP_TOKEN_DECIMALS=${TOKEN_DECIMALS}`);
  console.log(`BXP_TOTAL_SUPPLY=${TOTAL_SUPPLY}`);
  console.log(`BXP_ISSUER_SECRET_KEY=${issuerB64}`);
  console.log(`BXP_DISTRIBUTOR_SECRET_KEY=${distributorB64}`);

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  ATENÇÃO:");
  console.log("   • NUNCA commite os SECRET KEYS no git");
  console.log("   • .env.local está no .gitignore");
  console.log("   • Guarde backup seguro dos keypairs de issuer e distributor");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
