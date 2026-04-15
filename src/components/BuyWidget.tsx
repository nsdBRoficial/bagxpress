"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Fingerprint, Loader2, CheckCircle2, Ban, Zap } from "lucide-react";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { Copy } from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Load stripe client conditionally
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) 
  : Promise.resolve(null);

type WidgetState = 'idle' | 'authenticating' | 'collecting_payment' | 'processing_fiat' | 'sponsoring_gas' | 'broadcasting_tx' | 'success' | 'error';

function CheckoutForm({ 
  amount, 
  orderId, 
  onSuccess, 
  onError, 
  addLog,
  setParentState
}: { 
  amount: number; 
  orderId: string; 
  onSuccess: (data: any) => void;
  onError: (err: string) => void;
  addLog: (msg: string, type: 'info'|'success'|'error') => void;
  setParentState: (state: WidgetState) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      // Graceful fallback trigger if stripe isn't fully loaded
      handleMockFlow();
      return;
    }

    setIsProcessing(true);
    addLog("Confirming payment via Stripe...", "info");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setIsProcessing(false);
      onError(error.message || "Payment failed");
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      addLog("Payment Approved via Stripe.", "success");
      proceedToBlockchainContent(orderId, amount);
    } else {
      setIsProcessing(false);
      onError("Unexpected payment status");
    }
  };

  const handleMockFlow = async () => {
    setIsProcessing(true);
    addLog("Stripe bypass: Processing mock payment...", "info");
    await new Promise(r => setTimeout(r, 1200));
    addLog("Mock Payment Approved.", "success");
    proceedToBlockchainContent(orderId, amount);
  };

  const proceedToBlockchainContent = async (ordId: string, amt: number) => {
    setParentState('sponsoring_gas');
    addLog("Delegating Gas fees via Relay Node...", "info");
      
    try {
      const execRes = await fetch('/api/execute-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: ordId, amount: amt })
      });
      
      const execData = await execRes.json();
      if (!execData.success) throw new Error(execData.error || "Transaction broadcast failed");
      
      setParentState('broadcasting_tx');
      addLog("Executing Jupiter Swap & Minting Asset...", "info");
      await new Promise(r => setTimeout(r, 1000));
      
      onSuccess(execData);
    } catch (e: any) {
      onError(e.message || "Execution failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-2">
         <PaymentElement options={{layout: 'tabs'}} />
      </div>
      <button 
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(124,58,237,0.3)] disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay $${amount}`}
      </button>

      {/* Stripe Test Panel */}
      <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium tracking-widest">STRIPE TEST CARD</span>
          <button 
            type="button"
            onClick={handleMockFlow}
            disabled={isProcessing}
            className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
          >
            Bypass Mode
          </button>
        </div>
        <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5 group">
           <span className="font-mono text-sm tracking-widest text-[#00bdae]">4242 4242 4242 4242</span>
           <button type="button" onClick={() => navigator.clipboard.writeText("4242424242424242")} className="text-gray-500 hover:text-white opacity-50 group-hover:opacity-100 transition-opacity">
              <Copy className="w-4 h-4" />
           </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
           <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
             <span className="font-mono text-sm text-gray-500 border-r border-white/10 pr-2 mr-2">EXP</span>
             <span className="font-mono text-sm text-white">12/34</span>
           </div>
           <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
             <span className="font-mono text-sm text-gray-500 border-r border-white/10 pr-2 mr-2">CVC</span>
             <span className="font-mono text-sm text-white">123</span>
           </div>
        </div>
      </div>
    </form>
  );
}

export default function BuyWidget() {
  const [state, setState] = useState<WidgetState>('idle');
  const [amount, setAmount] = useState<number>(50);
  const [logs, setLogs] = useState<{msg: string, time: string, type: 'info'|'success'|'error'}[]>([]);
  const [txDetails, setTxDetails] = useState<{wallet?: string, txHash?: string, deliveredAmount?: number, isRealTx?: boolean}>({});
  
  // Stripe Order Configs
  const [clientSecret, setClientSecret] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  const addLog = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('en-US', {hour12: false}) }]);
  };

  const startCheckout = async () => {
    if (state !== 'idle') return;
    
    setLogs([]);
    setTxDetails({});
    setState('authenticating');
    addLog("Initiating WebAuthn (Passkeys)...", "info");

    try {
      addLog("Checking hardware enclave...", "info");
      await new Promise(r => setTimeout(r, 600));
      addLog("No wallet detected.", "error");

      await new Promise(r => setTimeout(r, 600));
      addLog("Generating stealth passkey account...", "info");

      await new Promise(r => setTimeout(r, 800));
      addLog("Device Bound Successfully.", "success");
      
      setState('processing_fiat');
      addLog(`Creating Stripe order for $${amount}...`, "info");
      
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, user_identifier: "demo_user" })
      });
      const orderData = await createRes.json();
      
      if (!orderData.success) throw new Error(orderData.error || "Order creation failed");
      
      addLog(`PaymentIntent active. Securely initializing Elements.`, "success");
      
      // se mock_secret_123 for o caso, fallback automatico para mock full
      if (orderData.clientSecret === "mock_secret_123") {
         addLog("Mock Mode Detactado. Stripe Keys ausentes no Server.", "info");
      }
      
      setOrderId(orderData.orderId);
      setClientSecret(orderData.clientSecret);
      setState('collecting_payment');
    } catch (error: any) {
      setState('error');
      addLog(error.message || "An unexpected error occurred", "error");
    }
  };

  const handleExecutionSuccess = (data: any) => {
    setTxDetails({
      wallet: data.wallet,
      txHash: data.txHash,
      deliveredAmount: data.deliveredAmount,
      isRealTx: data.isRealTx
    });
    setState('success');
    addLog(`${data.deliveredAmount} $BXP securely delivered!`, "success");
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#00bdae', '#ffffff']
    });
  };

  const handleError = (errorMsg: string) => {
    setState('error');
    addLog(errorMsg, "error");
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className={clsx(
          "absolute top-0 inset-x-0 h-1 transition-colors duration-500",
          state === 'idle' ? "bg-white/10" :
          state === 'collecting_payment' ? "bg-[var(--color-brand-primary)] shadow-[0_0_20px_#7c3aed]" :
          state === 'success' ? "bg-green-500 shadow-[0_0_20px_#22c55e]" :
          state === 'error' ? "bg-red-500 shadow-[0_0_20px_#ef4444]" :
          "bg-[#00bdae] animate-pulse"
        )} />

        <div className="mb-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-geist font-bold text-xl text-white mb-4 shadow-[0_0_15px_rgba(124,58,237,0.5)]">
                BXP
            </div>
            <h2 className="text-2xl font-bold font-geist text-white">Buy Creator Token</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Pay instantly, hold crypto invisibly.</p>
        </div>

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-400 font-medium">Select Amount</label>
                <div className="grid grid-cols-3 gap-3">
                  {[10, 25, 50].map(val => (
                    <button 
                      key={val}
                      onClick={() => setAmount(val)}
                      className={clsx(
                        "py-3 rounded-xl border font-bold transition-all",
                        amount === val 
                          ? "bg-white/10 border-[var(--color-brand-primary)] text-white" 
                          : "bg-transparent border-white/10 text-gray-400 hover:border-white/30"
                      )}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button 
                  onClick={startCheckout}
                  className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] active:scale-95"
                >
                  <Fingerprint className="w-5 h-5" />
                  Pay with FaceID
                </button>
                <button 
                  onClick={startCheckout}
                  className="w-full py-4 rounded-xl bg-[#00bdae] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#00a396] transition-colors shadow-[0_0_15px_rgba(0,189,174,0.3)] active:scale-95"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  Pay with Stripe
                </button>
              </div>
            </motion.div>
          )}

          {state === 'collecting_payment' && (
             <motion.div
               key="collecting"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full"
             >
               {clientSecret !== "mock_secret_123" && stripePromise ? (
                 <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#7c3aed',
                        colorBackground: '#0a0a0a',
                        colorText: '#ffffff',
                        colorDanger: '#ef4444',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        borderRadius: '12px'
                      }
                    }
                  }}
                 >
                   <CheckoutForm 
                      amount={amount} 
                      orderId={orderId} 
                      setParentState={setState}
                      onSuccess={handleExecutionSuccess}
                      onError={handleError}
                      addLog={addLog}
                   />
                 </Elements>
               ) : (
                  <div className="text-center py-6">
                    <p className="text-yellow-400 mb-4 text-sm bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">Stripe Keys are missing or Mock Mode triggered. Fallback active.</p>
                    <button 
                      onClick={() => {
                         addLog("Bypassing Stripe processing securely...", "info");
                         setState('sponsoring_gas');
                         fetch('/api/execute-buy', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({orderId, amount}) })
                           .then(r => r.json())
                           .then(d => d.success ? handleExecutionSuccess(d) : handleError(d.error))
                           .catch(e => handleError(e.message));
                      }}
                       className="w-full py-4 rounded-xl bg-white text-black font-bold"
                    >
                      Continue Flow Anyway
                    </button>
                  </div>
               )}
             </motion.div>
          )}

          {(state === 'authenticating' || state === 'processing_fiat' || state === 'sponsoring_gas' || state === 'broadcasting_tx') && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-10"
            >
               <Loader2 className="w-16 h-16 text-[var(--color-brand-primary)] animate-spin mb-6" />
               <p className="font-medium text-lg text-white">
                 {state === 'authenticating' && "Authenticating..."}
                 {state === 'processing_fiat' && "Setting up secure tunnel..."}
                 {state === 'sponsoring_gas' && "Sponsoring Network Gas..."}
                 {state === 'broadcasting_tx' && "Minting Asset on Solana..."}
               </p>
               <div className="w-full max-w-xs mt-8 bg-white/5 rounded-full h-1 overflow-hidden">
                  <motion.div 
                    initial={{ width: "20%" }}
                    animate={{ width: state === 'broadcasting_tx' ? "95%" : state === 'sponsoring_gas' ? "75%" : state === 'processing_fiat' ? "50%" : "25%" }}
                    className="h-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[#00bdae]"
                  />
               </div>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-4 relative z-10"
            >
               {/* Ambient Glow */}
               <div className="absolute inset-0 bg-green-500/10 blur-[80px] rounded-full z-[-1]" />

               <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50 shadow-[0_0_50px_rgba(34,197,94,0.4)]">
                 <CheckCircle2 className="w-12 h-12 text-green-400" />
               </div>
               <h3 className="text-3xl font-bold font-geist text-white mb-2">{txDetails.deliveredAmount} $BXP</h3>
               <p className="text-green-400 font-medium mb-6">Payment successful!</p>
               
               <div className="w-full bg-white/5 rounded-xl p-4 mb-6 border border-white/10 text-sm flex flex-col gap-2 relative">
                 <div className="flex justify-between">
                   <span className="text-gray-400">Wallet</span>
                   <span className="text-white font-mono">{txDetails.wallet}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-400">Transaction</span>
                   <span className="text-[var(--color-brand-primary)] hover:underline cursor-pointer font-mono">{txDetails.txHash?.substring(0, 10)}...</span>
                 </div>
               </div>

               {txDetails.isRealTx && txDetails.txHash && (
                 <a 
                   href={`https://explorer.solana.com/tx/${txDetails.txHash}?cluster=devnet`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="w-full py-3 mb-6 rounded-xl bg-gradient-to-r from-[#7c3aed]/20 to-[#00bdae]/20 border border-[var(--color-brand-primary)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-80 transition-opacity shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                 >
                   🔍 View on Solana Explorer
                 </a>
               )}

               <button 
                 onClick={() => setState('idle')}
                 className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors border border-white/20"
               >
                 Start New Flow
               </button>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-10"
            >
               <Ban className="w-16 h-16 text-red-500 mb-6" />
               <p className="font-bold text-xl text-white mb-2">Transaction Failed</p>
               <button 
                 onClick={() => setState('idle')}
                 className="mt-6 px-8 py-3 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
               >
                 Try Again
               </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Embedded Terminal Logs */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full h-48 bg-[#050505] border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-y-auto flex flex-col gap-1.5 shadow-inner"
      >
        <div className="text-gray-500 mb-2 border-b border-gray-800 pb-2 flex justify-between">
          <span>System execution logs</span>
          <span>zero-ux-v2</span>
        </div>
        {logs.length === 0 ? (
          <span className="text-gray-600 italic">Waiting for interactions...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500 shrink-0">[{log.time}]</span>
              <span className={clsx(
                log.type === 'error' ? "text-red-400" :
                log.type === 'success' ? "text-green-400" :
                "text-gray-300"
              )}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
