import { Connection } from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const TX = "4cbBHnAzd8t4RD1x17gjYr3HoT8hFqoQxCRfK8PYreuNZiPivZYsL1X8R1K9xBaab1FQwp9tF9KfakABBjx68r4t";

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
  const t = await conn.getTransaction(TX, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!t) {
    console.log("tx nao encontrada ainda — aguarde alguns blocos");
    return;
  }
  console.log("err:", t.meta?.err ?? "nenhum (sucesso)");
  console.log("\nlogs:");
  t.meta?.logMessages?.forEach((l) => console.log(l));
}

main().catch(console.error);
