/**
 * GET /api/orders
 * Retorna as orders e transações do usuário autenticado.
 * Requer sessão ativa.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const phantomWallet = searchParams.get("wallet");

  if (!user && !phantomWallet) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let orderIdsToFetch: string[] = [];

  if (phantomWallet) {
    // Busca pseudo-claims da Phantom
    const { data: claims } = await supabase
      .from("pending_claims")
      .select("order_id")
      .eq("claimed_by", phantomWallet);

    if (claims && claims.length > 0) {
      orderIdsToFetch = claims.map((c) => c.order_id);
    }
  }

  let query = supabase
    .from("orders")
    .select(`
      id,
      stripe_payment_intent_id,
      amount_usd,
      token_mint,
      creator_handle,
      creator_wallet,
      creator_royalty_percent,
      status,
      created_at,
      transactions (
        tx_hash,
        delivered_amount,
        is_real_tx,
        network,
        explorer_url,
        status,
        created_at
      )
    `);

  if (user && orderIdsToFetch.length > 0) {
    query = query.or(`user_id.eq.${user.id},id.in.(${orderIdsToFetch.join(",")})`);
  } else if (user) {
    query = query.eq("user_id", user.id);
  } else if (orderIdsToFetch.length > 0) {
    query = query.in("id", orderIdsToFetch);
  } else {
    // Phantom wallet enviada, mas sem orders associadas
    return NextResponse.json({ success: true, orders: [] });
  }

  const { data: orders, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, orders: orders ?? [] });
}
