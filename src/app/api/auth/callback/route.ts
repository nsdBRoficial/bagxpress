/**
 * GET /api/auth/callback
 *
 * Handler do OAuth callback do Supabase.
 * Troca o `code` por uma sessão de usuário e redireciona para o dashboard.
 * Funciona com Magic Link, Google OAuth e qualquer provider futuro.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] Session exchange failed:", error.message);
  }

  // Redireciona para login com parâmetro de erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
