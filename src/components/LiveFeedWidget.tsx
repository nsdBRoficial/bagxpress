"use client";

import React from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ExternalLink, Flame, RefreshCw } from "lucide-react";

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

export default function LiveFeedWidget() {
  const { data, error, isLoading, isValidating } = useSWR<{ success: boolean; data: Order[] }>("/api/feed", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const orders = data?.data ?? [];

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-primary)]/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Activity className="w-4 h-4 text-[var(--color-brand-primary)]" />
            <span className="absolute w-full h-full bg-[var(--color-brand-primary)] opacity-40 blur-md rounded-full animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-wide">Live Protocol Status</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50 font-mono">
          {isValidating && <RefreshCw className="w-3 h-3 animate-spin" />}
          <span>On-Chain</span>
        </div>
      </div>

      {/* Feed Area */}
      <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar relative z-10 space-y-3">
        {isLoading && orders.length === 0 ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                  <div className="h-2 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-red-400 text-center py-4">Failed to load feed.</div>
        ) : orders.length === 0 ? (
          <div className="text-xs text-white/50 text-center py-4">No recent activity.</div>
        ) : (
          <AnimatePresence initial={false}>
            {orders.map((order) => {
              const tx = order.transactions?.[0];
              const isBurn = false; // Add logic if order represents a burn vs buy
              
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--color-brand-primary)]/20 flex items-center justify-center text-[10px]">
                        🛍️
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">
                          Purchased <span className="text-[var(--color-brand-primary)]">${order.amount_usd.toFixed(2)}</span>
                        </p>
                        <p className="text-[10px] text-white/50 font-mono mt-0.5">
                          {order.creator_handle ? `@${order.creator_handle}` : "BagxPress Pass"}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/40">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>

                  {tx?.tx_hash && (
                    <div className="flex items-center justify-between mt-1 pl-8">
                      <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--color-brand-primary)]/20">
                        <Flame className="w-3 h-3" />
                        <span>Real On-Chain</span>
                      </div>
                      
                      <a
                        href={tx.explorer_url ?? `https://explorer.solana.com/tx/${tx.tx_hash}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <span className="font-mono">{tx.tx_hash.slice(0, 8)}...</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
