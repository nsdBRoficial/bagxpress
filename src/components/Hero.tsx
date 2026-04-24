"use client";

import { motion } from "framer-motion";
import { ArrowRight, Zap, Target, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import LiveFeedWidget from "@/components/LiveFeedWidget";

const Hero3D = dynamic(() => import("@/components/Hero3D"), { ssr: false });

export default function Hero() {
  return (
    <section className="relative w-full min-h-screen pt-32 pb-16 overflow-hidden flex items-center justify-center">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--color-brand-primary)]/20 via-[var(--color-brand-bg-1)] to-[var(--color-brand-bg-1)] opacity-70 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
        
        {/* Left Content */}
        <div className="flex flex-col justify-center text-center lg:text-left pt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit mx-auto lg:mx-0 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)] animate-pulse" />
            <span className="text-sm font-medium text-white/80">Built on Solana & Bags SDK</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="font-geist text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6 text-glow"
          >
            Convert Web2 Fans Into <span className="gradient-text">Web3 Holders</span> in Seconds
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-lg sm:text-2xl text-[var(--color-text-secondary)] mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-sans"
          >
            <span className="text-white font-semibold">No wallet. No gas. No friction.</span><br />
            The invisible checkout layer for Bags. Buy creator tokens with PIX, Card or Apple Pay instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mx-auto lg:mx-0"
          >
            <Link href="/demo" className="w-full sm:w-auto group flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold text-lg shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] hover:scale-[1.02] transition-all">
              Launch Demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="https://github.com/nsdBRoficial/bagxpress" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full glass-panel text-white font-semibold hover:bg-white/10 transition-all border border-white/20"
            >
              View GitHub
            </a>
          </motion.div>

          {/* Micro Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6"
          >
            {[
              { icon: Zap, label: "ZeroUX Infrastructure" },
              { icon: ShieldCheck, label: "Passkeys Security" },
              { icon: Target, label: "Auto Buy Execution" },
            ].map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <badge.icon className="w-4 h-4 text-[var(--color-brand-accent)]" />
                {badge.label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Content - 3D Hero & Live Feed */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="relative h-[400px] lg:h-[600px] w-full hidden sm:flex flex-col items-center justify-center"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-brand-primary)]/10 to-transparent rounded-full blur-[100px]" />
          <Hero3D />

          {/* Live Feed Widget Floating */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="absolute -bottom-10 lg:bottom-10 right-0 lg:-right-4 z-20 w-full max-w-[320px]"
          >
            <LiveFeedWidget />
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
