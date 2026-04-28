"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User, Session, AuthChangeEvent, Provider } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithMagicLink: (email: string, nextPath?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (nextPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signInWithMagicLink: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
});

/**
 * Retorna a URL base do site.
 * Em produção, usa NEXT_PUBLIC_SITE_URL (deve ser o domínio Vercel sem barra no final).
 * Em dev, usa http://localhost:3000.
 */
const getSiteUrl = (): string => {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  url = url.startsWith("http") ? url : `https://${url}`;
  return url.replace(/\/$/, "");
};

/**
 * Monta a URL de callback para OAuth/Magic Link.
 * SEMPRE aponta para /api/auth/callback, que é o único lugar que troca
 * o code PKCE por uma sessão real. Depois redireciona para `nextPath`.
 */
const buildCallbackUrl = (nextPath = "/dashboard"): string => {
  const base = getSiteUrl();
  const next = encodeURIComponent(nextPath);
  return `${base}/api/auth/callback?next=${next}`;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carrega sessão inicial
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    // Escuta mudanças de auth (login, logout, refresh, OAuth callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Auto-provisiona wallet Solana após login bem-sucedido
        if (event === "SIGNED_IN" && session?.user) {
          // Fire-and-forget: não bloqueia o fluxo de auth
          fetch("/api/auth/provision-wallet", { method: "POST" }).catch(() => {
            // Silencioso — wallet será criada na próxima vez que o usuário acessar o dashboard
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  /**
   * Magic Link — sem senha, link no email.
   * O link do email vai para /api/auth/callback?next=<nextPath>
   * que troca o code PKCE e redireciona para o destino.
   */
  const signInWithMagicLink = useCallback(
    async (email: string, nextPath = "/dashboard") => {
      const callbackUrl = buildCallbackUrl(nextPath);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });
      return { error: error?.message ?? null };
    },
    [supabase.auth]
  );

  /**
   * Google OAuth — PKCE flow.
   * redirectTo DEVE ser /api/auth/callback para trocar o code no servidor.
   * Depois redireciona para nextPath.
   */
  const signInWithGoogle = useCallback(
    async (nextPath = "/dashboard") => {
      const callbackUrl = buildCallbackUrl(nextPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google" as Provider,
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      return { error: error?.message ?? null };
    },
    [supabase.auth]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase.auth]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signInWithMagicLink, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext);
}
