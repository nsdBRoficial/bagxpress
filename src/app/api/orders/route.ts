/**
 * GET /api/orders
 * v2.0 — Winner Hackathon Build
 *
 * PT-BR: Retorna as orders e transações do usuário autenticado.
 * EN: Returns the authenticated user's orders and transactions.
 *
 * PT-BR: Suporta sessão Supabase ou Phantom wallet (?wallet=PUBLIC_KEY).
 * EN: Supports Supabase session or Phantom wallet (?wallet=PUBLIC_KEY).
 *
 * IDENTITY MAPPING:
 *   pending_claims.order_id  → stripe_payment_intent_id
 *   orders.stripe_payment_intent_id → filtro correto / correct filter
 *   orders.id                → UUID (NÃO usar para busca via claims / do NOT use for claims lookup)
 *
 * PT-BR: Usa service role key para bypassar RLS — apenas server-side.
 * EN: Uses service role key to bypass RLS — server-side only.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  // PT-BR: Admin client bypassa RLS — nunca exposto ao cliente
  // EN: Admin client bypasses RLS — never exposed to the client
  const supabaseAdmin = createSupabaseAdminClient();
  // PT-BR: Auth client para ler cookies de sessão do usuário
  // EN: Auth client to read user session cookies
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  const { searchParams } = new URL(req.url);
  const phantomWallet = searchParams.get("wallet");

  console.log("[orders][debug] wallet:", phantomWallet ?? "(supabase session)");

  if (!user && !phantomWallet) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // pi_... IDs vindos de pending_claims (stripe payment intent IDs)
  let paymentIntentIds: string[] = [];

  if (phantomWallet) {
    // FASE 1: usa admin client para bypassar RLS na leitura de pending_claims
    const { data: claims, error: claimsError } = await supabaseAdmin
      .from("pending_claims")
      .select("order_id")
      .eq("claimed_by", phantomWallet);

    console.log("[orders][debug] claims encontrados:", claims);
    if (claimsError) console.error("[orders][debug] claimsError:", claimsError.message);

    // RAW: inspeciona o que veio do banco antes de qualquer transformação
    const rawIds = claims?.map((c) => c.order_id).filter(Boolean);
    console.log("[orders][debug] paymentIntentIds RAW:", rawIds);
    console.log("[orders][debug] typeof rawIds:", typeof rawIds);
    console.log("[orders][debug] length rawIds:", rawIds?.length);

    // FASE 2 FIX: NÃO filtrar por startsWith("pi_") — order_id pode ter outros formatos
    // Apenas garantir que é string válida e não vazia
    const cleanIds = rawIds
      ?.map((id) => String(id).trim())
      .filter((id) => id.length > 0);

    console.log("[orders][debug] cleanIds (sem filtro startsWith):", cleanIds);

    if (cleanIds && cleanIds.length > 0) {
      paymentIntentIds = cleanIds;
    }

    console.log("[orders][debug] paymentIntentIds final:", paymentIntentIds);
  }

  // FASE 1: usa admin client para a query em orders (bypassa RLS)
  let query = supabaseAdmin
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
    // Apenas Phantom wallet: filtra via stripe_payment_intent_id (cleanIds já sanitizados)
    console.log("[orders][debug] executando query.in stripe_payment_intent_id com:", paymentIntentIds);
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

  console.log("[orders][debug] orders result:", orders);

  const result = orders ?? [];

  // Calcula métricas agregadas no backend
  const totalSpent = result.reduce((sum, o) => sum + Number(o.amount_usd ?? 0), 0);
  const totalPurchases = result.length;

  console.log("[orders][debug] orders retornadas:", totalPurchases, "| totalSpent: $" + totalSpent.toFixed(2));

  return NextResponse.json({
    success: true,
    orders: result,
    totalSpent,
    totalPurchases,
  });
}
