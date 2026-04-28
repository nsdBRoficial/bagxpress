"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { use } from "react";
import Link from "next/link";
import {
  ShieldCheck, Wallet, Mail, Clock, CheckCircle2, XCircle,
  ExternalLink, Loader2, Lock, AlertTriangle, Zap, User, Copy
} from "lucide-react";
import { usePhantom } from "@/contexts/PhantomContext";
import { useAuth } from "@/lib/auth/AuthProvider";

// Lazy-load canvas-confetti apenas no client
const fireConfetti = async () => {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors: ["#7c3aed", "#00bdae", "#ffffff", "#a78bfa"] });
    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ["#7c3aed", "#00bdae"] }), 300);
  } catch { /* silencioso se canvas-confetti não estiver instalado */ }
};

interface ClaimData {
  id: string;
  amount: number;
  token_mint: string;
  claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string;
  created_at: string;
  expired: boolean;
}

type ClaimStep = "idle" | "connecting" | "signing" | "processing" | "success" | "error";

// ─── Phantom SVG Icon ─────────────────────────────────────────────────────
function PhantomIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="url(#cpg)" />
      <path d="M110.584 64.914H99.142C99.142 41.765 80.173 23 56.772 23 33.953 23 15.424 40.911 14.432 63.407 13.383 87.364 33.292 107 57.558 107H60.585C81.816 107 106.664 92.408 111.5 72.168 112.107 69.715 110.584 64.914 110.584 64.914Z" fill="white" />
      <path d="M47.78 75.22c0 2.235-1.819 4.045-4.064 4.045-2.246 0-4.064-1.81-4.064-4.045v-8.766c0-2.235 1.818-4.045 4.064-4.045 2.245 0 4.064 1.81 4.064 4.045v8.766Z" fill="#AB9FF2" />
      <path d="M63.914 75.22c0 2.235-1.818 4.045-4.064 4.045-2.245 0-4.064-1.81-4.064-4.045v-8.766c0-2.235 1.819-4.045 4.064-4.045 2.246 0 4.064 1.81 4.064 4.045v8.766Z" fill="#AB9FF2" />
      <defs>
        <linearGradient id="cpg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#534BB1" /><stop offset="1" stopColor="#551BF9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Google Icon ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { publicKey, connected, connect, connecting, mounted } = usePhantom();
  const { user, signInWithGoogle } = useAuth();

  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [claimResult, setClaimResult] = useState<{ txHash: string; explorerUrl: string } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimStep, setClaimStep] = useState<ClaimStep>("idle");
  
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Carrega estado do claim
  useEffect(() => {
    fetch(`/api/claim/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setClaim(data);
      })
      .catch(() => setError("Failed to load claim data."))
      .finally(() => setLoading(false));
  }, [id]);

  const daysRemaining = claim
    ? Math.max(0, Math.floor((new Date(claim.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Handler: claim com Phantom
  const handlePhantomClaim = useCallback(async (existingKey?: string) => {
    setClaimError(null);
    setClaimStep("connecting");
    try {
      let walletKey = existingKey ?? publicKey;

      // Se não conectada ainda, conectar primeiro
      if (!walletKey) {
        await connect();
        // Aguarda o state propagar
        await new Promise((r) => setTimeout(r, 300));
        const phantom = (window as unknown as { solana?: { publicKey?: { toString: () => string } } }).solana;
        walletKey = phantom?.publicKey?.toString() ?? null;
        if (!walletKey) throw new Error("Phantom connection failed. Please try again.");
      }

      setClaimStep("signing");

      // Assina mensagem para provar ownership
      const phantom = (window as unknown as { solana?: { signMessage?: (msg: Uint8Array, enc: string) => Promise<{ signature: Uint8Array }> } }).solana;
      if (!phantom?.signMessage) throw new Error("Phantom not available.");

      const message = `BagxPress Claim: ${id} | Wallet: ${walletKey}`;
      const encoded = new TextEncoder().encode(message);
      const { signature } = await phantom.signMessage(encoded, "utf8");
      const signatureHex = Buffer.from(signature).toString("hex");

      setClaimStep("processing");

      const res = await fetch(`/api/claim/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationWallet: walletKey, publicKey: walletKey, signature: signatureHex, message }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Claim failed.");
      
      setClaimResult({ txHash: data.txHash, explorerUrl: data.explorerUrl });
      setClaim((prev) => prev ? { ...prev, claimed: true, claimed_by: walletKey as string } : prev);
      setClaimStep("success");
      await fireConfetti();
    } catch (err: unknown) {
      setClaimStep("error");
      setClaimError(err instanceof Error ? err.message : "Unknown error.");
    }
  }, [id, publicKey, connect]);

  // Handler: claim via sessão Supabase (Magic Link ou Google)
  const handleSessionClaim = useCallback(async () => {
    if (!user) return;
    setClaimError(null);
    setClaimStep("processing");
    try {
      const res = await fetch(`/api/claim/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationWallet: publicKey ?? undefined,
          publicKey: publicKey ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Claim failed.");
      
      setClaimResult({ txHash: data.txHash, explorerUrl: data.explorerUrl });
      setClaim((prev) => prev ? { ...prev, claimed: true } : prev);
      setClaimStep("success");
      await fireConfetti();
    } catch (err: unknown) {
      setClaimStep("error");
      setClaimError(err instanceof Error ? err.message : "Unknown error.");
    }
  }, [id, user, publicKey]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // nextPath vai para /api/auth/callback?next=/claim/[id] — troca PKCE no servidor
        body: JSON.stringify({ email: email.trim(), nextPath: `/claim/${id}` }),
      });
      if (res.ok) setEmailSent(true);
      else setClaimError("Failed to send magic link. Try again.");
    } catch {
      setClaimError("Network error. Try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(`/claim/${id}`);
    if (error) {
      setClaimError(error);
      setGoogleLoading(false);
    }
    // Supabase redireciona
  };

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-white/40 text-sm">Loading claim...</p>
        </div>
      </main>
    );
  }

  // ─── Error State / Not Found ──────────────────────────────────────────────
  if (error || !claim) {
    return (
      <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex items-center justify-center px-6">
        <div className="glass-panel p-12 max-w-md w-full text-center border-red-500/10">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">Claim Not Found</h1>
          <p className="text-white/50 mb-6">{error ?? "This claim link is invalid or expired."}</p>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-bold">
            ← Back to BagxPress
          </Link>
        </div>
      </main>
    );
  }

  // ─── Success State ────────────────────────────────────────────────────────
  if (claim.claimed || claimStep === "success") {
    return (
      <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex items-center justify-center px-6 py-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-green-600/10 to-transparent blur-[100px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative z-10 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(34,197,94,0.3)]"
          >
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </motion.div>

          <h1 className="text-4xl font-black text-white mb-2">Tokens Claimed!</h1>
          <p className="text-white/50 mb-6">
            <span className="text-white font-bold">
              {Number(claim.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} BXP
            </span>{" "}transferred successfully.
          </p>

          {claimResult?.txHash && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left relative group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Transaction Hash</p>
                <button onClick={() => copyHash(claimResult.txHash)} className="text-gray-500 hover:text-white transition-colors">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-[#00bdae] font-mono flex-1 truncate select-all">{claimResult.txHash}</code>
              </div>
            </div>
          )}

          {claim.claimed && !claimResult && claim.claimed_by && (
            <p className="text-xs text-white/30 mb-6 font-mono">
              Already claimed by {claim.claimed_by.slice(0, 8)}...{claim.claimed_by.slice(-4)}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {claimResult?.explorerUrl && (
              <a href={claimResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-sm">
                <ExternalLink className="w-4 h-4" /> View on Solana Explorer
              </a>
            )}
            <Link href="/dashboard"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#00bdae] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm shadow-[0_0_20px_rgba(124,58,237,0.3)]">
              <Wallet className="w-4 h-4" /> Go to Dashboard
            </Link>
            <Link href="/"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-2 inline-block">
              ← Back to BagxPress
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  // ─── Renderizing Claim Step Visuals ───────────────────────────────────────
  const isWorking = claimStep === "connecting" || claimStep === "signing" || claimStep === "processing";

  return (
    <main className="min-h-screen bg-[var(--color-brand-bg-1)] text-white flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/15 via-cyan-600/5 to-transparent blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* Vault Badge */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/20 border border-white/10 flex items-center justify-center shadow-[0_0_60px_rgba(139,92,246,0.3)]">
              <Lock className="w-10 h-10 text-violet-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-[var(--color-brand-bg-1)] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Your BXP is secured.
          </h1>
          <p className="text-white/50 text-lg">Claim your assets safely before they expire.</p>
        </div>

        {/* Amount Card */}
        <div className="glass-panel p-6 mb-6 flex items-center justify-between border-white/5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-1">Secured Amount</div>
            <div className="text-3xl font-black text-white">
              {Number(claim.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              <span className="text-lg text-cyan-400 ml-1.5">BXP</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-amber-400 text-sm font-bold justify-end mb-1">
              <Clock className="w-4 h-4" />
              {claim.expired ? "Expired" : `${daysRemaining}d remaining`}
            </div>
            <div className="text-xs text-white/30">Expires {new Date(claim.expires_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Expired Warning */}
        {claim.expired && (
          <div className="glass-panel p-4 mb-6 border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-400 text-sm">Claim Expired</div>
              <div className="text-white/50 text-xs mt-0.5">This claim is past its 30-day window. Contact support if you believe this is an error.</div>
            </div>
          </div>
        )}

        {/* Auth Options / Status */}
        {!claim.expired && (
          <div className="space-y-3 relative">
            
            <AnimatePresence mode="wait">
              {isWorking ? (
                <motion.div
                  key="working"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center min-h-[220px]"
                >
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"></div>
                    {claimStep === "signing" ? <Lock className="w-6 h-6 text-violet-400" /> : <Zap className="w-6 h-6 text-cyan-400" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      {claimStep === "connecting" && "Connecting Wallet..."}
                      {claimStep === "signing" && "Awaiting Signature..."}
                      {claimStep === "processing" && "Processing Transfer..."}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {claimStep === "connecting" && "Approve connection in Phantom."}
                      {claimStep === "signing" && "Please sign the secure message in your wallet."}
                      {claimStep === "processing" && "Confirming on Solana network. This takes a few seconds."}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="options"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* ── Auto-detect: Phantom já conectada ── */}
                  {mounted && connected && publicKey ? (
                    <button
                      onClick={() => handlePhantomClaim(publicKey)}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border border-violet-500/30 font-bold flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] group"
                    >
                      <PhantomIcon />
                      Claim with {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
                      <ChevronRight className="w-4 h-4 text-violet-300 ml-auto group-hover:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    /* ── Phantom não conectada: conectar e claim ── */
                    <button
                      onClick={() => handlePhantomClaim()}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border border-violet-500/30 font-bold flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] group"
                    >
                      <PhantomIcon />
                      Connect Phantom & Claim
                    </button>
                  )}

                  {/* ── Supabase logado: claim direto ── */}
                  {user && (
                    <button
                      onClick={handleSessionClaim}
                      className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/15 hover:border-white/30 font-bold flex items-center justify-center gap-3 transition-all"
                    >
                      <User className="w-5 h-5 text-[#00bdae]" />
                      Claim as {user.email?.split("@")[0]}
                    </button>
                  )}

                  {/* ── Google Sign In ── */}
                  {!user && (
                    <button
                      onClick={handleGoogle}
                      disabled={googleLoading}
                      className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-gray-100 font-semibold flex items-center justify-center gap-3 transition-all disabled:opacity-60 text-gray-900 text-sm"
                    >
                      {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-600" /> : <GoogleIcon />}
                      {googleLoading ? "Redirecting..." : "Sign in with Google & Claim"}
                    </button>
                  )}

                  {/* ── Email Magic Link ── */}
                  {!user && (
                    <div>
                      {!showEmailForm && !emailSent ? (
                        <button
                          onClick={() => setShowEmailForm(true)}
                          className="w-full py-3.5 px-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 font-bold flex items-center justify-center gap-3 transition-all text-sm"
                        >
                          <Mail className="w-5 h-5 text-[#7c3aed]" />
                          Sign in with Email & Claim
                        </button>
                      ) : emailSent ? (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full py-4 px-6 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3"
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-sm font-bold text-green-400">Magic link sent!</p>
                            <p className="text-xs text-white/40">Check your email — link returns to this claim page.</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.form
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          onSubmit={handleMagicLink}
                          className="flex flex-col gap-2"
                        >
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="your@email.com"
                              required
                              autoFocus
                              className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)] transition-all"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowEmailForm(false)}
                              className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors">
                              Cancel
                            </button>
                            <button type="submit" disabled={emailSubmitting || !email.trim()}
                              className="flex-1 py-2.5 rounded-xl bg-[var(--color-brand-primary)] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
                              {emailSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Magic Link"}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* Claim Error */}
        <AnimatePresence>
          {claimStep === "error" && claimError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
            >
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-400">Transfer Failed</p>
                <p className="text-xs text-red-300 mt-1">{claimError}</p>
                <button onClick={() => setClaimStep("idle")} className="text-xs font-bold text-red-400 hover:text-red-300 mt-2 underline">
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-white/30">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured with AES-256-GCM · Zero Fake Data · BagxPress Protocol</span>
        </div>
      </motion.div>
    </main>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
