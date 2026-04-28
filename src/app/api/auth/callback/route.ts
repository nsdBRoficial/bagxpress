/**
 * GET /api/auth/callback
 *
 * Handler do OAuth/PKCE callback do Supabase.
 * Troca o `code` por uma sessão e redireciona para o destino via `next` param.
 *
 * FLUXO:
 * Google OAuth / Magic Link → Supabase → /api/auth/callback?code=...&next=/destino
 * → exchangeCodeForSession → redirect para /destino
 *
 * Suporta:
 * - Google OAuth (PKCE)
 * - Magic Link OTP
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Sanitizar o `next` param para evitar open redirect
  const safePath = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log(`[auth/callback] Session exchanged OK → redirecting to ${safePath}`);
      return NextResponse.redirect(`${origin}${safePath}`);
    }

    console.error("[auth/callback] Session exchange failed:", error.message);
  } else {
    console.warn("[auth/callback] No code param received — possible direct navigation");
  }

  // Em caso de erro, redireciona para home com o erro visível
  return NextResponse.redirect(
    `${origin}/?error=auth_failed&error_description=Unable+to+complete+sign+in`
  );
}
