/**
 * middleware.ts
 * Supabase SSR middleware — renova o token de expiração do usuário a cada request.
 * Necessário para que a sessão persista corretamente no Next.js App Router.
 * Não bloqueia rotas — autenticação é opcional (usuário pode usar o app sem login).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Renova sessão silenciosamente — não redireciona rotas
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Aplica middleware a todas as rotas exceto assets estáticos e API de auth
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
