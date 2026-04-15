/**
 * GET /api/wallet
 * Retorna a wallet do usuário autenticado (público key + saldo).
 * Requer sessão ativa. Cria wallet se não existir ainda.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateWallet, getWalletBalance } from "@/services/wallet";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const wallet = await getOrCreateWallet(user.id);
  const balance = await getWalletBalance(wallet.publicKey);

  return NextResponse.json({
    success: true,
    wallet: {
      publicKey: wallet.publicKey,
      network: wallet.network,
      balanceSol: balance,
      createdAt: wallet.createdAt,
      solscanUrl: `https://solscan.io/account/${wallet.publicKey}${wallet.network === "devnet" ? "?cluster=devnet" : ""}`,
      explorerUrl: `https://explorer.solana.com/address/${wallet.publicKey}${wallet.network !== "mainnet-beta" ? `?cluster=${wallet.network}` : ""}`,
    },
  });
}
