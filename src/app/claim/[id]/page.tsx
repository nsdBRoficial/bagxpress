"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Wallet,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";

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

export default function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phantomConnecting, setPhantomConnecting] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    txHash: string;
    explorerUrl: string;
  } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  // Carregar estado do claim
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

  // Calcular dias restantes
  const daysRemaining = claim
    ? Math.max(
        0,
        Math.floor(
          (new Date(claim.expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Handler: Phantom connect & claim
  const handlePhantomClaim = async () => {
    setPhantomConnecting(true);
    setClaimError(null);
    try {
      const phantom = (window as any)?.solana;
      if (!phantom?.isPhantom) {
        throw new Error(
          "Phantom wallet not detected. Please install Phantom extension."
        );
      }
      await phantom.connect();
      const publicKey: string = phantom.publicKey.toBase58();

      // Sign a deterministic message to prove ownership
      const message = `BagxPress Claim: ${id} | Wallet: ${publicKey}`;
      const encoded = new TextEncoder().encode(message);
      const { signature } = await phantom.signMessage(encoded, "utf8");
      const signatureHex = Buffer.from(signature).toString("hex");

      // Resolve claim
      setClaimLoading(true);
      const res = await fetch(`/api/claim/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationWallet: publicKey,
          publicKey,
          signature: signatureHex,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Claim failed.");

      setClaimResult({ txHash: data.txHash, explorerUrl: data.explorerUrl });
      setClaim((prev) => prev ? { ...prev, claimed: true, claimed_by: publicKey } : prev);
    } catch (err: any) {
      setClaimError(err.message ?? "Unknown error.");
    } finally {
      setPhantomConnecting(false);
      setClaimLoading(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </main>
    );
  }

  if (error || !claim) {
    return (
      <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex items-center justify-center px-6">
        <div className="glass-panel p-12 max-w-md w-full text-center">
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

  return (
    <main className="min-h-screen bg-[var(--color-brand-bg-1)] text-white font-geist flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/15 via-cyan-600/5 to-transparent blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* Success State */}
        <AnimatePresence>
          {(claim.claimed || claimResult) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-10 text-center border-green-500/20 bg-green-500/5"
            >
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-3xl font-black mb-2">Tokens Claimed!</h1>
              <p className="text-white/50 mb-2">
                <span className="text-white font-bold">{Number(claim.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} BXP</span>{" "}
                transferred to your wallet.
              </p>
              {(claimResult?.explorerUrl) && (
                <Link
                  href={claimResult.explorerUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-bold"
                >
                  View Transaction <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              {claim.claimed && !claimResult && claim.claimed_by && (
                <p className="text-xs text-white/30 mt-4 font-mono">
                  Already claimed by {claim.claimed_by.slice(0, 8)}...{claim.claimed_by.slice(-4)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Claim UI */}
        {!claim.claimed && !claimResult && (
          <>
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
              <p className="text-white/50 text-lg">
                Claim your assets safely before they expire.
              </p>
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
                <div className="text-xs text-white/30">
                  Expires {new Date(claim.expires_at).toLocaleDateString()}
                </div>
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

            {/* Auth Options */}
            {!claim.expired && (
              <div className="space-y-3">
                {/* Phantom */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handlePhantomClaim}
                  disabled={claimLoading || phantomConnecting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border border-violet-500/30 font-bold flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(claimLoading || phantomConnecting) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Wallet className="w-5 h-5" />
                  )}
                  {phantomConnecting ? "Connecting..." : claimLoading ? "Claiming..." : "Connect Phantom & Claim"}
                </motion.button>

                {/* Magic Link */}
                <button
                  disabled
                  className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 font-bold flex items-center justify-center gap-3 text-white/40 cursor-not-allowed"
                >
                  <Mail className="w-5 h-5" />
                  Magic Link
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full ml-auto">Coming Soon</span>
                </button>
              </div>
            )}

            {/* Claim Error */}
            {claimError && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
              >
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{claimError}</p>
              </motion.div>
            )}

            {/* Security Footer */}
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-white/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secured with AES-256-GCM · Zero Fake Data · BagxPress Protocol</span>
            </div>
          </>
        )}
      </motion.div>
    </main>
  );
}
