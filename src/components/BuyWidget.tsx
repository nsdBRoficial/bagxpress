"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Fingerprint, Loader2, CheckCircle2, Ban, Zap,
  ExternalLink, Copy, Shield, Wallet, ArrowUpRight,
} from "lucide-react";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuth } from "@/lib/auth/AuthProvider";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WidgetState =
  | "idle"
  | "authenticating"
  | "collecting_payment"
  | "processing_fiat"
  | "sponsoring_gas"
  | "broadcasting_tx"
  | "success"
  | "error";

export interface CreatorContext {
  displayName: string;
  avatarUrl: string | null;
  wallet: string;
  provider: string | null;
  tokenMint: string | null;
  royaltyPercent: number;
}

interface TxDetails {
  wallet?: string;
  walletFull?: string;
  txHash?: string;
  deliveredAmount?: number;
  isRealTx?: boolean;
  isRealWallet?: boolean;
  explorerUrl?: string | null;
  provider?: string;
  network?: string;
}

interface LogEntry {
  msg: string;
  time: string;
  type: "info" | "success" | "error";
  link?: string | null;
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CheckoutForm (Stripe Elements)
// ---------------------------------------------------------------------------

function CheckoutForm({
  amount, orderId, tokenMint, creatorWallet, onSuccess, onError, addLog, setParentState,
}: {
  amount: number;
  orderId: string;
  tokenMint?: string | null;
  creatorWallet?: string | null;
  onSuccess: (data: TxDetails) => void;
  onError: (err: string) => void;
  addLog: (msg: string, type: "info" | "success" | "error", link?: string) => void;
  setParentState: (s: WidgetState) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const proceedToBlockchain = async (ordId: string, amt: number) => {
    setParentState("sponsoring_gas");
    addLog("Sponsoring gas fees via Relay Node...", "info");

    try {
      const res = await fetch("/api/execute-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: ordId,
          amount: amt,
          tokenMint: tokenMint ?? null,
          creatorWallet: creatorWallet ?? null,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Transaction failed");

      setParentState("broadcasting_tx");
      addLog("Broadcasting transaction to Solana...", "info");
      await new Promise((r) => setTimeout(r, 800));

      if (data.explorerUrl) {
        addLog(`✅ TX confirmed on-chain!`, "success", data.explorerUrl);
      } else {
        addLog(`Transaction processed (simulated).`, "success");
      }

      onSuccess(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      onError(message || "Execution failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      handleMockFlow();
      return;
    }

    setIsProcessing(true);
    addLog("Confirming payment with Stripe...", "info");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setIsProcessing(false);
      onError(error.message || "Payment failed");
    } else if (paymentIntent?.status === "succeeded") {
      addLog("Payment approved via Stripe.", "success");
      await proceedToBlockchain(orderId, amount);
    } else {
      setIsProcessing(false);
      onError("Unexpected payment status");
    }
  };

  const handleMockFlow = async () => {
    setIsProcessing(true);
    addLog("Processing payment (test mode)...", "info");
    await new Promise((r) => setTimeout(r, 900));
    addLog("Payment approved.", "success");
    await proceedToBlockchain(orderId, amount);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="p-4 rounded-xl bg-black/40 border border-white/10">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(124,58,237,0.4)] disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay $${amount}`}
      </button>

      {/* Test Card Helper */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/8 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Stripe Test Card</span>
          <button
            type="button"
            onClick={handleMockFlow}
            disabled={isProcessing}
            className="text-[10px] text-gray-500 hover:text-[var(--color-brand-primary)] transition-colors"
          >
            Skip → Bypass
          </button>
        </div>
        <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
          <span className="font-mono text-sm text-[#00bdae] tracking-widest">4242 4242 4242 4242</span>
          <CopyButton text="4242424242424242" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex gap-2">
            <span className="text-gray-600">EXP</span>
            <span className="text-white">12/34</span>
          </div>
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex gap-2">
            <span className="text-gray-600">CVC</span>
            <span className="text-white">123</span>
          </div>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main BuyWidget
// ---------------------------------------------------------------------------

interface BuyWidgetProps {
  creatorContext?: CreatorContext | null;
}

export default function BuyWidget({ creatorContext }: BuyWidgetProps = {}) {
  const { user } = useAuth();
  const [state, setState] = useState<WidgetState>("idle");
  const [amount, setAmount] = useState<number>(50);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [txDetails, setTxDetails] = useState<TxDetails>({});
  const [clientSecret, setClientSecret] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  const addLog = (msg: string, type: "info" | "success" | "error" = "info", link?: string) => {
    setLogs((prev) => [
      ...prev,
      { msg, type, time: new Date().toLocaleTimeString("en-US", { hour12: false }), link: link ?? null },
    ]);
  };

  const startCheckout = async () => {
    if (state !== "idle") return;
    setLogs([]);
    setTxDetails({});
    setState("authenticating");

    addLog("Initiating BagxPress Zero-UX flow...", "info");
    await new Promise((r) => setTimeout(r, 400));
    addLog(user ? `Session detected: ${user.email?.split("@")[0]}` : "Anonymous session", "info");
    await new Promise((r) => setTimeout(r, 400));

    if (user) {
      addLog("Loading your persistent wallet...", "info");
    } else {
      addLog("Generating ephemeral passkey account...", "info");
    }

    await new Promise((r) => setTimeout(r, 600));
    addLog("Wallet ready. Initializing Stripe...", "success");

    setState("processing_fiat");
    addLog(`Creating Stripe order for $${amount}...`, "info");

    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          tokenMint: creatorContext?.tokenMint ?? null,
          creatorWallet: creatorContext?.wallet ?? null,
          creatorHandle: creatorContext?.displayName ?? null,
          creatorRoyaltyPercent: creatorContext?.royaltyPercent ?? 0,
        }),
      });

      const orderData = await res.json();
      if (!orderData.success) throw new Error(orderData.error || "Order creation failed");

      addLog("PaymentIntent active. Elements initialized.", "success");

      if (orderData.clientSecret === "mock_secret_123") {
        addLog("Stripe in mock mode. Using bypass.", "info");
      }

      setOrderId(orderData.orderId);
      setClientSecret(orderData.clientSecret);
      setState("collecting_payment");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState("error");
      addLog(message || "An unexpected error occurred", "error");
    }
  };

  const handleExecutionSuccess = (data: TxDetails) => {
    setTxDetails(data);
    setState("success");

    if (data.explorerUrl) {
      addLog(`TX ${data.txHash?.slice(0, 8)}... confirmed on ${data.network}`, "success", data.explorerUrl);
    }

    confetti({
      particleCount: 180,
      spread: 90,
      origin: { y: 0.55 },
      colors: ["#7c3aed", "#00bdae", "#ffffff", "#a78bfa"],
    });
  };

  const handleError = (errorMsg: string) => {
    setState("error");
    addLog(errorMsg, "error");
  };

  const progressPercent =
    state === "authenticating" ? 20
    : state === "processing_fiat" ? 40
    : state === "collecting_payment" ? 60
    : state === "sponsoring_gas" ? 75
    : state === "broadcasting_tx" ? 90
    : state === "success" ? 100
    : 0;

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Main Widget Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Top status bar */}
        <div className={clsx(
          "absolute top-0 inset-x-0 h-1 transition-all duration-700",
          state === "idle" ? "bg-white/10"
          : state === "collecting_payment" ? "bg-[var(--color-brand-primary)] shadow-[0_0_20px_#7c3aed]"
          : state === "success" ? "bg-green-500 shadow-[0_0_20px_#22c55e]"
          : state === "error" ? "bg-red-500 shadow-[0_0_20px_#ef4444]"
          : "bg-[#00bdae] animate-pulse"
        )} />

        {/* Session badge */}
        {user && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-mono">
              {user.email?.split("@")[0]}
            </span>
          </div>
        )}

        {/* Header — Creator or Default */}
        <div className="mb-7 text-center flex flex-col items-center">
          <AnimatePresence mode="wait">
            {creatorContext ? (
              <motion.div
                key="creator-header"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative">
                  {creatorContext.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creatorContext.avatarUrl}
                      alt={creatorContext.displayName}
                      className="w-16 h-16 rounded-2xl object-cover border border-[var(--color-brand-primary)] shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-bold text-2xl text-white">
                      {creatorContext.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {creatorContext.provider === "twitter" && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full border border-white/20 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white fill-white" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                      </svg>
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">@{creatorContext.displayName}</h2>
                <p className="text-gray-400 text-xs">
                  {creatorContext.royaltyPercent}% royalty · Bags Creator Token
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="default-header"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center font-bold text-xl text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]">
                  BXP
                </div>
                <h2 className="text-2xl font-bold text-white">Buy Creator Token</h2>
                <p className="text-gray-400 text-sm">Pay with card. Hold crypto invisibly.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* State Machine */}
        <AnimatePresence mode="wait">
          {/* IDLE */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6"
            >
              {/* Amount selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-400 font-medium">Select Amount</label>
                <div className="grid grid-cols-3 gap-3">
                  {[10, 25, 50].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className={clsx(
                        "py-3 rounded-xl border font-bold text-lg transition-all duration-200",
                        amount === val
                          ? "bg-white/10 border-[var(--color-brand-primary)] text-white shadow-[0_0_15px_rgba(124,58,237,0.2)]"
                          : "bg-transparent border-white/10 text-gray-400 hover:border-white/30 hover:text-white"
                      )}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth hint */}
              {!user && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/3 rounded-xl p-3 border border-white/5">
                  <Shield className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <span>
                    <span className="text-gray-400 font-medium">Sign in</span> to save wallet & view purchase history.
                    Works without login too.
                  </span>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  id="buy-with-faceid-btn"
                  onClick={startCheckout}
                  className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.15)] active:scale-95"
                >
                  <Fingerprint className="w-5 h-5" />
                  Pay with FaceID
                </button>
                <button
                  id="buy-with-stripe-btn"
                  onClick={startCheckout}
                  className="w-full py-4 rounded-xl bg-[#00bdae] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#00a396] transition-colors shadow-[0_0_15px_rgba(0,189,174,0.3)] active:scale-95"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  Pay with Stripe
                </button>
              </div>
            </motion.div>
          )}

          {/* COLLECTING PAYMENT */}
          {state === "collecting_payment" && (
            <motion.div
              key="collecting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {clientSecret !== "mock_secret_123" && stripePromise ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "night",
                      variables: {
                        colorPrimary: "#7c3aed",
                        colorBackground: "#0a0a0a",
                        colorText: "#ffffff",
                        colorDanger: "#ef4444",
                        fontFamily: "Inter, system-ui, sans-serif",
                        borderRadius: "12px",
                      },
                    },
                  }}
                >
                  <CheckoutForm
                    amount={amount}
                    orderId={orderId}
                    tokenMint={creatorContext?.tokenMint}
                    creatorWallet={creatorContext?.wallet}
                    setParentState={setState}
                    onSuccess={handleExecutionSuccess}
                    onError={handleError}
                    addLog={addLog}
                  />
                </Elements>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-yellow-400 text-sm bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                    Stripe in mock mode — bypass available.
                  </p>
                  <button
                    onClick={() => {
                      addLog("Bypassing Stripe (mock mode)...", "info");
                      setState("sponsoring_gas");
                      fetch("/api/execute-buy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId,
                          amount,
                          tokenMint: creatorContext?.tokenMint ?? null,
                          creatorWallet: creatorContext?.wallet ?? null,
                        }),
                      })
                        .then((r) => r.json())
                        .then((d) => (d.success ? handleExecutionSuccess(d) : handleError(d.error)))
                        .catch((e) => handleError(e.message));
                    }}
                    className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-colors"
                  >
                    Continue Anyway
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* PROCESSING STATES */}
          {["authenticating", "processing_fiat", "sponsoring_gas", "broadcasting_tx"].includes(state) && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-10 gap-6"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-[var(--color-brand-primary)]/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-[var(--color-brand-primary)] animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full bg-[var(--color-brand-primary)]/5 animate-ping" />
              </div>

              <p className="font-semibold text-lg text-white text-center">
                {state === "authenticating" && "Authenticating..."}
                {state === "processing_fiat" && "Setting up secure tunnel..."}
                {state === "sponsoring_gas" && "Sponsoring Network Gas..."}
                {state === "broadcasting_tx" && "Broadcasting to Solana..."}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[#00bdae]"
                />
              </div>
              <p className="text-xs text-gray-600 font-mono">{progressPercent}%</p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {state === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-4 relative"
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 bg-green-500/8 blur-3xl rounded-full pointer-events-none" />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-5 border border-green-500/40 shadow-[0_0_50px_rgba(34,197,94,0.4)]"
              >
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-6"
              >
                <h3 className="text-3xl font-bold text-white mb-1">
                  {txDetails.deliveredAmount} $BXP
                </h3>
                <p className="text-green-400 font-medium">
                  {txDetails.isRealTx ? "Confirmed on-chain! 🎉" : "Payment successful!"}
                </p>
                {txDetails.provider && txDetails.provider !== "mock" && (
                  <p className="text-[10px] text-gray-600 mt-1 font-mono">via {txDetails.provider}</p>
                )}
              </motion.div>

              {/* Details card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full bg-white/5 rounded-2xl p-4 mb-5 border border-white/10 flex flex-col gap-3"
              >
                {/* Wallet */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{txDetails.isRealWallet ? "Your Wallet" : "Session Wallet"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="text-white text-xs font-mono">{txDetails.wallet}</code>
                    {txDetails.walletFull && <CopyButton text={txDetails.walletFull} />}
                  </div>
                </div>

                {/* TX Hash */}
                {txDetails.txHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Transaction</span>
                    {txDetails.explorerUrl ? (
                      <a
                        href={txDetails.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[var(--color-brand-primary)] text-xs hover:underline font-mono"
                      >
                        {txDetails.txHash.slice(0, 12)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-500 text-xs font-mono">
                        {txDetails.txHash.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                )}

                {/* Network */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Network</span>
                  <span className="text-xs text-white font-mono">{txDetails.network ?? "devnet"}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="w-full flex flex-col gap-3"
              >
                {/* Explorer button */}
                {txDetails.explorerUrl && (
                  <a
                    href={txDetails.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7c3aed]/20 to-[#00bdae]/20 border border-[var(--color-brand-primary)]/40 text-white font-bold flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    🔍 View on Solana Explorer
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}

                {/* Dashboard button */}
                {user && (
                  <a
                    href="/dashboard"
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/15 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                  >
                    <Wallet className="w-4 h-4" />
                    View in Dashboard
                  </a>
                )}

                <button
                  onClick={() => setState("idle")}
                  className="w-full py-3 rounded-xl bg-transparent text-gray-500 font-medium hover:text-white transition-colors text-sm"
                >
                  Buy Again
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10"
            >
              <Ban className="w-16 h-16 text-red-500 mb-5" />
              <p className="font-bold text-xl text-white mb-2">Transaction Failed</p>
              <p className="text-gray-500 text-sm mb-6 text-center max-w-xs">
                {logs[logs.length - 1]?.msg ?? "An unexpected error occurred."}
              </p>
              <button
                onClick={() => setState("idle")}
                className="px-8 py-3 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Terminal Logs */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full h-48 bg-[#050505] border border-white/8 rounded-2xl p-4 font-mono text-xs overflow-y-auto flex flex-col gap-1 shadow-inner"
      >
        <div className="text-gray-600 border-b border-gray-800 pb-2 mb-1 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            System execution logs
          </span>
          <span className="text-gray-700">zero-ux-v2</span>
        </div>
        {logs.length === 0 ? (
          <span className="text-gray-700 italic">Waiting for interactions...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-gray-600 shrink-0">[{log.time}]</span>
              <span className={clsx(
                "flex-1",
                log.type === "error" ? "text-red-400"
                : log.type === "success" ? "text-green-400"
                : "text-gray-300"
              )}>
                {log.msg}
              </span>
              {log.link && (
                <a
                  href={log.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-0.5 text-[var(--color-brand-primary)] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}
