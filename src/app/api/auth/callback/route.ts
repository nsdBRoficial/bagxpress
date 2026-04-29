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
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  // Sanitizar o `next` param para evitar open redirect
  const safePath = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    // Criar a resposta de redirect com antecedência para injetar os cookies nela
    const response = NextResponse.redirect(new URL(safePath, request.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log(`[auth/callback] Session exchanged OK → redirecting to ${safePath}`);
      return response;
    }

    console.error("[auth/callback] Session exchange failed:", error.message);
  } else {
    console.warn("[auth/callback] No code param received — possible direct navigation");
  }

  // Em caso de erro, redireciona para home com o erro visível
  return NextResponse.redirect(
    new URL("/?error=auth_failed&error_description=Unable+to+complete+sign+in", request.url)
  );
}
