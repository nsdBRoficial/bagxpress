"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Lock, EyeOff } from "lucide-react";

export default function SecuritySection() {
  const cards = [
    {
      icon: Lock,
      title: "Non-Custodial by Design",
      desc: "We never hold user assets. Self-custody wallets are dynamically generated in the background, fully controlled by the user's secure enclave (Passkey)."
    },
    {
      icon: ShieldCheck,
      title: "Bank-Grade Encryption",
      desc: "All fiat transactions are routed through audited, PCI-compliant infrastructure (Stripe/Apple Pay), guaranteeing data security at every step."
    },
    {
      icon: EyeOff,
      title: "Zero Knowledge Architecture",
      desc: "No seed phrases are exposed or stored. The WebAuthn standard ensures cryptographic proof without transmitting private keys."
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden" id="security">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.03] select-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            Institutional Security & Trust
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto"
          >
            ZeroUX doesn't mean zero security. In fact, it's safer than traditional Web3 onboarding.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="glass-panel p-8 text-center sm:text-left flex flex-col items-center sm:items-start group hover:border-blue-500/30 transition-all hover:-translate-y-1"
            >
              <card.icon className="w-10 h-10 text-blue-400 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
              <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
