import { Connection, PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const POOL_ID = "FtQgqWzzexFhuc7KG6ZccPtw3YmqSp5TxkeqDmY3wXe2";
const MARKET_ID = "4qcbk1VM16uMKgiKQEcDQGJvjvCnPsFWyZ3LdW1eh5CD";

async function audit() {
  console.log("Auditing Pool ID:", POOL_ID);
  
  const poolPubkey = new PublicKey(POOL_ID);
  const accountInfo = await connection.getAccountInfo(poolPubkey);
  
  if (!accountInfo) {
    console.error("❌ Pool account does not exist on-chain!");
  } else {
    console.log("✅ Pool account exists. Size:", accountInfo.data.length, "bytes.");
    console.log("Owner Program:", accountInfo.owner.toBase58());
  }

  const marketPubkey = new PublicKey(MARKET_ID);
  const marketInfo = await connection.getAccountInfo(marketPubkey);
  if (!marketInfo) {
    console.error("❌ Market account does not exist on-chain!");
  } else {
    console.log("✅ Market account exists. Size:", marketInfo.data.length, "bytes.");
    console.log("Owner Program:", marketInfo.owner.toBase58());
  }

  // Next, try to fetch pool info using Raydium SDK
  try {
    const raydium = await Raydium.load({
      connection,
      cluster: "devnet",
      disableFeatureCheck: true,
      blockhashCommitment: "confirmed",
    });

    console.log("Fetching Pool Info from RPC via SDK...");
    const sdkPoolInfo = await raydium.liquidity.getPoolInfoFromRpc({ poolId: POOL_ID });
    
    console.log("✅ SDK successfully parsed the pool info:", sdkPoolInfo.id.toBase58());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error("❌ SDK getPoolInfoFromRpc failed:", e.message || String(e));
  }
}

audit().catch(console.error);
