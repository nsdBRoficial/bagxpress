"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  Wallet,
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  Clock,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletData {
  publicKey: string;
  network: string;
  balanceSol: number;
  createdAt: string;
  solscanUrl: string;
  explorerUrl: string;
}

interface Transaction {
  tx_hash: string | null;
  delivered_amount: number;
  is_real_tx: boolean;
  network: string;
  explorer_url: string | null;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  stripe_payment_intent_id: string;
  amount_usd: number;
  token_mint: string | null;
  creator_handle: string | null;
  creator_royalty_percent: number;
  status: string;
  created_at: string;
  transactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    confirmed: { label: "Confirmed", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    pending: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    executing: { label: "Executing", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    failed: { label: "Failed", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    mock: { label: "Simulated", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };

  const { label, className } = config[status] ?? config.pending;
  return (
    <span className={clsx("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", className)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/";
    }
  }, [authLoading, user]);

  // Carrega wallet
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await fetch("/api/wallet");
        const json = await res.json();
        if (json.success) setWallet(json.wallet);
        else setWalletError(json.error);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setWalletError(message);
      } finally {
        setLoadingWallet(false);
      }
    };
    load();
  }, [user]);

  // Carrega orders
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await fetch("/api/orders");
        const json = await res.json();
        if (json.success) setOrders(json.orders ?? []);
      } finally {
        setLoadingOrders(false);
      }
    };
    load();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  const totalSpent = orders.reduce((sum, o) => sum + Number(o.amount_usd), 0);
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const realTxCount = orders.filter((o) =>
    o.transactions?.[0]?.is_real_tx
  ).length;

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg-1)] pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <p className="text-sm text-gray-500 mb-1 uppercase tracking-widest font-mono">
              BagxPress Dashboard
            </p>
            <h1 className="text-3xl font-bold text-white">
              {user.email?.split("@")[0]}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              Buy Tokens <ArrowUpRight className="w-4 h-4" />
            </Link>
            <button
              onClick={signOut}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: TrendingUp, label: "Total Spent", value: `$${totalSpent.toFixed(2)}`, color: "text-[var(--color-brand-secondary)]" },
            { icon: CheckCircle2, label: "Purchases", value: completedOrders.toString(), color: "text-green-400" },
            { icon: ShieldCheck, label: "On-Chain Txs", value: realTxCount.toString(), color: "text-[var(--color-brand-primary)]" },
          ].map(({ icon: Icon, label, value, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4"
            >
              <Icon className={clsx("w-5 h-5 mb-2", color)} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Wallet Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#7c3aed] to-[#00bdae]" />

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c3aed] to-[#00bdae] flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold">My Wallet</h2>
              <p className="text-xs text-gray-500">Solana · {wallet?.network ?? "—"}</p>
            </div>
          </div>

          {loadingWallet ? (
            <div className="flex items-center gap-2 text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Provisioning wallet...</span>
            </div>
          ) : walletError ? (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {walletError}
            </div>
          ) : wallet ? (
            <div className="flex flex-col gap-4">
              {/* Public Key */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Public Key</p>
                <div className="flex items-center gap-2">
                  <code className="text-white font-mono text-xs flex-1 truncate">
                    {wallet.publicKey}
                  </code>
                  <CopyButton text={wallet.publicKey} />
                </div>
              </div>

              {/* Balance + Links */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Balance</p>
                  <p className="text-2xl font-bold text-white">
                    {wallet.balanceSol.toFixed(4)}
                    <span className="text-sm text-gray-500 ml-1">SOL</span>
                  </p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col gap-2">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">Explorer</p>
                  <a
                    href={wallet.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[var(--color-brand-primary)] hover:underline"
                  >
                    Solscan <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={wallet.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[var(--color-brand-secondary)] hover:underline"
                  >
                    Solana Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Purchase History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="text-white font-bold">Purchase History</h2>
            </div>
            <span className="text-xs text-gray-600">{orders.length} orders</span>
          </div>

          {loadingOrders ? (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading history...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-gray-600" />
              </div>
              <p className="text-gray-500 mb-4">No purchases yet.</p>
              <Link
                href="/demo"
                className="px-6 py-2.5 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Buy Your First Token
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {orders.map((order, i) => {
                  const tx = order.transactions?.[0];
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-white/5 border border-white/8 rounded-2xl p-4 flex flex-col gap-3"
                    >
                      {/* Row 1: Amount + Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c3aed]/40 to-[#00bdae]/40 flex items-center justify-center font-bold text-white text-sm border border-white/10">
                            ${order.amount_usd}
                          </div>
                          <div>
                            <p className="text-white text-sm font-bold">
                              {order.creator_handle ? `@${order.creator_handle}` : "Token Purchase"}
                            </p>
                            <p className="text-[10px] text-gray-600 font-mono">
                              {new Date(order.created_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                              })}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      {/* Row 2: TX Details */}
                      {tx && (
                        <div className="bg-black/30 rounded-xl p-3 flex items-center justify-between border border-white/5">
                          <div className="flex items-center gap-2">
                            {tx.is_real_tx ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                            )}
                            <span className="font-mono text-xs text-gray-400">
                              {tx.tx_hash
                                ? `${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-6)}`
                                : "—"}
                            </span>
                          </div>
                          {tx.explorer_url ? (
                            <a
                              href={tx.explorer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-[var(--color-brand-primary)] hover:underline font-bold"
                            >
                              View on Explorer <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-600">Simulated</span>
                          )}
                        </div>
                      )}

                      {/* Row 3: Token info */}
                      {order.token_mint && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
                          <span>Token:</span>
                          <span>{order.token_mint.slice(0, 12)}...</span>
                          <a
                            href={`https://bags.fm/token/${order.token_mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-brand-primary)] hover:underline"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
