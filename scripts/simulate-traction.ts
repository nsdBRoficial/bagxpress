import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import bs58 from "bs58";
import dotenv from "dotenv";
import BN from "bn.js";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// Constants
const NATIVE_MINT = "So11111111111111111111111111111111111111112";
const BXP_MINT = process.env.BXP_TOKEN_MINT!;

// Substitua pelo POOL ID gerado no Passo 1.
const TARGET_POOL_ID = process.env.RAYDIUM_POOL_ID || "COLOQUE_AQUI_O_POOL_ID";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY missing");
  if (TARGET_POOL_ID === "COLOQUE_AQUI_O_POOL_ID") throw new Error("Configure o TARGET_POOL_ID");

  const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
  const owner = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));

  console.log(`🤖 Iniciando Tração Simulada. Wallet: ${owner.publicKey.toBase58()}`);

  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: "devnet",
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });

  console.log(`🔍 Carregando pool: ${TARGET_POOL_ID}...`);
  // Ajuste se necessário para outro tipo de pool no Raydium, Ex: ammV4
  // O Raydium sdk API.getPoolInfo resolve a interface padronizada.
  const poolInfo = await raydium.liquidity.getPoolInfoFromRpc({ poolId: TARGET_POOL_ID });

  const totalSwaps = 90;
  const solAmountPerSwap = 0.1;

  for (let i = 1; i <= totalSwaps; i++) {
    console.log(`\n============== SWAP ${i} / ${totalSwaps} ==============`);
    try {
      const amountIn = new BN(solAmountPerSwap * Math.pow(10, 9)); // 0.1 SOL

      // Calculando Quote de Swap
      const { amountOut, minAmountOut: _minAmountOut } = raydium.liquidity.computeAmountOut({
        poolInfo,
        amountIn,
        mintIn: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        mintOut: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.quoteMint.address : poolInfo.baseMint.address,
        slippage: 0.1, // 10% tolerance para pump rápido
      });

      // minAmountOut será forçado mais baixo para evitar falhas de slippage se o preço der pump agudo
      const adjustedMinOut = new BN(amountOut.amount.raw).muln(70).divn(100); // 30% tolerância!

      console.log(`🤑 Comprando com 0.1 SOL... (Esperado ~ ${amountOut.amount.toExact()} BXP)`);

      const { execute } = await raydium.liquidity.swap({
        poolInfo,
        amountIn,
        amountOut: adjustedMinOut,
        fixedSide: 'in',
        inputMint: poolInfo.baseMint.address === NATIVE_MINT ? poolInfo.baseMint.address : poolInfo.quoteMint.address,
        txVersion: TxVersion.V0,
        computeBudgetConfig: {
          units: 600000,
          microLamports: 100000, // Preço alto para passar rápido
        }
      });

      const { txId } = await execute({ sequential: true });
      console.log(`✅ Swap Executado. Hash: ${txId}`);

      // Rate limit protection
      console.log(`⏳ Aguardando 4 segundos para evitar limits (HTTP 429)...`);
      await sleep(4000);

    } catch (e: unknown) {
      console.error(`❌ Erro no swap ${i}:`, e instanceof Error ? e.message : String(e));
      console.log(`⏳ Delay prolongado antes de dar retry no loop...`);
      await sleep(10000);
    }
  }

  console.log("\n🚀 SIMULAÇÃO DE TRAÇÃO FINALIZADA COM SUCESSO!");
}

main().catch(console.error);
