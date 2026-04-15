"use client";

import { motion } from "framer-motion";
import { ArrowRight, Code2 as Github, Play, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-32 relative overflow-hidden" id="cta">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-brand-primary)]/20" />
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-6xl font-geist font-bold mb-8 text-glow-primary"
        >
          The Future of Creator Payments Starts Here
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-xl text-[var(--color-text-secondary)] mb-12"
        >
          Stop losing 99% of your audience to Web3 friction. Integrate BagxPress today.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/demo" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold text-lg shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:shadow-[0_0_50px_rgba(124,58,237,0.7)] transition-shadow flex items-center justify-center gap-2">
            <Play className="w-5 h-5 fill-current" />
            Try Demo
          </Link>
          <button className="w-full sm:w-auto px-8 py-4 rounded-full glass-panel text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
            <Github className="w-5 h-5" />
            View GitHub
          </button>
          <button className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
            <ExternalLink className="w-5 h-5" />
            Read Docs
          </button>
        </motion.div>
      </div>
    </section>
  );
}
