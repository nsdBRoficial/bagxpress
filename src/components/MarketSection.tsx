"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

function Counter({ target, symbol = "" }: { target: number, symbol?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000; // ms
      const increment = target / (duration / 16); // 60fps
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [isInView, target]);

  return (
    <span ref={ref} className="text-5xl md:text-7xl font-black font-geist text-white">
      {count}{symbol}
    </span>
  );
}

export default function MarketSection() {
  const stats = [
    { value: 50, symbol: "M+", label: "Creators Worldwide", desc: "Building vibrant communities and independent economies." },
    { value: 250, symbol: "B$", label: "Creator Economy Value", desc: "Massive spend happening exclusively in fiat." },
    { value: 99, symbol: "%", label: "Web2 Native Fans", desc: "Who have never interacted with a blockchain wallet." }
  ];

  return (
    <section className="py-24 relative overflow-hidden" id="market">
      <div className="absolute inset-x-0 bottom-0 top-[20%] bg-gradient-to-b from-transparent to-[var(--color-brand-primary)]/5" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20 lg:w-2/3 lg:mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6"
          >
            Massive Creator Economy Opportunity
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--color-text-secondary)]"
          >
            The creator economy is exploding, but crypto native tools isolate 99% of fans. <span className="text-white font-medium">BagxPress is the bridge to this new liquidity.</span>
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.2 }}
              className="text-center p-8 rounded-3xl glass-panel relative overflow-hidden group hover:border-[var(--color-brand-secondary)]/30 transition-colors"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-brand-secondary)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="mb-4 text-glow-accent">
                <Counter target={stat.value} symbol={stat.symbol} />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-brand-accent)] mb-2 uppercase tracking-wide text-sm">{stat.label}</h3>
              <p className="text-[var(--color-text-secondary)]">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
