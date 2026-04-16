"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Terminal, Check, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function DemoWidget() {
  const [step, setStep] = useState(0);
  // 0: Initial, 1: FaceID, 2: Processing, 3: Success

  useEffect(() => {
    if (step === 1) {
      setTimeout(() => setStep(2), 1500);
    } else if (step === 2) {
      setTimeout(() => setStep(3), 2500);
    }
  }, [step]);

  const logs = [
    { time: "14:02:41", msg: "Initialized BagxPress Widget v2.0", type: "info" },
    { time: "14:02:45", msg: "User triggered BuyAction ($50 BXP)", type: "action" },
    ...(step >= 1 ? [{ time: "14:02:46", msg: "Invoking WebAuthn (Passkeys)...", type: "info" }] : []),
    ...(step >= 2 ? [
      { time: "14:02:47", msg: "FaceID Confirmed.", type: "success" },
      { time: "14:02:47", msg: "Stripe PaymentIntent created (PIX/Card).", type: "info" },
      { time: "14:02:48", msg: "Relay Node: Paying SOL Gas...", type: "system" }
    ] : []),
    ...(step >= 3 ? [
      { time: "14:02:49", msg: "Jupiter Swap Executed (USDC -> BXP)", type: "success" },
      { time: "14:02:50", msg: "Tokens delivered to Background Wallet.", type: "success" }
    ] : []),
  ];

  return (
    <section className="py-24 relative overflow-hidden" id="demo">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-geist font-bold mb-6 text-glow"
          >
            Live Experience
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--color-text-secondary)]"
          >
            See exactly how a Web2 user buys your creator token.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          
          {/* Widget Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative mx-auto w-full max-w-[360px] h-[640px] rounded-[40px] bg-black p-2 shadow-[0_0_50px_rgba(124,58,237,0.3)] border border-white/10"
          >
            {/* iPhone Frame */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-20" />
            
            <div className="w-full h-full bg-[#0a0a0a] rounded-[32px] overflow-hidden relative flex flex-col pt-16 px-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] mx-auto mb-4 flex items-center justify-center text-xl font-bold font-geist">BXP</div>
                <h3 className="text-white font-bold text-xl">Buy $BXP</h3>
                <p className="text-gray-400 text-sm">@creator.bags</p>
              </div>

              {step === 0 && (
                <div className="flex flex-col gap-4 mt-auto mb-10">
                  <button 
                    onClick={() => setStep(1)}
                    className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                  >
                    Pay with Apple Pay
                  </button>
                  <button 
                    onClick={() => setStep(1)}
                    className="w-full py-4 rounded-xl bg-[#00bdae] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#00a396] transition-colors"
                  >
                    Pay with PIX
                  </button>
                  <div className="text-center text-xs text-gray-500 mt-2">
                    Powered by BagxPress ZeroUX
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="flex flex-col items-center justify-center h-1/2 mt-auto mb-10">
                  <div className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-2xl flex items-center justify-center relative animate-pulse">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md" />
                    <span className="text-blue-400 font-bold text-sm">FaceID</span>
                  </div>
                  <p className="text-white mt-6 font-medium">Authenticating...</p>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col items-center justify-center h-1/2 mt-auto mb-10">
                  <Loader2 className="w-12 h-12 text-[var(--color-brand-primary)] animate-spin mb-6" />
                  <p className="text-white font-medium">Processing payment & routing...</p>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center justify-center h-1/2 mt-auto mb-10">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                    <Check className="w-10 h-10 text-green-400" />
                  </div>
                  <p className="text-white font-bold text-2xl mb-2">$50 BXP</p>
                  <p className="text-gray-400 text-sm">Automatically secured in wallet.</p>
                  <button 
                    onClick={() => setStep(0)}
                    className="w-full py-3 mt-8 rounded-xl bg-white/10 text-white font-bold"
                  >
                    Reset Demo
                  </button>
                </div>
              )}

            </div>
          </motion.div>

          {/* Terminal Logs */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full h-full min-h-[400px] rounded-2xl bg-[#0a0a0a] border border-white/10 overflow-hidden flex flex-col font-mono text-sm shadow-2xl"
          >
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 font-medium">relay-node ~ /logs/session_abc123</span>
            </div>
            <div className="p-4 flex flex-col gap-2 overflow-y-auto">
              {logs.map((log, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx} 
                  className="flex items-start gap-3"
                >
                  <span className="text-gray-500 whitespace-nowrap">[{log.time}]</span>
                  <span className={clsx(
                    log.type === "info" && "text-gray-300",
                    log.type === "action" && "text-blue-400 font-bold",
                    log.type === "success" && "text-green-400",
                    log.type === "system" && "text-purple-400"
                  )}>
                    {log.msg}
                  </span>
                </motion.div>
              ))}
              {step < 3 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-500">[14:02:51]</span>
                  <span className="text-gray-500 animate-pulse">Waiting for events...</span>
                </div>
              )}
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
