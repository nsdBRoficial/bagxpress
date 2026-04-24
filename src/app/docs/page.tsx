"use client";

import { motion } from "framer-motion";
import { Book, Shield, Zap, TrendingUp, Layers, Rocket, Globe, Code2 as Github, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  const sections = [
    {
      id: "intro",
      title: "1. What is BagxPress",
      icon: Book,
      content: "BagxPress is the 'Invisible Checkout Layer' for the Solana creator ecosystem. We bridge the gap between Web2 payment convenience and Web3 asset ownership. By removing the need for seed phrases, gas management, and complex wallet setups, we enable creators to sell their social tokens directly to their audience via standard fiat payment methods."
    },
    {
      id: "problem",
      title: "2. Problem We Solve",
      icon: Shield,
      content: "Traditional Web3 onboarding is broken. 95% of Web2 fans drop off when they encounter phrases like 'seed phrase', 'gas fees', or 'private key'. BagxPress eliminates these barriers by using Passkeys for security and Stripe/PIX for payments, executing real on-chain transactions behind the scenes without the user ever feeling the friction of blockchain."
    },
    {
      id: "flow",
      title: "3. Zero-UX Flow",
      icon: Zap,
      content: "Our flow is simple: User selects a token -> Connects via Passkey/Social -> Pays with Card/Apple Pay -> Done. Behind the scenes, BagxPress creates a secure non-custodial wallet (via Bags SDK), swaps fiat for SOL, and executes the token purchase on Raydium/Jupiter. The assets are real, the wallet is real, but the friction is zero."
    },
    {
      id: "tokenomics",
      title: "4. Tokenomics ($BXP)",
      icon: TrendingUp,
      content: "The $BXP token is the backbone of the protocol. It has a fixed supply of 10,000,000 units. Every transaction on the platform generates revenue, which is used for a 50/50 Flywheel: 50% is used for market buybacks and permanent burning (deflation), and 50% goes to the Protocol Treasury for growth and ecosystem incentives."
    },
    {
      id: "revenue",
      title: "5. Revenue Model",
      icon: Layers,
      content: "BagxPress charges a small protocol fee on every transaction. Additionally, we capture spread from fiat-to-crypto conversions. This revenue directly feeds the $BXP burn engine, creating a direct correlation between platform usage and token scarcity."
    },
    {
      id: "tech",
      title: "6. Tech Stack",
      icon: Rocket,
      content: "Built on the frontier of Solana development: Next.js 15, Tailwind CSS, Framer Motion, Solana Web3.js, Bags SDK (for secure wallet abstraction), and Helius (for real-time on-chain data indexing)."
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg-1)] pt-32 pb-24">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-brand-primary)]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-brand-secondary)]/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-brand-accent)]">Official Whitepaper</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-geist font-bold mb-6 text-glow">BagxPress Docs</h1>
          <p className="text-xl text-[var(--color-text-secondary)] leading-relaxed">
            The invisible checkout layer for creator tokens. Scaling Web3 to the next billion users.
          </p>
        </motion.div>

        <div className="space-y-12">
          {sections.map((section, idx) => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-panel p-8 md:p-10 border-white/5 hover:border-white/10 transition-all group"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--color-brand-primary)]/20 to-[var(--color-brand-secondary)]/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                  <section.icon className="w-6 h-6 text-[var(--color-brand-primary)]" />
                </div>
                <h2 className="text-2xl font-geist font-bold text-white">{section.title}</h2>
              </div>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed font-sans">
                {section.content}
              </p>
            </motion.section>
          ))}
        </div>

        {/* Action Links */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          <Link href="/demo" className="flex items-center justify-between p-6 rounded-2xl glass-panel border-[var(--color-brand-primary)]/20 hover:bg-[var(--color-brand-primary)]/5 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand-primary)]/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[var(--color-brand-primary)]" />
              </div>
              <div>
                <div className="font-bold text-white">Live Demo</div>
                <div className="text-sm text-white/50">Test the zero-UX flow</div>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-white/20 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>

          <a 
            href="https://github.com/nsdBRoficial/bagxpress" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-6 rounded-2xl glass-panel border-white/10 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <Github className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white">GitHub</div>
                <div className="text-sm text-white/50">Explore the source code</div>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-white/20 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </a>
        </motion.div>

        <footer className="mt-24 pt-12 border-t border-white/5 text-center text-white/30 text-sm">
          BagxPress Protocol — v9.1.0 — Solana Frontier
        </footer>
      </div>
    </div>
  );
}
