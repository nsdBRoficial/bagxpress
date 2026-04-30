"use client";

/**
 * AuthButton — Botão de autenticação unificado.
 * v2.0 — Winner Hackathon Build
 *
 * Fluxos ativos:
 *   - Phantom Wallet (fluxo principal)
 *   - Magic Link / Email (fallback funcional)
 *   - Guest (permitido, claim posterior)
 *
 * Fluxos desabilitados (SOON):
 *   - Google OAuth (em breve)
 *   - Passkey / WebAuthn (em breve)
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePhantom } from "@/contexts/PhantomContext";
import {
  Loader2, LogOut, User, Mail, CheckCircle2, X,
  Wallet, Zap, ChevronRight, ChevronDown, Fingerprint,
} from "lucide-react";

// -----------------------------------------------------------------------
// Phantom SVG Icon inline
// -----------------------------------------------------------------------

function PhantomIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="url(#pg)" />
      <path
        d="M110.584 64.914H99.142C99.142 41.765 80.173 23 56.772 23 33.953 23 15.424 40.911 14.432 63.407 13.383 87.364 33.292 107 57.558 107H60.585C81.816 107 106.664 92.408 111.5 72.168 112.107 69.715 110.584 64.914 110.584 64.914Z"
        fill="white"
      />
      <path d="M47.78 75.219c0 2.235-1.819 4.045-4.064 4.045-2.246 0-4.064-1.81-4.064-4.045v-8.766c0-2.235 1.818-4.045 4.064-4.045 2.245 0 4.064 1.81 4.064 4.045v8.766Z" fill="#AB9FF2" />
      <path d="M63.914 75.219c0 2.235-1.818 4.045-4.064 4.045-2.245 0-4.064-1.81-4.064-4.045v-8.766c0-2.235 1.819-4.045 4.064-4.045 2.246 0 4.064 1.81 4.064 4.045v8.766Z" fill="#AB9FF2" />
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#534BB1" />
          <stop offset="1" stopColor="#551BF9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// -----------------------------------------------------------------------
// Google Icon
// -----------------------------------------------------------------------

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// -----------------------------------------------------------------------
// Phantom Wallet State Button (na navbar quando conectado)
// -----------------------------------------------------------------------

function PhantomNavButton() {
  const { publicKey, disconnect } = usePhantom();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!publicKey) return null;

  const short = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative">
      <button
        id="phantom-nav-btn"
        onClick={() => setShowDropdown((p) => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#AB9FF2]/10 border border-[#AB9FF2]/30 text-sm text-white hover:bg-[#AB9FF2]/20 transition-colors"
      >
        <PhantomIcon size={14} />
        <span className="font-mono text-xs">{short}</span>
        <ChevronDown className={`w-3 h-3 text-[#AB9FF2] transition-transform ${showDropdown ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {showDropdown && (
          <>
            {/* Backdrop para Click Outside - fixo em toda a tela para interceptar o clique */}
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setShowDropdown(false)}
            />
            {/* O próprio Dropdown - z-index acima do backdrop */}
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-[101] w-56 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header com endereço */}
              <div className="p-4 bg-white/5 border-b border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  <p className="text-[10px] text-[#AB9FF2] font-bold uppercase tracking-widest">
                    Phantom Connected
                  </p>
                </div>
                <p className="text-xs text-white/70 font-mono truncate">{publicKey}</p>
              </div>

              {/* Ações do Menu */}
              <div className="p-2 flex flex-col gap-1">
                <Link
                  href="/dashboard"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <User className="w-4 h-4 text-cyan-400" />
                  Go to Dashboard
                </Link>

                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Wallet className="w-4 h-4 text-violet-400" />}
                  {copied ? "Address Copied!" : "Copy Address"}
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button
                  onClick={async () => {
                    await disconnect();
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Wallet
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// -----------------------------------------------------------------------
// Main AuthButton
// -----------------------------------------------------------------------

export default function AuthButton() {
  const { user, loading, signInWithMagicLink, signInWithGoogle, signOut } = useAuth();
  const { connected, publicKey, connect, connecting, mounted, isPhantomInstalled } = usePhantom();

  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<"menu" | "email">("menu");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    setShowModal(false);
    setEmailSent(false);
    setEmail("");
    setError(null);
    setView("menu");
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const { error } = await signInWithMagicLink(email.trim());
    if (error) {
      setError(error);
    } else {
      setEmailSent(true);
    }
    setIsSubmitting(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setGoogleLoading(false);
    }
    // Se não tiver erro, o Supabase redireciona — não precisa resetar loading
  };

  const handlePhantomConnect = async () => {
    await connect();
    // Fecha o modal somente após connect resolver (connected virá via context)
    // Usamos um timeout pequeno para garantir que o state propagou
    setTimeout(() => closeModal(), 150);
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading || !mounted) {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
    );
  }

  // ─── Usuário logado via Supabase ───────────────────────────────────────────
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <span className="max-w-[120px] truncate">
            {user.email?.split("@")[0]}
          </span>
        </Link>
        {/* Phantom também conectada? Mostra botão */}
        {connected && publicKey && <PhantomNavButton />}
        <button
          onClick={signOut}
          title="Sign out"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ─── Phantom conectada (sem Supabase) ─────────────────────────────────────
  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <PhantomNavButton />
      </div>
    );
  }

  // ─── Não autenticado ──────────────────────────────────────────────────────
  return (
    <>
      <button
        id="auth-sign-in-btn"
        onClick={() => setShowModal(true)}
        className="px-4 py-1.5 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
      >
        Sign In
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              key="modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative shadow-2xl"
            >
              {/* Top bar decorativa */}
              <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-3xl bg-gradient-to-r from-[#7c3aed] to-[#00bdae]" />

              {/* Fechar */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <AnimatePresence mode="wait">

                {/* ── EMAIL SENT ── */}
                {emailSent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-center gap-4 pt-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Check your email</h3>
                    <p className="text-gray-400 text-sm">
                      Sent a magic link to{" "}
                      <span className="text-white font-mono">{email}</span>.
                      <br />Click the link to sign in instantly.
                    </p>
                    <p className="text-xs text-gray-600">No password needed. Link expires in 24h.</p>
                    <button
                      onClick={() => { setEmailSent(false); setView("menu"); }}
                      className="text-xs text-gray-500 hover:text-white transition-colors mt-2"
                    >
                      ← Try another method
                    </button>
                  </motion.div>

                ) : view === "email" ? (
                  /* ── EMAIL FORM ── */
                  <motion.div
                    key="email-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <button
                      onClick={() => { setView("menu"); setError(null); }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors mb-5"
                    >
                      ← Back
                    </button>
                    <div className="flex flex-col items-center mb-6">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7c3aed]/30 to-[#00bdae]/30 border border-white/10 flex items-center justify-center mb-3">
                        <Mail className="w-5 h-5 text-[#00bdae]" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Continue with Email</h2>
                      <p className="text-gray-500 text-xs mt-1">We'll send a magic link — no password needed.</p>
                    </div>
                    <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          id="auth-email-input"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          autoFocus
                          className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)] transition-all"
                        />
                      </div>
                      {error && (
                        <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting || !email.trim()}
                        className="w-full py-3 rounded-xl bg-[var(--color-brand-primary)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <><Mail className="w-4 h-4" /> Send Magic Link</>
                        )}
                      </button>
                    </form>
                  </motion.div>

                ) : (
                  /* ── MENU PRINCIPAL ── */
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-7">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-bold text-white text-lg mb-3 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                        BXP
                      </div>
                      <h2 className="text-xl font-bold text-white">Sign in to BagxPress</h2>
                      <p className="text-gray-500 text-sm mt-1">Choose how to continue</p>
                    </div>

                    {error && (
                      <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 mb-4 text-center">
                        {error}
                      </p>
                    )}

                    <div className="flex flex-col gap-2.5">

                      {/* ── GOOGLE (SOON) ── */}
                      {/* PT-BR: Google Auth temporariamente desabilitado neste release */}
                      {/* EN: Google Auth temporarily disabled in this release */}
                      <div
                        title="Coming soon"
                        aria-disabled="true"
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/30 cursor-not-allowed opacity-40 select-none"
                      >
                        <GoogleIcon size={20} />
                        <span className="text-sm font-semibold text-gray-900 flex-1 text-left">
                          Continue with Google
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                          SOON
                        </span>
                      </div>

                      {/* ── EMAIL MAGIC LINK ── */}
                      <button
                        id="auth-email-btn"
                        onClick={() => setView("email")}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#7c3aed]/20 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-[#7c3aed]" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white font-semibold">Continue with Email</p>
                          <p className="text-[10px] text-gray-500">Magic link — no password</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </button>

                      {/* ── PHANTOM ── */}
                      <button
                        id="auth-phantom-btn"
                        onClick={handlePhantomConnect}
                        disabled={connecting}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#AB9FF2]/5 border border-[#AB9FF2]/20 hover:border-[#AB9FF2]/50 hover:bg-[#AB9FF2]/10 transition-all group disabled:opacity-60"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#534BB1] to-[#551BF9] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(171,159,242,0.3)]">
                          {connecting ? (
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          ) : (
                            <PhantomIcon size={16} />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white font-semibold">Continue with Phantom</p>
                          <p className="text-[10px] text-gray-500">
                            {isPhantomInstalled ? "Solana wallet detected" : "Install Phantom to use"}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#AB9FF2] transition-colors" />
                      </button>

                      {/* ── GUEST ── */}
                      <button
                        id="auth-guest-btn"
                        onClick={() => {
                          closeModal();
                          window.location.href = "/demo";
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm text-gray-300 font-semibold">Continue as Guest</p>
                          <p className="text-[10px] text-gray-600">No account needed · claim later</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
                      </button>

                      {/* ── PASSKEY (COMING SOON) ── */}
                      <div
                        title="Coming soon"
                        aria-disabled="true"
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/2 border border-white/5 cursor-not-allowed opacity-40 select-none"
                      >
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <Fingerprint className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm text-gray-500 font-semibold">Continue with Passkey</p>
                          <p className="text-[10px] text-gray-700">WebAuthn biometric</p>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-white/8 text-gray-500 px-2 py-0.5 rounded-full">
                          SOON
                        </span>
                      </div>
                    </div>

                    <p className="text-center text-[10px] text-gray-700 mt-6">
                      No password. No wallet required. We handle everything.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
