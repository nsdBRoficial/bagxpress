"use client";

/**
 * src/components/BurnFeed.tsx
 *
 * PT-BR: Feed em tempo real de eventos de queima de $BXP.
 *        Escuta a tabela `burn_events` via Supabase Realtime e exibe
 *        os eventos mais recentes com timestamps relativos.
 *
 * EN:    Real-time feed of $BXP burn events.
 *        Listens to the `burn_events` table via Supabase Realtime and displays
 *        the most recent events with relative timestamps.
 *
 * Arquitetura / Architecture:
 *   - Supabase Realtime (postgres_changes) para INSERT em burn_events
 *   - Estado local com os últimos N eventos (rolagem automática)
 *   - Animação de entrada suave para cada novo evento
 *   - Fallback para busca inicial dos últimos eventos históricos
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import { ExternalLink, Flame, Wifi, WifiOff } from "lucide-react";

// ---------------------------------------------------------------------------
// PT-BR: Tipos
// EN:    Types
// ---------------------------------------------------------------------------

interface BurnEvent {
  id:            string;
  tx_hash:       string;
  amount_burned: number;        // PT-BR: unidades brutas (1e6 = 1 BXP) / EN: raw units (1e6 = 1 BXP)
  burned_at:     string;        // PT-BR: ISO 8601 / EN: ISO 8601
  source:        string;
}

// ---------------------------------------------------------------------------
// PT-BR: Configuração
// EN:    Configuration
// ---------------------------------------------------------------------------

/** PT-BR: Máximo de eventos exibidos simultaneamente / EN: Maximum events displayed simultaneously */
const MAX_EVENTS = 8;

/** PT-BR: Precisão exibida de BXP (decimais do token, geralmente 6) / EN: Displayed BXP precision (token decimals, usually 6) */
const BXP_DECIMALS = 1_000_000;

// ---------------------------------------------------------------------------
// PT-BR: Utilitários
// EN:    Utilities
// ---------------------------------------------------------------------------

/**
 * PT-BR: Formata a quantidade de BXP de unidades brutas para exibição humana.
 * EN:    Formats BXP amount from raw units to human-readable display.
 */
function formatBxp(rawAmount: number): string {
  const human = rawAmount / BXP_DECIMALS;
  return human.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * PT-BR: Calcula o tempo relativo desde burned_at (ex: "2s ago", "5m ago").
 * EN:    Calculates relative time since burned_at (e.g., "2s ago", "5m ago").
 */
function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffS  = Math.floor(diffMs / 1000);

  if (diffS < 60)   return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  return `${Math.floor(diffS / 3600)}h ago`;
}

// ---------------------------------------------------------------------------
// PT-BR: Componente principal
// EN:    Main component
// ---------------------------------------------------------------------------

interface BurnFeedProps {
  /** PT-BR: Título customizável do feed / EN: Customizable feed title */
  title?: string;
  /** PT-BR: Cluster do Solana para links do Explorer / EN: Solana cluster for Explorer links */
  cluster?: "devnet" | "mainnet-beta" | "testnet";
}

export default function BurnFeed({
  title   = "🔥 Live Burn Feed",
  cluster = "devnet",
}: BurnFeedProps) {
  const [events,    setEvents]    = useState<BurnEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [tick,      setTick]      = useState(0); // PT-BR: para atualizar timestamps / EN: to refresh timestamps
  const bottomRef = useRef<HTMLDivElement>(null);

  // PT-BR: Atualiza timestamps relativos a cada 5 segundos
  // EN:    Refreshes relative timestamps every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(interval);
  }, []);

  // PT-BR: Scroll automático para o final quando novos eventos chegam
  // EN:    Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  // PT-BR: Supabase Realtime — escuta INSERT em burn_events
  // EN:    Supabase Realtime — listens to INSERT on burn_events
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // PT-BR: Busca os últimos MAX_EVENTS eventos históricos ao montar
    // EN:    Fetches last MAX_EVENTS historical events on mount
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("burn_events")
        .select("*")
        .order("burned_at", { ascending: false })
        .limit(MAX_EVENTS);

      if (data) {
        setEvents(data.reverse()); // PT-BR: cronológico / EN: chronological
      }
      setLoading(false);
    };

    fetchInitial();

    // PT-BR: Canal Realtime para novos burns
    // EN:    Realtime channel for new burns
    const channel = supabase
      .channel("burn_events_feed")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "burn_events",
        },
        (payload) => {
          const newEvent = payload.new as BurnEvent;
          setEvents((prev) => {
            // PT-BR: Mantém apenas os últimos MAX_EVENTS eventos
            // EN:    Keeps only the last MAX_EVENTS events
            const updated = [...prev, newEvent];
            return updated.length > MAX_EVENTS
              ? updated.slice(updated.length - MAX_EVENTS)
              : updated;
          });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // PT-BR: Render
  // EN:    Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full bg-[#080808] border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black/40">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-mono font-semibold text-white">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 font-mono">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-gray-600" />
              <span className="text-[10px] text-gray-600 font-mono">CONNECTING</span>
            </>
          )}
        </div>
      </div>

      {/* Feed Body */}
      <div className="h-48 overflow-y-auto flex flex-col gap-px p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-gray-600 font-mono animate-pulse">
              Loading burn history...
            </span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <Flame className="w-6 h-6 text-gray-700" />
            <span className="text-xs text-gray-600 font-mono">
              Waiting for the first burn...
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event) => {
              const explorerUrl = `https://explorer.solana.com/tx/${event.tx_hash}?cluster=${cluster}`;
              const bxpAmount   = formatBxp(event.amount_burned);
              const ago         = timeAgo(event.burned_at);

              return (
                <motion.div
                  key={event.id ?? event.tx_hash}
                  initial={{ opacity: 0, x: -8, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0,  scale: 1 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors group"
                >
                  {/* Left: icon + amount */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm leading-none shrink-0">🔥</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-mono font-semibold text-orange-400">
                        {bxpAmount} $BXP burned
                      </span>
                      <span
                        className="text-[10px] text-gray-600 font-mono truncate"
                        title={event.tx_hash}
                      >
                        {event.tx_hash.slice(0, 10)}...{event.tx_hash.slice(-6)}
                      </span>
                    </div>
                  </div>

                  {/* Right: time + link */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* PT-BR: Tick como key força re-render do timestamp / EN: Tick as key forces timestamp re-render */}
                    <span key={tick} className="text-[10px] text-gray-500 font-mono">
                      {ago}
                    </span>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-brand-primary)] hover:text-white"
                      title="View on Solana Explorer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-gray-700 font-mono">
          {events.length} event{events.length !== 1 ? "s" : ""} · Supabase Realtime
        </span>
        <span className="text-[10px] text-gray-700 font-mono">
          $BXP · Solana {cluster}
        </span>
      </div>
    </div>
  );
}
