import { Connection, PublicKey } from "@solana/web3.js";
import { DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId } from "@raydium-io/raydium-sdk-v2";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
  const CPMM = new PublicKey(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM);

  console.log("CPMM Program:", CPMM.toBase58());
  console.log("Fee Account :", DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC);
  console.log("---");
  for (let i = 0; i < 6; i++) {
    const { publicKey: pda } = getCpmmPdaAmmConfigId(CPMM, i);
    const info = await conn.getAccountInfo(pda);
    if (info) {
      console.log(`✅ Config[${i}]: ${pda.toBase58()} owner=${info.owner.toBase58()} size=${info.data.length}`);
    } else {
      console.log(`❌ Config[${i}]: ${pda.toBase58()} — NÃO EXISTE`);
    }
  }
}
main().catch(console.error);
