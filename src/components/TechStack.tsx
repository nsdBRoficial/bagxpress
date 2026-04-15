"use client";

import { motion } from "framer-motion";
import { Smartphone, Server, Blocks } from "lucide-react";

export default function TechStack() {
  const stack = [
    {
      title: "Frontend Widget",
      icon: Smartphone,
      color: "from-blue-500/20 to-blue-600/5",
      borderColor: "group-hover:border-blue-500/50",
      iconColor: "text-blue-400",
      items: ["React & Next.js 15", "TypeScript & Tailwind", "WebAuthn (Passkeys)", "Mobile-first UI"]
    },
    {
      title: "Relay Backend",
      icon: Server,
      color: "from-purple-500/20 to-purple-600/5",
      borderColor: "group-hover:border-purple-500/50",
      iconColor: "text-purple-400",
      items: ["Node.js Edge Relay", "Gas Fee Payer", "Stripe Webhooks", "Treasury Hot Wallet"]
    },
    {
      title: "Blockchain Layer",
      icon: Blocks,
      color: "from-[var(--color-brand-accent)]/20 to-green-600/5",
      borderColor: "group-hover:border-[var(--color-brand-accent)]/50",
      iconColor: "text-[var(--color-brand-accent)]",
      items: ["Solana Network", "Bags SDK Integrated", "USDC Auto Routing", "Smart Contract Execution"]
    }
  ];

  return (
    <section className="py-24 relative" id="tech-stack">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            ZeroUX Infrastructure Stack
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto"
          >
            An enterprise-grade stack invisible to the end-user. We handle the complexity so they only see the magic.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {stack.map((layer, idx) => {
            const Icon = layer.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className={`glass-panel p-8 rounded-3xl border border-white/5 bg-gradient-to-br ${layer.color} transition-all duration-500 group hover:-translate-y-2 relative overflow-hidden`}
              >
                {/* Hover Glow Effect */}
                <div className={`absolute inset-0 border-2 border-transparent ${layer.borderColor} rounded-3xl transition-colors duration-500`} />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[50px] group-hover:bg-white/10 transition-colors" />

                <div className="w-14 h-14 bg-black/40 rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-lg">
                  <Icon className={`w-7 h-7 ${layer.iconColor}`} />
                </div>
                
                <h3 className="text-2xl font-geist font-bold text-white mb-6">{layer.title}</h3>
                
                <ul className="space-y-4">
                  {layer.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[var(--color-text-secondary)] font-medium">
                      <div className={`w-1.5 h-1.5 rounded-full bg-current ${layer.iconColor}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>

      </div>
    </section>
  );
}
