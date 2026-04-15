"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function WhyNow() {
  const events = [
    { title: "Bags Ecosystem Growth", desc: "SocialFi is proving product-market fit.", year: "Now" },
    { title: "Creator Tokens Exploding", desc: "Communities want ownership of creators.", year: "Trend" },
    { title: "Solana Network Scale", desc: "Sub-cent fees and instant finality.", year: "Infra" },
    { title: "Passkeys Mainstream", desc: "Apple & Android made WebAuthn ubiquitous.", year: "UX" }
  ];

  return (
    <section className="py-24 relative">
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            Why BagxPress Wins Now
          </motion.h2>
        </div>

        <div className="relative border-l border-white/10 ml-4 md:ml-0 md:border-l-0">
          {events.map((event, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className={`relative pl-8 md:pl-0 md:flex items-center gap-8 mb-12 last:mb-0 ${idx % 2 === 0 ? "md:flex-row-reverse text-left md:text-right" : "text-left"}`}
            >
              {/* Timeline marker */}
              <div className="absolute left-[-5px] md:left-1/2 md:translate-x-[-50%] top-0 w-3 h-3 rounded-full bg-[var(--color-brand-primary)] shadow-[0_0_10px_rgba(124,58,237,0.8)] border border-white" />
              
              {/* Timeline line desktop */}
              <div className="hidden md:block absolute left-1/2 translate-x-[-50%] top-3 bottom-[-48px] w-px bg-white/10" />

              <div className={`md:w-1/2 ${idx % 2 === 0 ? "md:pr-12" : "md:pl-12"}`}>
                <div className="glass-panel p-6 rounded-2xl hover:border-white/20 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] group">
                  <div className={`text-xs font-bold px-3 py-1 rounded-full bg-white/10 w-fit mb-4 ${idx % 2 === 0 ? "md:ml-auto" : ""}`}>
                    {event.year}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[var(--color-brand-primary)] transition-colors">{event.title}</h3>
                  <p className="text-[var(--color-text-secondary)]">{event.desc}</p>
                </div>
              </div>
              <div className="hidden md:block md:w-1/2" />
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
