"use client";

import { motion } from "framer-motion";
import { Award, Code2, Rss, Layers, Zap } from "lucide-react";

export default function SocialProof() {
  const cards = [
    { icon: Award, title: "Solana Native", desc: "Built directly on the world's fastest blockchain." },
    { icon: Layers, title: "Bags SDK Integrated", desc: "Natively integrated with Bags smart contracts." },
    { icon: Rss, title: "Real Business Model", desc: "BXP tokenomics driven by actual protocol revenue." },
    { icon: Code2, title: "Ready to Scale", desc: "Production-grade code, ready for mainnet." },
  ];

  return (
    <section className="py-24 relative overflow-hidden" id="hackathon">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="flex items-center justify-center gap-2 mb-4 text-[var(--color-brand-primary)]">
          <Zap className="w-5 h-5" />
          <span className="font-bold uppercase tracking-widest text-sm">Bags Hackathon 2026</span>
        </div>
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            Built to Win. Built to Scale.
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-panel p-6"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
