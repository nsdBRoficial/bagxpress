"use client";

/**
 * /pitch — BagxPress Colosseum 2026 Pitch Page
 * PT-BR: Página de pitch orientada a juízes e investidores do hackathon.
 * EN:    Pitch page oriented to hackathon judges and investors.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Zap, Target, Lightbulb, BarChart3, Globe2, Clock,
  ArrowRight, CreditCard, Flame, ShieldCheck, Users, TrendingUp,
  ExternalLink, CheckCircle2, AlertCircle, DollarSign
} from "lucide-react";

// -----------------------------------------------------------------------
// Section wrapper
// -----------------------------------------------------------------------

function Section({
  id, label, icon: Icon, title, children, accent = "var(--color-brand-primary)"
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="w-full py-20 px-6 border-b border-white/5"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
          >
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</p>
            <h2 className="text-2xl lg:text-3xl font-geist font-bold text-white">{title}</h2>
          </div>
        </div>
        {children}
      </div>
    </motion.section>
  );
}

// -----------------------------------------------------------------------
// Stat card
// -----------------------------------------------------------------------

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/8 rounded-2xl p-6 text-center hover:border-white/15 transition-colors">
      <p className="text-3xl font-geist font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-[var(--color-brand-primary)] font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------
// Main Page
// -----------------------------------------------------------------------

export default function PitchPage() {
  const toc = [
    { href: "#problem", label: "Problem" },
    { href: "#solution", label: "Solution" },
    { href: "#demo", label: "Demo" },
    { href: "#tokenomics", label: "Tokenomics" },
    { href: "#market", label: "Market" },
    { href: "#why-now", label: "Why Now" },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-brand-bg-1)] flex flex-col pt-20">
      <Navbar />

      {/* ----------------------------------------------------------------
          HERO
      ---------------------------------------------------------------- */}
      <div className="relative w-full py-24 px-6 text-center border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.15)_0%,_transparent_70%)]" />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 text-[var(--color-brand-primary)] text-xs font-bold uppercase tracking-widest mb-6">
            <Zap className="w-3 h-3" />
            Colosseum Hackathon 2026 — Bags × Stripe Track
          </div>
          <h1 className="text-5xl lg:text-7xl font-geist font-bold text-white mb-6 leading-tight">
            The Invisible<br />
            <span className="bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] bg-clip-text text-transparent">
              Web3 Checkout
            </span>
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10">
            Convert Web2 fans into Web3 holders in{" "}
            <strong className="text-white">10 seconds</strong>{" "}
            — no wallet, no gas, no friction.
          </p>
          {/* TOC */}
          <nav className="flex flex-wrap justify-center gap-3">
            {toc.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-white/25 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </motion.div>
      </div>

      {/* ----------------------------------------------------------------
          PROBLEM
      ---------------------------------------------------------------- */}
      <Section id="problem" label="01 — Problem" icon={AlertCircle} title="Web3 Onboarding Is Broken" accent="#ef4444">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-6">
              99% of creator fans <strong className="text-white">never buy their favorite creator&apos;s token</strong>.
              Not because they don&apos;t want to — because the process is impossibly complex.
            </p>
            <div className="space-y-3">
              {[
                "Install a wallet extension (Phantom, MetaMask...)",
                "Buy SOL from an exchange (KYC, days to settle)",
                "Transfer SOL to wallet (fees, mistakes)",
                "Find the token on a DEX",
                "Approve 3+ transactions",
                "Hope you didn't get phished",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="text-gray-400">{step}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
              <p className="text-red-400 font-bold text-lg mb-2">The Cost of Friction</p>
              <div className="space-y-2 text-sm text-gray-400">
                <p>• <strong className="text-white">95%+</strong> drop-off rate in Web3 onboarding</p>
                <p>• Average <strong className="text-white">47 minutes</strong> to complete first crypto purchase</p>
                <p>• <strong className="text-white">$4.8B/year</strong> lost to failed crypto UX funnels</p>
              </div>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <p className="text-gray-300 font-semibold mb-2">The Creator Economy Gap</p>
              <p className="text-sm text-gray-500">
                Bags.fm creators have millions of fans who want to support them on-chain.
                None of them know what a wallet is.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------
          SOLUTION
      ---------------------------------------------------------------- */}
      <Section id="solution" label="02 — Solution" icon={Lightbulb} title="BagxPress: Zero-UX Protocol">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-8">
              BagxPress collapses the entire Web3 onboarding journey into{" "}
              <strong className="text-white">one seamless Stripe checkout</strong>.
              The user taps, pays, and the token lands on-chain. End-to-end.
            </p>

            {/* Flow */}
            <div className="space-y-1">
              {[
                { icon: Target, text: "Fan searches for their creator on Bags", color: "text-blue-400" },
                { icon: CreditCard, text: "Pays $5–$500 via Stripe (card, Apple Pay, GPay)", color: "text-[#635BFF]" },
                { icon: Zap, text: "BagxPress creates ephemeral wallet instantly", color: "text-yellow-400" },
                { icon: ShieldCheck, text: "Executes atomic swap: USD → SOL → Creator Token", color: "text-green-400" },
                { icon: Flame, text: "1.99% fee split: 50% operational / 50% BXP burn", color: "text-orange-400" },
                { icon: CheckCircle2, text: "Audit proof SHA-256 hash logged on-chain", color: "text-purple-400" },
              ].map(({ icon: Icon, text, color }, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors group">
                  <div className={`shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard value="~10s" label="Time to Token" sub="Card to on-chain" />
              <StatCard value="0" label="Wallets Required" sub="For the end user" />
              <StatCard value="1.99%" label="Protocol Fee" sub="50% burned forever" />
              <StatCard value="100%" label="Real On-Chain" sub="Zero mock mode" />
            </div>

            <div className="bg-[var(--color-brand-primary)]/5 border border-[var(--color-brand-primary)]/15 rounded-2xl p-5">
              <p className="text-[var(--color-brand-primary)] font-bold text-sm mb-2">The Zero-UX Guarantee</p>
              <p className="text-xs text-gray-400">
                No seed phrase. No gas estimate. No confirmation dialogs. No address copy-paste.
                Just a Stripe UI they already trust.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------
          DEMO
      ---------------------------------------------------------------- */}
      <Section id="demo" label="03 — Demo" icon={Zap} title="See It Live">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-[var(--color-text-secondary)] text-lg mb-6">
              Try the live protocol on Solana Devnet — real SPL tokens, real transactions,
              real on-chain settlement.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Search any Bags creator by handle or token mint",
                "Select amount ($5 minimum)",
                "Use test card: 4242 4242 4242 4242",
                "Watch execution steps & audit hash appear in real-time",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-brand-primary)]/20 border border-[var(--color-brand-primary)]/30 text-[var(--color-brand-primary)] flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <span className="text-gray-300">{step}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Link
                href="/demo"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(124,58,237,0.3)]"
              >
                Launch Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* On-chain addresses */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-3">Live On-Chain Addresses</p>
            {[
              { label: "BXP Token (SPL)", addr: "5xSwDXX...G6tRKL", net: "devnet" },
              { label: "CPMM Pool", addr: "3jygr64...ziAoy", net: "devnet" },
              { label: "Treasury", addr: "517XAb...sge9G", net: "devnet" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-black/30 border border-white/5 rounded-xl">
                <div>
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="text-xs font-mono text-white">{item.addr}</p>
                </div>
                <span className="text-[9px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-mono">
                  {item.net}
                </span>
              </div>
            ))}
            <a
              href="https://explorer.solana.com/address/5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[var(--color-brand-primary)] hover:underline mt-2"
            >
              View all on Solana Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------
          TOKENOMICS
      ---------------------------------------------------------------- */}
      <Section id="tokenomics" label="04 — Tokenomics" icon={Flame} title="BXP — Deflationary Protocol Token" accent="#f97316">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <p className="text-[var(--color-text-secondary)] text-lg">
              Every purchase on BagxPress contributes to a deflationary flywheel.
              The more fans buy creator tokens, the more BXP is permanently burned.
            </p>

            {/* Flywheel */}
            <div className="bg-[#0a0a0a] border border-white/8 rounded-2xl p-6">
              <p className="text-white font-bold mb-4">The Buyback/Burn Flywheel</p>
              <div className="space-y-3 text-sm">
                {[
                  { step: "Fan pays $10 for creator token", arrow: true },
                  { step: "$0.199 collected as protocol fee (1.99%)", arrow: true },
                  { step: "$0.10 → operational treasury", arrow: false },
                  { step: "$0.10 → buys BXP on Raydium CPMM", arrow: true },
                  { step: "BXP burned via burnChecked() on-chain 🔥", arrow: false },
                ].map((item, i) => (
                  <div key={i}>
                    <div className={`flex items-center gap-2 ${item.step.includes("burn") ? "text-orange-400" : "text-gray-400"}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      {item.step}
                    </div>
                    {item.arrow && <div className="ml-[3px] w-px h-3 bg-white/10" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard value="10M" label="Fixed Supply" sub="Mint authority revoked" />
              <StatCard value="0%" label="Inflation" sub="Hard cap enforced on-chain" />
              <StatCard value="50%" label="Fee → Burn" sub="Automatic per tx" />
              <StatCard value="9 SOL" label="Initial Liquidity" sub="Raydium CPMM Devnet" />
            </div>

            <div className="bg-orange-500/5 border border-orange-500/15 rounded-2xl p-5">
              <p className="text-orange-400 font-bold text-sm mb-2">Why Burn Matters</p>
              <p className="text-xs text-gray-400">
                As the Bags creator economy grows, more purchases = more burns.
                BXP supply decreases while demand from creators and fans increases —
                a reflexive value capture mechanism aligned with ecosystem growth.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------
          MARKET
      ---------------------------------------------------------------- */}
      <Section id="market" label="05 — Market" icon={BarChart3} title="A $400B+ Opportunity" accent="#00bdae">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <p className="text-[var(--color-text-secondary)] text-lg">
              The convergence of creator economy, DeFi, and payment infrastructure
              creates an unprecedented market window.
            </p>
            <div className="space-y-4">
              {[
                { label: "Global Creator Economy", value: "$250B+", sub: "Growing 20% YoY", icon: Users },
                { label: "Web3 Gaming & Tokens TAM", value: "$45B", sub: "Projected by 2027", icon: Globe2 },
                { label: "Crypto Onramp Volume", value: "$100B+", sub: "Annual via Coinbase, etc.", icon: DollarSign },
                { label: "Bags Platform Users", value: "2M+", sub: "Active creator fans", icon: TrendingUp },
              ].map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="flex items-center gap-4 p-4 bg-black/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-secondary)]/10 border border-[var(--color-brand-secondary)]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[var(--color-brand-secondary)]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-white font-bold">{value}</p>
                    <p className="text-[10px] text-gray-600">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-[var(--color-brand-secondary)]/5 border border-[var(--color-brand-secondary)]/15 rounded-2xl p-6">
              <p className="text-[var(--color-brand-secondary)] font-bold mb-3">BagxPress Addressable Market</p>
              <p className="text-gray-400 text-sm mb-4">
                Even 0.1% capture of creator economy transactions at $250B = $250M GMV/year.
                At 1.99% fee = <strong className="text-white">$4.97M ARR</strong>.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Year 1 Target GMV</span>
                  <span className="text-white font-mono">$5M</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Protocol Revenue (1.99%)</span>
                  <span className="text-white font-mono">$99.5K</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>BXP Burned (Year 1)</span>
                  <span className="text-orange-400 font-mono">~500K BXP</span>
                </div>
              </div>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-2">Competitive Moat</p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>✓ Exclusive Bags.fm creator token routing</p>
                <p>✓ Stripe as trust anchor (familiar to 4B+ users)</p>
                <p>✓ BXP burn aligns ecosystem incentives</p>
                <p>✓ Zero infrastructure cost to the creator</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------
          WHY NOW
      ---------------------------------------------------------------- */}
      <Section id="why-now" label="06 — Why Now" icon={Clock} title="The Perfect Storm" accent="#a855f7">
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {[
            {
              icon: Zap,
              title: "Solana's UX Renaissance",
              body: "Blinks, Actions, and compressed tokens are making Solana the #1 consumer blockchain. BagxPress leverages this infrastructure at the right moment.",
              color: "#9945FF",
            },
            {
              icon: CreditCard,
              title: "Stripe's Crypto Openness",
              body: "Stripe re-entered crypto payments in 2024 after a 6-year hiatus. Their Payment Intents API is now mature enough for real Web3 settlement flows.",
              color: "#635BFF",
            },
            {
              icon: Users,
              title: "Bags Creator Flywheel",
              body: "Bags.fm is building the largest creator token ecosystem on Solana. Their 2M+ users represent an untapped Web3 onboarding opportunity worth hundreds of millions.",
              color: "#FF6B35",
            },
          ].map(({ icon: Icon, title, body, color }) => (
            <div key={title} className="bg-[#0a0a0a] border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-colors">
              <div
                className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="text-white font-bold mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center py-10 border-t border-white/5">
          <h3 className="text-2xl font-geist font-bold text-white mb-3">
            Ready to See It in Action?
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Live on Solana Devnet. Real transactions. Real burns. Real protocol.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold text-lg shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_50px_rgba(124,58,237,0.6)] transition-all"
            >
              Launch Live Demo <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/nsdBRoficial/bagxpress"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
            >
              View Source <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
