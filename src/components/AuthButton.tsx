"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Loader2, LogOut, User, Mail, CheckCircle2, X } from "lucide-react";

export default function AuthButton() {
  const { user, loading, signInWithMagicLink, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
    );
  }

  // Usuário logado
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

  // Usuário não logado
  return (
    <>
      <button
        id="auth-sign-in-btn"
        onClick={() => setShowModal(true)}
        className="px-4 py-1.5 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
      >
        Sign In
      </button>

      {/* Modal de login */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                setEmailSent(false);
                setEmail("");
                setError(null);
              }
            }}
          >
            <motion.div
              key="modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative shadow-2xl"
            >
              {/* Barra decorativa topo */}
              <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-3xl bg-gradient-to-r from-[#7c3aed] to-[#00bdae]" />

              {/* Botão fechar */}
              <button
                onClick={() => {
                  setShowModal(false);
                  setEmailSent(false);
                  setEmail("");
                  setError(null);
                }}
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
                    <div className="flex flex-col items-center mb-7">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-bold text-white text-lg mb-3">
                        BXP
                      </div>
                      <h2 className="text-xl font-bold text-white">Sign in to BagxPress</h2>
                      <p className="text-gray-400 text-sm mt-1">Your wallet is waiting.</p>
                    </div>

                    <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
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
