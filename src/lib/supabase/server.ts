/**
 * src/lib/supabase/server.ts
 * Cliente Supabase para uso em Server Components, Route Handlers e Server Actions.
 * Gerencia sessão via cookies (SSR-safe).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Em Server Components, set de cookie é ignorado (só Route Handlers podem setar)
          }
        },
      },
    }
  );
}

/**
 * Cliente com service role key — bypassa RLS.
 * Usar APENAS em operações server-side críticas (criar wallet, etc.)
 * NUNCA expor no frontend.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
