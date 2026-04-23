"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import BuyWidget, { type CreatorContext } from "@/components/BuyWidget";
import CreatorCard, { type CreatorProfile } from "@/components/CreatorCard";
import LiveFeedWidget from "@/components/LiveFeedWidget";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Zap } from "lucide-react";

export default function DemoPage() {
  const [selectedCreator, setSelectedCreator] = useState<CreatorContext | null>(null);

  const handleCreatorSelected = (creator: CreatorProfile, tokenMint: string | null) => {
    setSelectedCreator({
      displayName: creator.displayName,
      avatarUrl: creator.avatarUrl,
      wallet: creator.wallet,
      provider: creator.provider,
      tokenMint,
      royaltyPercent: creator.royaltyPercent,
    });
  };

  return (
    <main className="min-h-screen bg-[var(--color-brand-bg-1)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--color-brand-primary)]/10 via-[var(--color-brand-bg-1)] to-[var(--color-brand-bg-1)] flex flex-col pt-24 pb-16">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-6 w-full">
        {/* Page Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 text-[var(--color-brand-primary)] text-xs font-bold uppercase tracking-widest mb-4"
          >
            <Zap className="w-3 h-3" />
            BagxPress v8.1 — Real Product Mode
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl lg:text-5xl font-geist font-bold text-white mb-3 text-glow"
          >
            The 10-Second Web3 Onboarding
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--color-text-secondary)] text-lg font-sans max-w-xl mx-auto"
          >
            Search for a Bags creator, select them, and buy their token without a wallet. Directly from your credit card.
          </motion.p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Column 1: Creator Search */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              {/* Decorative top bar */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)]" />
              
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-brand-primary)]/20 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-[var(--color-brand-primary)]" />
                </div>
                <h2 className="text-white font-bold text-sm">Search Bags Creator</h2>
              </div>

              <CreatorCard onCreatorSelected={handleCreatorSelected} />
            </div>

            {/* Live Status Panel */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 flex justify-center lg:justify-start"
            >
              <LiveFeedWidget />
            </motion.div>
          </motion.div>

          {/* Column 2-3: Buy Widget */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            {/* Context banner when creator is selected */}
            <AnimatePresence>
              {selectedCreator && (
                <motion.div
                  key="context-banner"
                  initial={{ opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -12, height: 0 }}
                  className="mb-4 p-3 rounded-2xl bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/30 flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse" />
                  <span className="text-sm text-white font-medium">
                    Buying token from{" "}
                    <span className="text-[var(--color-brand-primary)] font-bold">
                      @{selectedCreator.displayName}
                    </span>
                    {selectedCreator.tokenMint && (
                      <span className="text-gray-500 text-xs ml-2 font-mono">
                        ({selectedCreator.tokenMint.slice(0, 8)}...)
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setSelectedCreator(null)}
                    className="ml-auto text-gray-500 hover:text-white text-xs transition-colors"
                  >
                    ✕ Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <BuyWidget creatorContext={selectedCreator} />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
