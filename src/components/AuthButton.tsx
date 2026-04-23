"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePhantom } from "@/contexts/PhantomContext";
import { Loader2, LogOut, User, Mail, CheckCircle2, X, Wallet, Zap, ChevronRight } from "lucide-react";

// -----------------------------------------------------------------------
// Phantom Connect Button — visual compacto
// -----------------------------------------------------------------------

function PhantomConnectButton({ onClose }: { onClose: () => void }) {
  const { connect, connecting, connected, publicKey, disconnect, isPhantomInstalled } = usePhantom();

  if (connected && publicKey) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#AB9FF2]/10 border border-[#AB9FF2]/30">
          {/* Phantom gradient dot */}
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#ab9ff2] to-[#7c3aed] flex items-center justify-center shrink-0">
            <Wallet className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#AB9FF2] font-bold uppercase tracking-widest">Phantom Connected</p>
            <p className="text-xs text-white font-mono truncate">{publicKey.slice(0, 8)}...{publicKey.slice(-6)}</p>
          </div>
          <button onClick={async () => { await disconnect(); onClose(); }} className="text-gray-500 hover:text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onClose} className="text-[10px] text-center text-green-400 hover:text-green-300 transition-colors">
          ✓ Done — ready to use advanced features
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={async () => { await connect(); }}
      disabled={connecting}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#AB9FF2]/5 border border-[#AB9FF2]/20 hover:border-[#AB9FF2]/50 hover:bg-[#AB9FF2]/10 transition-all group"
    >
      {/* Phantom ghost icon */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ab9ff2] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(171,159,242,0.3)]">
        {connecting ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <svg viewBox="0 0 128 128" fill="none" className="w-4 h-4">
            <rect width="128" height="128" rx="32" fill="url(#phantom_grad)" />
            <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.953 23 15.4236 40.9109 14.4322 63.4073C13.3827 87.3638 33.2924 107 57.558 107H60.5845C81.8156 107 106.664 92.4084 111.5 72.1682C112.107 69.7149 110.584 64.9142 110.584 64.9142Z" fill="white" />
            <path d="M47.7803 75.2191C47.7803 77.4543 45.9617 79.2644 43.7163 79.2644C41.4709 79.2644 39.6523 77.4543 39.6523 75.2191V66.4529C39.6523 64.2177 41.4709 62.4076 43.7163 62.4076C45.9617 62.4076 47.7803 64.2177 47.7803 66.4529V75.2191Z" fill="#AB9FF2" />
            <path d="M63.9142 75.2191C63.9142 77.4543 62.0956 79.2644 59.8502 79.2644C57.6048 79.2644 55.7862 77.4543 55.7862 75.2191V66.4529C55.7862 64.2177 57.6048 62.4076 59.8502 62.4076C62.0956 62.4076 63.9142 64.2177 63.9142 66.4529V75.2191Z" fill="#AB9FF2" />
            <defs>
              <linearGradient id="phantom_grad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
                <stop stopColor="#534BB1" />
                <stop offset="1" stopColor="#551BF9" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm text-white font-semibold">Connect Phantom Wallet</p>
        <p className="text-[10px] text-gray-500">{isPhantomInstalled ? "Advanced users" : "Install Phantom to use this"}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#AB9FF2] transition-colors" />
    </button>
  );
}

// -----------------------------------------------------------------------
// Main AuthButton
// -----------------------------------------------------------------------

export default function AuthButton() {
  const { user, loading, signInWithMagicLink, signOut } = useAuth();
  const { connected, publicKey, disconnect: phantomDisconnect } = usePhantom();
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const { error } = await signInWithMagicLink(email.trim());
    if (error) {
      setError(error);
      setIsSubmitting(false);
    } else {
      setEmailSent(true);
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEmailSent(false);
    setEmail("");
    setError(null);
    setShowAdvanced(false);
  };

  if (loading) {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
    );
  }

  // User logged in via Supabase (Magic Link)
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <span className="max-w-[120px] truncate">
            {user.email?.split("@")[0]}
          </span>
        </a>
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

  // Phantom connected (but no Supabase session) — show wallet address in nav
  if (connected && publicKey && !user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#AB9FF2]/10 border border-[#AB9FF2]/30 text-sm text-white">
          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#ab9ff2] to-[#7c3aed]" />
          <span className="font-mono text-xs">{publicKey.slice(0, 6)}...{publicKey.slice(-4)}</span>
        </div>
        <button
          onClick={() => phantomDisconnect()}
          title="Disconnect Phantom"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Not logged in
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
              {/* Decorative top bar */}
              <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-3xl bg-gradient-to-r from-[#7c3aed] to-[#00bdae]" />

              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <AnimatePresence mode="wait">
                {emailSent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center gap-4"
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
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-bold text-white text-lg mb-3">
                        BXP
                      </div>
                      <h2 className="text-xl font-bold text-white">Sign in to BagxPress</h2>
                      <p className="text-gray-400 text-sm mt-1">Your wallet is waiting.</p>
                    </div>

                    {/* PRIMARY — Zero-UX Magic Link */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-[var(--color-brand-primary)]" />
                        <span className="text-[10px] text-[var(--color-brand-primary)] font-bold uppercase tracking-widest">Continue Instantly</span>
                        <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">recommended</span>
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
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="w-4 h-4" />
                              Send Magic Link
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* DIVIDER */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-white/8" />
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-white/8" />
                    </div>

                    {/* SECONDARY — Phantom (optional / advanced) */}
                    <AnimatePresence>
                      {!showAdvanced ? (
                        <motion.button
                          key="show-advanced"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowAdvanced(true)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-all group text-left"
                        >
                          <div className="w-8 h-8 rounded-xl bg-[#1a1a2e] border border-[#AB9FF2]/20 flex items-center justify-center shrink-0">
                            <Wallet className="w-4 h-4 text-[#AB9FF2]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-300 font-medium">Connect Phantom Wallet</p>
                            <p className="text-[10px] text-gray-600">Advanced users</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
                        </motion.button>
                      ) : (
                        <motion.div
                          key="phantom-expanded"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                        >
                          <PhantomConnectButton onClose={closeModal} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="text-center text-[10px] text-gray-600 mt-5">
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
