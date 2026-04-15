"use client";

import { motion } from "framer-motion";
import { Wallet, KeySquare, Coins, Fuel, XCircle, LogOut } from "lucide-react";

export default function ProblemSection() {
  const steps = [
    { icon: Wallet, title: "Install Wallet", desc: "Download extension & setup", color: "text-blue-400" },
    { icon: KeySquare, title: "Save Seed", desc: "Write 12 words on paper", color: "text-amber-400" },
    { icon: Coins, title: "Buy SOL", desc: "KYC on CEX & transfer", color: "text-purple-400" },
    { icon: Fuel, title: "Pay Gas", desc: "Calculate network fees", color: "text-orange-400" },
    { icon: XCircle, title: "Tx Fails", desc: "Slippage or error 429", color: "text-red-400" },
    { icon: LogOut, title: "User Leaves", desc: "99% drop-off rate", color: "text-gray-400" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100 } },
  };

  return (
    <section className="py-24 relative overflow-hidden" id="problem">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            Web3 Still Converts Like <span className="text-gray-500 line-through">2017</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto"
          >
            The current onboarding funnel is broken. Every step adds friction, resulting in massive audience drop-off before they ever hold a token.
          </motion.p>
        </div>

        {/* Funnel Visualizer */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 relative"
        >
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-[50%] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-white/10 via-red-500/50 to-transparent -translate-y-1/2 z-0" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            // Calculate opacity to show dropoff
            const dropoffOpacity = 1 - (idx * 0.12);
            
            return (
              <motion.div 
                key={idx}
                variants={itemVariants}
                className="glass-panel p-6 flex flex-col items-center text-center relative z-10 hover:border-white/20 transition-colors group"
                style={{ opacity: idx === steps.length - 1 ? 1 : Math.max(dropoffOpacity, 0.4) }}
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 group-hover:scale-110 transition-transform">
                  <Icon className={`w-6 h-6 ${step.color}`} />
                </div>
                <h3 className="text-white font-geist font-bold mb-2">{step.title}</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">{step.desc}</p>
                
                {/* Dropoff indicator */}
                {idx > 0 && (
                  <div className="absolute -top-3 -right-3 text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                    -{15 + (idx * 4)}%
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* 99% Drop-off Callout */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-block px-8 py-4 rounded-2xl glass-panel-accent border-red-500/30">
            <span className="text-4xl md:text-5xl font-black font-geist text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
              99%
            </span>
            <span className="block text-sm text-[var(--color-text-secondary)] mt-1 font-medium uppercase tracking-wider">
              Audience Drop-off
            </span>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
