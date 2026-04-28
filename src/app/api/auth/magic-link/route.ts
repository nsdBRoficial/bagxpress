import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/magic-link
 * Envia um magic link para o email fornecido.
 *
 * Body: { email: string, nextPath?: string }
 *
 * O emailRedirectTo SEMPRE aponta para /api/auth/callback?next=<nextPath>
 * para garantir que o PKCE code seja trocado no servidor antes de redirecionar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, nextPath } = body as { email?: string; nextPath?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
    const destination = nextPath ?? "/dashboard";
    const callbackUrl = `${siteUrl}/api/auth/callback?next=${encodeURIComponent(destination)}`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
