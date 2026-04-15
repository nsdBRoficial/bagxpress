import { NextResponse } from "next/server";
import { createWalletIfNotExists, executeJupiterSwap } from "@/services/solana";

export async function POST(req: Request) {
  try {
    const { orderId, amount } = await req.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: "orderId and amount are required" }, { status: 400 });
    }

    // 1. Validate payment / orderId (mock validation delay)
    await new Promise(r => setTimeout(r, 400));
    
    // 2. Fetch or create a non-custodial secure wallet for user based on Passkey/Session
    const wallet = await createWalletIfNotExists("user_session_abc");

    // 3. Execute Swap on chain (includes graceful fallback and airdrop mechanism natively)
    const swapResult = await executeJupiterSwap(wallet.publicKey, amount);

    return NextResponse.json({
      success: true,
      wallet: wallet.address,
      txHash: swapResult.txHash,
      deliveredAmount: swapResult.bxpAmount,
      isRealTx: swapResult.isRealTx
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
