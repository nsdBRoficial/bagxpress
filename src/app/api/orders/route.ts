/**
 * GET /api/orders
 * Retorna as orders e transações do usuário autenticado.
 * Suporta sessão Supabase (?wallet não necessário) ou Phantom wallet (?wallet=PUBLIC_KEY).
 *
 * IDENTITY MAPPING:
 *   pending_claims.order_id  → "pi_..." (stripe payment intent ID)
 *   orders.stripe_payment_intent_id → "pi_..." ← filtro correto
 *   orders.id                → UUID (NÃO usar para busca via claims)
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const phantomWallet = searchParams.get("wallet");

  console.log("[dashboard] wallet query:", phantomWallet ?? "(supabase session)");

  if (!user && !phantomWallet) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // pi_... IDs vindos de pending_claims (stripe payment intent IDs)
  let paymentIntentIds: string[] = [];

  if (phantomWallet) {
    // Busca claims associados à wallet Phantom
    const { data: claims } = await supabase
      .from("pending_claims")
      .select("order_id")
      .eq("claimed_by", phantomWallet);

    if (claims && claims.length > 0) {
      // pending_claims.order_id contém "pi_..." (stripe payment intent IDs)
      paymentIntentIds = claims.map((c) => c.order_id);
    }

    console.log("[dashboard] orderIds encontrados:", paymentIntentIds);
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

  if (user && paymentIntentIds.length > 0) {
    // Usuário Supabase + tem claims Phantom: merge dos dois
    // FIX: usa stripe_payment_intent_id (pi_...) — NÃO orders.id (UUID)
    query = query.or(
      `user_id.eq.${user.id},stripe_payment_intent_id.in.(${paymentIntentIds.join(",")})`
    );
  } else if (user) {
    query = query.eq("user_id", user.id);
  } else if (paymentIntentIds.length > 0) {
    // Apenas Phantom wallet: filtra via stripe_payment_intent_id
    // FIX CRÍTICO: era query.in("id", ...) → mismatch UUID vs pi_...
    query = query.in("stripe_payment_intent_id", paymentIntentIds);
  } else {
    // Phantom wallet enviada, mas sem claims associados
    console.log("[dashboard] orders retornadas: 0 (sem claims para wallet)");
    return NextResponse.json({
      success: true,
      orders: [],
      totalSpent: 0,
      totalPurchases: 0,
    });
  }

  const { data: orders, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[dashboard] erro na query:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const result = orders ?? [];

  // Calcula métricas agregadas no backend
  const totalSpent = result.reduce((sum, o) => sum + Number(o.amount_usd ?? 0), 0);
  const totalPurchases = result.length;

  console.log("[dashboard] orders retornadas:", totalPurchases, "| totalSpent: $" + totalSpent.toFixed(2));

  return NextResponse.json({
    success: true,
    orders: result,
    totalSpent,
    totalPurchases,
  });
}
