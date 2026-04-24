"use client";

import { motion } from "framer-motion";
import { Flame, Landmark, Activity, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function Tokenomics() {
  return (
    <section className="py-24 relative overflow-hidden" id="economy">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6 text-glow"
          >
            $BXP Flywheel Economy
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto"
          >
            Every transaction routed through BagxPress generates protocol revenue, fueling a deflationary token model.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Flywheel visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative flex justify-center"
          >
            {/* Outer rotating ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-dashed border-white/20 absolute" 
            />
            
            {/* Glow BG */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-brand-primary)]/20 to-transparent blur-[80px] rounded-full pointer-events-none" />

            <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
              
              {/* Token Core */}
              <div className="w-32 h-32 rounded-full glass-panel-accent flex items-center justify-center z-20 shadow-[0_0_50px_rgba(124,58,237,0.5)] border-[var(--color-brand-primary)]/50">
                <span className="text-3xl font-black font-geist text-white">BXP</span>
              </div>

              {/* 50% Burn */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="absolute left-[-20%] top-[20%] glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)] z-30"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white">50%</div>
                  <div className="text-sm font-medium text-red-400">Buyback & Burn</div>
                </div>
              </motion.div>

              {/* 50% Treasury */}
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="absolute right-[-20%] bottom-[20%] glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/5 shadow-[0_0_20px_rgba(20,241,149,0.1)] z-30"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--color-brand-accent)]/20 text-[var(--color-brand-accent)] flex items-center justify-center">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white">50%</div>
                  <div className="text-sm font-medium text-[var(--color-brand-accent)]">Treasury Growth</div>
                </div>
              </motion.div>

            </div>
          </motion.div>

          {/* Right: Info */}
          <div className="flex flex-col gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-panel p-8"
            >
              <div className="flex items-center gap-3 mb-2 text-white/60">
                <Activity className="w-5 h-5" />
                <span className="font-medium uppercase tracking-wider text-sm">Fixed Supply</span>
              </div>
              <div className="text-4xl font-geist font-bold text-white mb-2">10,000,000</div>
              <p className="text-[var(--color-text-secondary)] text-sm">Hard-capped forever. No mint function.</p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "Fair Launch",
                "No Team Allocation",
                "Revenue Driven",
                "Deflationary"
              ].map((badge, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + (idx * 0.1) }}
                  className="flex items-center gap-3 p-4 rounded-xl glass-panel border-white/5"
                >
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-brand-primary)]" />
                  <span className="font-medium text-white">{badge}</span>
                </motion.div>
              ))}
            </div>
            
            <Link 
              href="/docs"
              className="w-fit text-[var(--color-brand-secondary)] font-medium hover:text-white transition-colors underline underline-offset-4 decoration-white/20"
            >
              Read full whitepaper →
            </Link>
          </div>
          
        </div>
      </div>
    </section>
  );
}
