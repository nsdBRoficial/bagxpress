"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Search, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import clsx from "clsx";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreatorProfile {
  displayName: string;
  avatarUrl: string | null;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
  royaltyPercent: number;
  isCreator: boolean;
  twitterUsername?: string;
  bagsUsername?: string;
}

export interface CreatorData {
  tokenMint: string | null;
  creators: CreatorProfile[];
  primaryCreator: CreatorProfile | null;
  _note?: string;
}

interface FeedToken {
  name: string;
  symbol: string;
  image: string;
  tokenMint: string;
  status: string;
  twitter: string;
}

interface CreatorCardProps {
  /** Chamado quando um creator é selecionado — passa os dados para o BuyWidget */
  onCreatorSelected?: (creator: CreatorProfile, tokenMint: string | null) => void;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const PROVIDER_LABEL: Record<string, string> = {
  twitter: "X / Twitter",
  tiktok: "TikTok",
  kick: "Kick",
  github: "GitHub",
  instagram: "Instagram",
  unknown: "Unknown",
};

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider || provider === "unknown") return null;
  const label = PROVIDER_LABEL[provider] ?? provider;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/10 text-gray-300 border border-white/10">
      {provider === "twitter" && (
        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function StatusDot({ source }: { source: string | null }) {
  const isLive = source === "bags_api" || source === "handle_lookup_live";
  const isSocial = source === "handle_not_found" || source === "handle_lookup";
  const isDemo = source === "demo_fallback";

  return (
    <div className="flex items-center gap-2">
      <div className={clsx(
        "w-1.5 h-1.5 rounded-full",
        isLive && "bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse",
        isSocial && "bg-yellow-400",
        isDemo && "bg-yellow-400",
      )} />
      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
        {isLive ? "BAGS LIVE API" : isSocial ? "Social Lookup" : "Demo Mode"}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

export default function CreatorCard({ onCreatorSelected }: CreatorCardProps) {
  const [handle, setHandle] = useState("");
  const [tokenMintInput, setTokenMintInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CreatorData | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [selected, setSelected] = useState<CreatorProfile | null>(null);
  const [feedTokens, setFeedTokens] = useState<FeedToken[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Carrega o token feed da Bags ao montar o componente
  useEffect(() => {
    const loadFeed = async () => {
      try {
        const res = await fetch("/api/bags/feed");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Pega só os 5 primeiros com tokenMint válido
          setFeedTokens(
            json.data
              .filter((t: FeedToken) => t.tokenMint && t.name)
              .slice(0, 5)
          );
        }
      } catch {
        // silencioso — feed é complementar
      } finally {
        setFeedLoading(false);
      }
    };
    loadFeed();
  }, []);

  const performSearch = async (mintOverride?: string) => {
    const mint = mintOverride ?? (tokenMintInput.trim() || null);
    const h = handle.trim().replace(/^@/, "") || null;

    if (!mint && !h) return;

    setIsLoading(true);
    setError(null);
    setData(null);
    setSelected(null);

    try {
      const params = new URLSearchParams();
      if (mint) {
        params.set("tokenMint", mint);
        // Preenche o input para feedback visual
        if (mintOverride) setTokenMintInput(mint);
      } else {
        params.set("handle", h!);
      }

      const res = await fetch(`/api/bags/creator?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Error fetching creator");
      }

      setData(json.data);
      setSource(json.source);

      if (json.data?.primaryCreator) {
        const primary = json.data.primaryCreator;
        setSelected(primary);
        onCreatorSelected?.(primary, json.data.tokenMint);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const selectCreator = (creator: CreatorProfile) => {
    setSelected(creator);
    onCreatorSelected?.(creator, data?.tokenMint ?? null);
  };

  // Quando clica em token do feed trending
  const handleFeedTokenClick = (token: FeedToken) => {
    performSearch(token.tokenMint);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Token Mint Address (recommended)
          </label>
          <div className="relative">
            <input
              id="bags-token-mint-input"
              type="text"
              value={tokenMintInput}
              onChange={(e) => setTokenMintInput(e.target.value)}
              placeholder="Ex: CyXBDcVQuHyEDbG661Jf3iHqxyd9wNHhE2SiQdNrBAGS"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)] transition-all font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-600 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Creator Handle
          </label>
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">@</span>
              <input
                id="bags-creator-handle-input"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="twitter_handle"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)] transition-all"
              />
            </div>
            <button
              id="bags-creator-search-btn"
              type="submit"
              disabled={isLoading || (!handle.trim() && !tokenMintInput.trim())}
              className="px-5 py-3 rounded-xl bg-[var(--color-brand-primary)] text-white font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trending Tokens Feed — exibe quando não há busca ativa */}
      <AnimatePresence>
        {!data && !isLoading && feedTokens.length > 0 && (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--color-brand-secondary)]" />
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                Trending on Bags
              </span>
              <div className="flex-1 h-px bg-white/5" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_#4ade80]" />
            </div>

            {feedLoading ? (
              <div className="flex items-center gap-2 text-gray-600 text-xs py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading feed...
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {feedTokens.map((token, idx) => (
                  <motion.button
                    key={token.tokenMint}
                    id={`feed-token-${idx}`}
                    onClick={() => handleFeedTokenClick(token)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/8 hover:border-[var(--color-brand-primary)]/40 hover:bg-white/8 transition-all group"
                  >
                    {/* Token image */}
                    {token.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.image}
                        alt={token.name}
                        className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${token.symbol}&background=7c3aed&color=fff&size=32`;
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {token.symbol?.charAt(0) ?? "?"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold truncate">{token.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono shrink-0">${token.symbol}</span>
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono truncate">
                        {token.tokenMint.slice(0, 12)}...
                      </div>
                    </div>

                    <span className={clsx(
                      "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0",
                      token.status === "GRADUATED"
                        ? "bg-green-500/20 text-green-400"
                        : token.status === "LAUNCHED"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {token.status === "GRADUATED" ? "✅ Grad" : token.status === "LAUNCHED" ? "🚀 Live" : "⏳ Pre"}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Creator Profile Cards */}
      <AnimatePresence>
        {data && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            {/* Source badge */}
            <div className="flex items-center gap-2">
              <StatusDot source={source} />
              {data.tokenMint && (
                <a
                  href={`https://bags.fm/token/${data.tokenMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-brand-primary)] hover:underline"
                >
                  View on Bags <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            {/* Cards dos creators */}
            {data.creators.map((creator, idx) => {
              const isSelected = selected?.wallet === creator.wallet;
              return (
                <motion.button
                  key={`${creator.wallet}-${idx}`}
                  id={`creator-card-${idx}`}
                  onClick={() => selectCreator(creator)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={clsx(
                    "w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-4",
                    isSelected
                      ? "bg-white/10 border-[var(--color-brand-primary)] shadow-[0_0_20px_rgba(124,58,237,0.2)]"
                      : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {creator.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-white/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-secondary)] flex items-center justify-center font-bold text-white text-lg">
                        {creator.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {creator.isCreator && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-brand-primary)] flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm truncate">
                        @{creator.displayName}
                      </span>
                      <ProviderBadge provider={creator.provider} />
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate">
                      {creator.wallet.length > 20
                        ? `${creator.wallet.slice(0, 8)}...${creator.wallet.slice(-8)}`
                        : creator.wallet}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-[var(--color-brand-secondary)]">
                        {creator.royaltyPercent}% royalty
                      </span>
                      {creator.isCreator && (
                        <span className="text-[10px] text-[var(--color-brand-primary)] font-bold uppercase tracking-wider">
                          Primary Creator
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  <div className={clsx(
                    "w-5 h-5 rounded-full border-2 transition-all shrink-0",
                    isSelected
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]"
                      : "border-white/20"
                  )}>
                    {isSelected && (
                      <CheckCircle2 className="w-full h-full text-white" />
                    )}
                  </div>
                </motion.button>
              );
            })}

            {/* Note about handle-only mode */}
            {data._note && (
              <p className="text-[10px] text-gray-600 italic px-1">
                ℹ️ {data._note}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
