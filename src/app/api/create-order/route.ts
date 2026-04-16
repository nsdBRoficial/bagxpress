/**
 * POST /api/create-order
 *
 * Cria um PaymentIntent no Stripe e persiste a order no Supabase.
 * Associa ao usuário logado (se autenticado) ou cria como anônimo.
 *
 * Body: { amount: number, tokenMint?: string, creatorWallet?: string, creatorHandle?: string, creatorRoyaltyPercent?: number }
 * Response: { success: true, orderId, clientSecret, status }
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

const stripeApiKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeApiKey.startsWith("sk_")
  // @ts-expect-error - Mismatch version typing is allowed
  ? new Stripe(stripeApiKey, { apiVersion: "2024-06-20" })
  : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      tokenMint,
      creatorWallet,
      creatorHandle,
      creatorRoyaltyPercent,
    } = body;

    if (!amount) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    }

    // -----------------------------------------------------------------
    // 1. Identifica o usuário logado (opcional — funciona sem auth)
    // -----------------------------------------------------------------
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // -----------------------------------------------------------------
    // 2. Cria PaymentIntent no Stripe
    // -----------------------------------------------------------------
    let stripePaymentIntentId: string | null = null;
    let clientSecret = "mock_secret_123";

    if (stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.floor(amount * 100), // cents
          currency: "usd",
          metadata: {
            user_id: userId ?? "anonymous",
            token_mint: tokenMint ?? "",
            creator_handle: creatorHandle ?? "",
          },
        });
        stripePaymentIntentId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret ?? "mock_secret_123";
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[create-order] Stripe fallback:", message);
      }
    }

    // -----------------------------------------------------------------
    // 3. Persiste a order no Supabase (via admin para anônimos também)
    // -----------------------------------------------------------------
    const admin = createSupabaseAdminClient();
    const orderId = stripePaymentIntentId ?? `bxp_order_${Date.now()}`;

    const { error: dbError } = await admin.from("orders").insert({
      ...(userId ? { user_id: userId } : {}),
      stripe_payment_intent_id: orderId,
      amount_usd: amount,
      token_mint: tokenMint ?? null,
      creator_wallet: creatorWallet ?? null,
      creator_handle: creatorHandle ?? null,
      creator_royalty_percent: creatorRoyaltyPercent ?? 0,
      status: "pending",
    });

    if (dbError) {
      // Não bloqueia o fluxo — log e segue
      console.error("[create-order] DB insert error:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      orderId,
      clientSecret,
      status: "created",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[create-order] Unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
