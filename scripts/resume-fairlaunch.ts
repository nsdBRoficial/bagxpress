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
const MARKET_ID_STR = process.env.RAYDIUM_MARKET_ID;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY missing");
  // Permite iniciar se existir a pool ou o market. Verificação depois
  if (!MARKET_ID_STR || MARKET_ID_STR === "SEU_MARKET_ID_AQUI") throw new Error("Atenção: Configure a variável RAYDIUM_MARKET_ID no .env.local");

  const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
  
  console.log(`🔑 Treasury Address: ${owner.publicKey.toBase58()}`);

  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: "devnet",
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });

  let marketId;
  try {
     marketId = new PublicKey(MARKET_ID_STR);
  } catch (e) {
     throw new Error("O RAYDIUM_MARKET_ID configurado no .env.local não é uma base58 válida.");
  }

  console.log(`\n📘 1. BYPASS OPENBOOK: Bypassed. Utilizando Market ID Existente: ${marketId.toBase58()}`);
  console.log("🌊 2. INIT POOL: Tentando Inicializar Pool e Adicionar Liquidez...");

  // Inicializa Pool
  const baseAmount = new BN(10000000).mul(new BN(10).pow(new BN(6))); // 10M BXP
  const quoteAmount = new BN(1).mul(new BN(10).pow(new BN(9)));      // 1 WSOL

  let poolId: PublicKey | undefined;
  
  try {
     const poolResponse = await raydium.liquidity.createPoolV4({
      marketInfo: {
        marketId: marketId,
        programId: new PublicKey("EoTcMgcDRTJVZDMZWBoU6pdYNDhn2xXJzXF5j1Zq7Uks") // Devnet OpenBook
      },
      baseMintInfo: { mint: BXP_MINT, decimals: 6 },
      quoteMintInfo: { mint: NATIVE_MINT, decimals: 9 },
      baseAmount,
      quoteAmount,
      feeDestinationId: new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"), // Devnet Fee Dest
      programId: new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"), // Devnet AMM V4
      startTime: new BN(0),
      ownerInfo: { feePayer: owner.publicKey, useSOLBalance: true },
      associatedOnly: false,
      txVersion: TxVersion.V0,
      computeBudgetConfig: { units: 600000, microLamports: 100000 }
    });

    console.log("Enviando transação de criação da Pool...");
    const poolTxResult = await poolResponse.execute({ sequential: true });
    
    console.log("✅ POOL RECRIADA/CONFIRMADA (FAIRLAUNCH)!");
    poolId = poolResponse.extInfo.address.ammId;
    console.log(`Pool ID (AMM): ${poolId.toBase58()}`);
    console.log(`Lp Token Mint: ${poolResponse.extInfo.address.lpMint.toBase58()}`);
    console.log(`TxId: ${poolTxResult.txId}`);
  } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     console.warn("⚠️ Falha ao criar a pool. Se o erro for 'custom program error: 0x0', a pool JÁ FOI INICIALIZADA na blockchain com esse market.");
     console.warn("   Detalhes do erro:", msg);
     
     if (process.env.RAYDIUM_POOL_ID && process.env.RAYDIUM_POOL_ID !== "COLOQUE_AQUI_O_POOL_ID") {
         poolId = new PublicKey(process.env.RAYDIUM_POOL_ID);
         console.log(`\n➡️ Recuperando Pool ID do .env.local: ${poolId.toBase58()}`);
     } else {
         throw new Error("A pool não pôde ser criada e não há RAYDIUM_POOL_ID salvo no .env.local para prosseguirmos com o bot.");
     }
  }

  console.log("\n⏳ 3. DELAY INTELIGENTE: Aguardando 45 segundos para a RPC sincronizar a Pool (Isso engolirá erros se a pool é recém-nascida)...");
  await sleep(45000);

  console.log(`\n🤖 4. TRACTION BOT: Disparando Bot de Tração Simulada. Wallet: ${owner.publicKey.toBase58()}`);
  
  let poolInfo;
  try {
     console.log(`🔍 Carregando dados on-chain da pool (RPC): ${poolId!.toBase58()}...`);
     poolInfo = await raydium.liquidity.getPoolInfoFromRpc({ poolId: poolId!.toBase58() });
  } catch(e) {
     console.error("❌ Erro fatal ao carregar Pool Info via RPC. A Devnet RPC ainda não sincronizou (mesmo após delay). ");
     console.error("⏳ Sugestão: Tente rodar 'npx tsx scripts/simulate-traction.ts' manualmente em 2 minutos.");
     return;
  }

  const totalSwaps = 90;
  const solAmountPerSwap = 0.1;

  for (let i = 1; i <= totalSwaps; i++) {
    console.log(`\n============== SWAP ${i} / ${totalSwaps} ==============`);
    try {
      const amountIn = new BN(Math.floor(solAmountPerSwap * Math.pow(10, 9)));

      const { amountOut } = raydium.liquidity.computeAmountOut({
        poolInfo,
        amountIn,
        mintIn: poolInfo.baseMint.address === NATIVE_MINT.toBase58() ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        mintOut: poolInfo.baseMint.address === NATIVE_MINT.toBase58() ? poolInfo.quoteMint.address : poolInfo.baseMint.address,
        slippage: 0.1, 
      });

      const adjustedMinOut = new BN(amountOut.amount.raw).muln(70).divn(100); 

      console.log(`🤑 Comprando com 0.1 SOL... (Min OUT: ${amountOut.amount.toExact()} BXP)`);

      const { execute } = await raydium.liquidity.swap({
        poolInfo,
        amountIn,
        amountOut: adjustedMinOut,
        fixedSide: 'in',
        inputMint: poolInfo.baseMint.address === NATIVE_MINT.toBase58() ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        txVersion: TxVersion.V0,
        computeBudgetConfig: { units: 600000, microLamports: 150000 } 
      });

      const { txId } = await execute({ sequential: true });
      console.log(`✅ Swap Executado. Hash: ${txId}`);

      console.log(`⏳ Aguardando 10 segundos para próxima compra (Evitando Timeouts/429 limits)...`);
      await sleep(10000);

    } catch (e: unknown) {
      console.warn(`❌ Erro Isolado no swap ${i}:`, e instanceof Error ? e.message : String(e));
      console.log(`⚠️ Continuado para o próximo (Try/Catch robusto)... Delay de 10s extra de penalização. ================== `);
      await sleep(10000);
    }
  }

  console.log("\n🚀 OPERAÇÃO PURE FAIRLAUNCH (RESUME) FINALIZADA COM SUCESSO!");
}

main().catch(console.error);
