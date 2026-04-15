import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeApiKey = process.env.STRIPE_SECRET_KEY || "mock_key";
// Typescript workaround for apiVersion since Stripe types can be strict
const stripe = stripeApiKey.startsWith("sk_") ? new Stripe(stripeApiKey, { apiVersion: "2024-06-20" as any }) : null;

export async function POST(req: Request) {
  try {
    const { amount, user_identifier } = await req.json();

    if (!amount) return NextResponse.json({ error: "Amount is required" }, { status: 400 });

    let orderId = `bxp_order_${Date.now()}`;
    let clientSecret = "mock_secret_123";

    if (stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.floor(amount * 100), // cents
          currency: 'usd',
          metadata: { user_identifier: user_identifier || 'anonymous' },
        });
        orderId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret || "";
      } catch (e: any) {
        console.warn("Stripe failed, falling back to mock:", e.message);
      }
    }

    // Mock network lag
    await new Promise(r => setTimeout(r, 600));

    return NextResponse.json({
      success: true,
      orderId,
      clientSecret,
      status: "created"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
