import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { getSolPrice } from "@/services/oracle";

export const dynamic = "force-dynamic";

// In-memory cache variables
let cachedMetrics: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

// Initial Supply for Burn Calculation
const INITIAL_BXP_SUPPLY = 10_000_000;
// Current BXP/SOL Ratio (Simplified)
const BXP_SOL_RATIO = 0.001;

async function getRealMetrics() {
  const now = Date.now();
  if (cachedMetrics && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMetrics;
  }

  const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

  // 1. Avg Response Time (Latency)
  let avgResponse = 0;
  try {
    const start = performance.now();
    await connection.getLatestBlockhash("confirmed");
    avgResponse = Math.round(performance.now() - start);
  } catch (e) {
    console.warn("[/api/feed] Failed to get latency:", e);
    avgResponse = 150; // fallback
  }

  // 2. Burned Tokens
  let burnedTokens = 0;
  try {
    const mintPubkey = new PublicKey(process.env.BXP_TOKEN_MINT || "");
    const supplyInfo = await connection.getTokenSupply(mintPubkey);
    const currentSupply = Number(supplyInfo.value.uiAmount);
    burnedTokens = Math.max(0, INITIAL_BXP_SUPPLY - currentSupply);
  } catch (e) {
    console.warn("[/api/feed] Failed to get supply:", e);
  }

  // 3. Treasury Balance
  let treasuryBalance = 0;
  try {
    if (process.env.FEE_PAYER_SECRET_KEY) {
      const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
      const keypair = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
      const balanceLamports = await connection.getBalance(keypair.publicKey);
      treasuryBalance = balanceLamports / LAMPORTS_PER_SOL;
    }
  } catch (e) {
    console.warn("[/api/feed] Failed to get treasury balance:", e);
  }

  // 4. Oracle Price
  let oraclePrice = 0;
  try {
    const oracleResult = await getSolPrice();
    oraclePrice = oracleResult.usdPerSol * BXP_SOL_RATIO;
  } catch (e) {
    console.warn("[/api/feed] Failed to get oracle price:", e);
  }

  cachedMetrics = {
    avgResponse,
    burnedTokens,
    treasuryBalance,
    oraclePrice
  };
  lastCacheTime = now;

  return cachedMetrics;
}

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();

    // Fetch the 10 most recent successful orders with their transactions
    const { data: orders, error } = await admin
      .from("orders")
      .select(`
        id,
        amount_usd,
        token_mint,
        creator_handle,
        status,
        created_at,
        transactions (
          tx_hash,
          is_real_tx,
          network,
          explorer_url
        )
      `)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    // Fetch real metrics
    const metrics = await getRealMetrics();

    // 5. Last Tx Hash (Extract from the latest order's transaction)
    let lastTxHash = null;
    let lastTxExplorerUrl = null;
    if (orders && orders.length > 0 && orders[0].transactions && orders[0].transactions.length > 0) {
      lastTxHash = orders[0].transactions[0].tx_hash;
      lastTxExplorerUrl = orders[0].transactions[0].explorer_url;
    }
    
    // Add the last tx hash to metrics for the widget
    const fullMetrics = {
      ...metrics,
      lastTxHash,
      lastTxExplorerUrl
    };

    return NextResponse.json({
      success: true,
      data: orders ?? [],
      metrics: fullMetrics
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[/api/feed] Error:", message);
    return NextResponse.json(
      { success: false, error: message, data: [], metrics: null },
      { status: 500 }
    );
  }
}
