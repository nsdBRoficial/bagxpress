"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Server, Zap, CreditCard, Flame, ShieldCheck, 
  Activity, ExternalLink, Fingerprint, Coins,
  Clock, Lock, CheckCircle2, ChevronRight
} from "lucide-react";

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Transaction {
  tx_hash: string;
  is_real_tx: boolean;
  network: string;
  explorer_url: string | null;
}

interface Order {
  id: string;
  amount_usd: number;
  token_mint: string | null;
  creator_handle: string | null;
  status: string;
  created_at: string;
  transactions: Transaction[];
}

interface Metrics {
  avgResponse: number;
  burnedTokens: number;
  treasuryBalance: number;
  oraclePrice: number;
  lastTxHash: string | null;
  lastTxExplorerUrl: string | null;
}

interface FeedResponse {
  success: boolean;
  data: Order[];
  metrics?: Metrics;
}

const AnimatedValue = ({ value, suffix = "", prefix = "", decimals = 0 }: { value: number, suffix?: string, prefix?: string, decimals?: number }) => (
  <AnimatePresence mode="popLayout">
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.2 }}
      className="inline-block"
    >
      {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </motion.span>
  </AnimatePresence>
);

export default function LiveFeedWidget() {
  const { data, isValidating } = useSWR<FeedResponse>("/api/feed", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const orders = data?.data ?? [];
  const metrics = data?.metrics;

  const [timeSinceSync, setTimeSinceSync] = useState(0);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      setTimeSinceSync(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  // Real metrics with fallbacks for initial load
  const avgResponse = metrics?.avgResponse ?? 0;
  const burnedTokens = metrics?.burnedTokens ?? 0;
  const treasuryBalance = metrics?.treasuryBalance ?? 0;
  const oraclePrice = metrics?.oraclePrice ?? 0;
  
  // Try to use the widget metrics last tx, fallback to latest order
  const latestTxHash = metrics?.lastTxHash ?? orders?.[0]?.transactions?.[0]?.tx_hash;
  const latestTxUrl = metrics?.lastTxExplorerUrl ?? orders?.[0]?.transactions?.[0]?.explorer_url;

  // Reset sync counter when data refreshes
  useEffect(() => {
    if (isValidating) setTimeSinceSync(0);
  }, [isValidating]);

  return (
    <div className="w-full max-w-[340px] sm:max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0C]/80 backdrop-blur-2xl shadow-[0_0_40px_rgba(124,58,237,0.15)] relative font-sans group">
      {/* Animated Glow Backgrounds */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--color-brand-primary)]/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-[var(--color-brand-primary)]/30 transition-colors duration-700" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[var(--color-brand-secondary)]/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-[var(--color-brand-secondary)]/30 transition-colors duration-700" />
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between relative z-10 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20">
            <Activity className="w-3.5 h-3.5 text-[var(--color-brand-primary)]" />
            <span className="absolute w-full h-full bg-[var(--color-brand-primary)] opacity-30 blur-md rounded-md animate-pulse" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-white tracking-wide">Live System Status</h3>
            <p className="text-[10px] text-white/40 font-mono flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> All Systems Nominal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-white/60">DEVNET</span>
            <div className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)]" />
          </div>
        </div>
      </div>

      {/* 2x2 Grid Panel */}
      <div className="grid grid-cols-2 gap-px bg-white/5 relative z-10">
        
        {/* 1. CORE NETWORK */}
        <div className="bg-[#0A0A0C] p-4 hover:bg-white/[0.02] transition-colors">
          <h4 className="text-[10px] font-bold text-white/40 mb-3 tracking-wider flex items-center gap-1.5 uppercase">
            <Server className="w-3 h-3 text-white/50" /> Core Network
          </h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">API Status</span>
              <span className="text-green-400 font-medium">Online</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">RPC Node</span>
              <span className="text-white font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-yellow-400" /> Helius
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Latency</span>
              <span className="text-white font-mono flex items-center gap-1">
                <AnimatedValue value={avgResponse} suffix="ms" />
              </span>
            </div>
          </div>
        </div>

        {/* 2. ZERO UX ENGINE */}
        <div className="bg-[#0A0A0C] p-4 hover:bg-white/[0.02] transition-colors">
          <h4 className="text-[10px] font-bold text-white/40 mb-3 tracking-wider flex items-center gap-1.5 uppercase">
            <Zap className="w-3 h-3 text-white/50" /> Zero UX Engine
          </h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Gasless Tx</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-brand-primary)]" />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Stripe Sync</span>
              <span className="text-white font-mono text-[10px] bg-[#635BFF]/20 text-[#635BFF] border border-[#635BFF]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CreditCard className="w-2.5 h-2.5" /> Active
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Ephemeral</span>
              <span className="text-white flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-white/80" />
              </span>
            </div>
          </div>
        </div>

        {/* 3. TOKENOMICS ENGINE */}
        <div className="bg-[#0A0A0C] p-4 hover:bg-white/[0.02] transition-colors">
          <h4 className="text-[10px] font-bold text-white/40 mb-3 tracking-wider flex items-center gap-1.5 uppercase">
            <Coins className="w-3 h-3 text-white/50" /> Tokenomics
          </h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">$SOL Oracle Price</span>
              <span className="text-[var(--color-brand-accent)] font-mono">
                <AnimatedValue value={oraclePrice} prefix="$" decimals={4} />
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Burned Total</span>
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-white font-mono">
                  <AnimatedValue value={burnedTokens} />
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Treasury</span>
              <span className="text-white font-mono flex items-center gap-1">
                <AnimatedValue value={treasuryBalance} suffix=" SOL" decimals={2} /> <ChevronRight className="w-3 h-3 text-white/40" />
              </span>
            </div>
          </div>
        </div>

        {/* 4. ON-CHAIN PROOF */}
        <div className="bg-[#0A0A0C] p-4 hover:bg-white/[0.02] transition-colors">
          <h4 className="text-[10px] font-bold text-white/40 mb-3 tracking-wider flex items-center gap-1.5 uppercase">
            <ShieldCheck className="w-3 h-3 text-white/50" /> On-Chain Proof
          </h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Mock Mode</span>
              <span className="text-red-400 font-mono text-[10px] bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">OFF</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Audit Hash</span>
              <Lock className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/60">Last Tx</span>
              {latestTxHash ? (
                <a 
                  href={latestTxUrl ?? `https://explorer.solana.com/tx/${latestTxHash}?cluster=devnet`} 
                  target="_blank" rel="noopener noreferrer"
                  className="text-white font-mono text-[10px] hover:text-[var(--color-brand-primary)] flex items-center gap-1 transition-colors"
                >
                  {latestTxHash.slice(0, 6)}... <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="text-white/40 font-mono text-[10px]">waiting...</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Banner */}
      <div className="px-4 py-3 bg-[var(--color-brand-primary)]/5 flex items-center justify-between border-t border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center p-1">
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white"><path d="M18.8 4.7l-4.5 4.5c-.8.8-2 .8-2.8 0l-1.5-1.5c-.8-.8-2-.8-2.8 0L2.7 12.2c-.8.8-.8 2 0 2.8l4.5 4.5c.8.8 2 .8 2.8 0l1.5-1.5c.8-.8 2-.8 2.8 0l4.5 4.5c.8.8 2 .8 2.8 0V4.7h-2.8z" fill="currentColor"/></svg>
            </div>
            <div className="w-5 h-5 rounded-full bg-[#635BFF] border border-white/20 flex items-center justify-center p-1">
              <CreditCard className="w-full h-full text-white" />
            </div>
            <div className="w-5 h-5 rounded-full bg-emerald-600 border border-white/20 flex items-center justify-center p-1">
              <Server className="w-full h-full text-white" />
            </div>
          </div>
          <span className="text-[10px] text-green-400/80 font-medium tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE ON-CHAIN DATA
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-white/40">
          <Clock className="w-3 h-3" />
          <span>Sync: {timeSinceSync}s ago</span>
        </div>
      </div>
    </div>
  );
}
