"use client";

import { motion } from "framer-motion";
import { CreditCard, Fingerprint, Coins, Zap } from "lucide-react";

export default function SolutionSection() {
  const steps = [
    { icon: CreditCard, title: "Tap to Buy", desc: "User chooses fiat amount" },
    { icon: Fingerprint, title: "Verify", desc: "Passkey / FaceID confirms" },
    { icon: Zap, title: "Auto Execution", desc: "PIX/Card processed instantly" },
    { icon: Coins, title: "Received", desc: "Wallet created & Tokens delivered" }
  ];

  return (
    <section className="py-24 relative overflow-hidden" id="solution">
      {/* Glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[var(--color-brand-primary)]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-brand-primary)]/20 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/30 mb-6 font-medium text-sm"
          >
            <Zap className="w-4 h-4" /> The New Standard
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-geist font-bold mb-6 text-glow"
          >
            BagxPress Removes All Friction
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto"
          >
            We abstracted away wallets, gas, and DEX routing. Users just pay with what they already know.
          </motion.p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Animated Connecting Path */}
          <div className="hidden md:block absolute top-[60px] left-[10%] right-[10%] h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              whileInView={{ x: "0%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
              className="w-full h-full bg-gradient-to-r from-transparent via-[var(--color-brand-accent)] to-[var(--color-brand-primary)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 + (idx * 0.2) }}
                  className="flex flex-col items-center text-center relative"
                >
                  <div className="w-24 h-24 mb-6 rounded-3xl glass-panel flex items-center justify-center relative group z-10 overflow-hidden border border-white/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-primary)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Icon className="w-10 h-10 text-white relative z-10 group-hover:text-[var(--color-brand-accent)] transition-colors duration-300" />
                    
                    {/* Ring glow */}
                    <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]" />
                  </div>
                  
                  <div className="bg-black/40 px-3 py-1 rounded-full text-xs font-bold text-[var(--color-brand-accent)] mb-3 border border-[var(--color-brand-accent)]/30 shadow-[0_0_10px_rgba(20,241,149,0.2)]">
                    Step 0{idx + 1}
                  </div>
                  
                  <h3 className="text-xl font-geist font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-[200px]">{step.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
