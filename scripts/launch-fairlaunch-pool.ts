import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import dotenv from "dotenv";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// Constants
const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const BXP_MINT = new PublicKey(process.env.BXP_TOKEN_MINT!);

async function main() {
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY missing");

  // Load Treasury
  const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  
  console.log(`🔑 Treasury Address: ${owner.publicKey.toBase58()}`);

  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: "devnet", // Devnet initialization
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });

  console.log("\n📘 1. Criando OpenBook Market...");
  
  try {
    const { execute, extInfo } = await raydium.marketV2.create({
      baseInfo: {
        mint: BXP_MINT,
        decimals: 6,
      },
      quoteInfo: {
        mint: NATIVE_MINT,
        decimals: 9,
      },
      lotSize: 1,
      tickSize: 0.000001,
      dexProgramId: new PublicKey("EoTcMgcDRTJVZDMZWBoU6pdYNDhn2xXJzXF5j1Zq7Uks"), // Devnet OpenBook
      txVersion: TxVersion.V0,
    });

    console.log("Tx assinadas e enviadas! Executando on-chain (isso pode demorar e custar ~2.8 SOL)...");
    const { txId } = await execute({ sequential: true });
    
    console.log(`✅ Market criado! Market ID: ${extInfo.address.marketId.toBase58()}`);
    console.log(`Explore Market: https://explorer.solana.com/address/${extInfo.address.marketId.toBase58()}?cluster=devnet`);

    // Pausa para dar tempo da blockchain processar as contas recém-criadas
    console.log("Aguardando indexação do Market...");
    await new Promise((r) => setTimeout(r, 10000));

    // Passo 2: Criar AMM Pool c/ liquidez inicial
    console.log("\n🌊 2. Criando Pool e Adicionando Liquidez Inicial (Fairlaunch)...");

    const baseAmount = new BN(10000000).mul(new BN(10).pow(new BN(6))); // 10M BXP
    const quoteAmount = new BN(1).mul(new BN(10).pow(new BN(9)));      // 1 WSOL

    const poolResponse = await raydium.liquidity.createPoolV4({
      marketInfo: {
        marketId: extInfo.address.marketId,
        programId: new PublicKey("EoTcMgcDRTJVZDMZWBoU6pdYNDhn2xXJzXF5j1Zq7Uks") // Devnet OpenBook
      },
      baseMintInfo: {
        mint: BXP_MINT,
        decimals: 6,
      },
      quoteMintInfo: {
        mint: NATIVE_MINT,
        decimals: 9,
      },
      baseAmount,
      quoteAmount,
      feeDestinationId: new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"), // Devnet Fee Dest
      programId: new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"), // Devnet Raydium AMM V4
      startTime: new BN(0), // imediato
      ownerInfo: { feePayer: owner.publicKey, useSOLBalance: true },
      associatedOnly: false,
      txVersion: TxVersion.V0,
      computeBudgetConfig: {
        units: 600000,
        microLamports: 10000,
      }
    });

    console.log("Enviando transação de criação da Pool...");
    const poolTxResult = await poolResponse.execute({ sequential: true });
    
    console.log("✅ FAIRLAUNCH CONCLUÍDO!");
    console.log(`Pool ID (AMM): ${poolResponse.extInfo.address.ammId.toBase58()}`);
    console.log(`Lp Token Mint: ${poolResponse.extInfo.address.lpMint.toBase58()}`);
    console.log(`TxId: ${poolTxResult.txId}`);

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro:", errorMsg);
  }
}

main().catch(console.error);
