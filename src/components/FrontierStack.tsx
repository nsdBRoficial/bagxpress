"use client";

/**
 * FrontierStack — "Built With" section showcasing the frontier tech stack.
 * PT-BR: Seção que exibe as tecnologias de ponta usadas no BagxPress.
 * EN:    Section displaying the cutting-edge technologies powering BagxPress.
 */

import { motion } from "framer-motion";
import { ExternalLink, Zap } from "lucide-react";

interface StackItem {
  name: string;
  tagline: string;
  role: string;
  color: string;
  glowColor: string;
  href: string;
  icon: React.ReactNode;
}

const stack: StackItem[] = [
  {
    name: "Solana",
    tagline: "The Speed Layer",
    role: "Sub-second settlement & SPL token protocol",
    color: "#9945FF",
    glowColor: "rgba(153,69,255,0.25)",
    href: "https://solana.com",
    icon: (
      <svg viewBox="0 0 397.7 311.7" className="w-8 h-8">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol_a)" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol_b)" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol_c)" />
        <defs>
          <linearGradient id="sol_a" x1="360.9" y1="351.5" x2="141.2" y2="-69.1" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
          </linearGradient>
          <linearGradient id="sol_b" x1="264.8" y1="401.6" x2="45.2" y2="-19" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
          </linearGradient>
          <linearGradient id="sol_c" x1="312.5" y1="376.6" x2="92.9" y2="-44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Bags SDK",
    tagline: "The Creator Layer",
    role: "Real-time creator token discovery & routing",
    color: "#FF6B35",
    glowColor: "rgba(255,107,53,0.25)",
    href: "https://bags.fm",
    icon: (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B35] to-[#FFB347] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M6 2h12a2 2 0 012 2v1a2 2 0 01-1.5 1.937V19a2 2 0 01-2 2H7.5a2 2 0 01-2-2V6.937A2 2 0 014 5V4a2 2 0 012-2z" fill="white" opacity="0.9" />
          <rect x="9" y="9" width="6" height="1.5" rx="0.75" fill="#FF6B35" />
          <rect x="9" y="12" width="4" height="1.5" rx="0.75" fill="#FF6B35" />
        </svg>
      </div>
    ),
  },
  {
    name: "Helius",
    tagline: "The Data Layer",
    role: "Webhooks, RPC node & real-time burn events",
    color: "#F97316",
    glowColor: "rgba(249,115,22,0.25)",
    href: "https://helius.dev",
    icon: (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F97316] to-[#FBBF24] flex items-center justify-center">
        <Zap className="w-5 h-5 text-white" />
      </div>
    ),
  },
  {
    name: "Phantom",
    tagline: "The Wallet Layer",
    role: "Optional advanced Web3 wallet connect",
    color: "#AB9FF2",
    glowColor: "rgba(171,159,242,0.25)",
    href: "https://phantom.app",
    icon: (
      <svg viewBox="0 0 128 128" fill="none" className="w-8 h-8">
        <rect width="128" height="128" rx="28" fill="url(#ph_grad)" />
        <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.953 23 15.4236 40.9109 14.4322 63.4073C13.3827 87.3638 33.2924 107 57.558 107H60.5845C81.8156 107 106.664 92.4084 111.5 72.1682C112.107 69.7149 110.584 64.9142 110.584 64.9142Z" fill="white" />
        <path d="M47.78 75.22C47.78 77.45 45.96 79.26 43.72 79.26C41.47 79.26 39.65 77.45 39.65 75.22V66.45C39.65 64.22 41.47 62.41 43.72 62.41C45.96 62.41 47.78 64.22 47.78 66.45V75.22Z" fill="#AB9FF2" />
        <path d="M63.91 75.22C63.91 77.45 62.10 79.26 59.85 79.26C57.60 79.26 55.79 77.45 55.79 75.22V66.45C55.79 64.22 57.60 62.41 59.85 62.41C62.10 62.41 63.91 64.22 63.91 66.45V75.22Z" fill="#AB9FF2" />
        <defs>
          <linearGradient id="ph_grad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop stopColor="#534BB1" /><stop offset="1" stopColor="#551BF9" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Stripe",
    tagline: "The Payment Layer",
    role: "Invisible fiat onramp with PaymentIntents",
    color: "#635BFF",
    glowColor: "rgba(99,91,255,0.25)",
    href: "https://stripe.com",
    icon: (
      <div className="w-8 h-8 rounded-xl bg-[#635BFF] flex items-center justify-center">
        <svg viewBox="0 0 28 28" fill="none" className="w-5 h-5">
          <path d="M13.976 7.5C10.02 7.5 7.5 9.5 7.5 12.7c0 5.4 7.5 4.5 7.5 7 0 1-.9 1.8-2.4 1.8-2.2 0-4.7-1.1-4.7-1.1v3.5s2.2 1.1 4.8 1.1c4.1 0 6.8-2 6.8-5.4 0-5.5-7.5-4.6-7.5-7 0-.9.7-1.6 2-1.6 2 0 4.2.9 4.2.9V8.3s-1.9-.8-4.2-.8z" fill="white" />
        </svg>
      </div>
    ),
  },
  {
    name: "Vercel",
    tagline: "The Deploy Layer",
    role: "Edge-first deployment & CDN infrastructure",
    color: "#ffffff",
    glowColor: "rgba(255,255,255,0.15)",
    href: "https://vercel.com",
    icon: (
      <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center">
        <svg viewBox="0 0 76 65" fill="none" className="w-5 h-4">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="white" />
        </svg>
      </div>
    ),
  },
];

export default function FrontierStack() {
  return (
    <section id="frontier-stack" className="w-full py-24 px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.06)_0%,_transparent_70%)]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Zap className="w-3 h-3 text-[var(--color-brand-primary)]" />
            Built With Frontier Stack
          </div>
          <h2 className="text-4xl lg:text-5xl font-geist font-bold text-white mb-4">
            No Compromise Stack
          </h2>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
            Every layer chosen for production-grade performance, developer experience,
            and Solana ecosystem alignment.
          </p>
        </motion.div>

        {/* Stack grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stack.map((item, i) => (
            <motion.a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-[#0a0a0a] border border-white/8 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 overflow-hidden"
              style={{
                boxShadow: `0 0 0 rgba(0,0,0,0)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 40px ${item.glowColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 rgba(0,0,0,0)`;
              }}
            >
              {/* Glow accent */}
              <div
                className="absolute top-0 inset-x-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }}
              />

              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="shrink-0">{item.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{item.name}</span>
                    <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: item.color }}
                  >
                    {item.tagline}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.role}</p>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-gray-600 mt-10"
        >
          Every piece battle-tested in production • Colosseum Hackathon 2026
        </motion.p>
      </div>
    </section>
  );
}
