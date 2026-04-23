"use client";

/**
 * PhantomContext — Lightweight Phantom wallet integration.
 * PT-BR: Contexto para conexão opcional com Phantom. Não substitui o Zero-UX.
 * EN:    Optional Phantom wallet context. Does NOT replace Zero-UX flow.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface PhantomProvider {
  publicKey: { toString: () => string } | null;
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
}

interface PhantomContextValue {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isPhantomInstalled: boolean;
}

// -----------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------

const PhantomContext = createContext<PhantomContextValue>({
  publicKey: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  isPhantomInstalled: false,
});

// -----------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------

export function PhantomProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);

  const getPhantom = (): PhantomProvider | null => {
    if (typeof window === "undefined") return null;
    const phantom = (window as unknown as { solana?: PhantomProvider }).solana;
    if (phantom?.isPhantom) return phantom;
    return null;
  };

  // Detect Phantom on mount
  useEffect(() => {
    const phantom = getPhantom();
    if (phantom) {
      setIsPhantomInstalled(true);

      // Try to reconnect silently if already trusted
      phantom.connect({ onlyIfTrusted: true })
        .then((resp) => {
          setPublicKey(resp.publicKey.toString());
          setConnected(true);
        })
        .catch(() => {
          // Not trusted / not connected — silent fail
        });
    }
  }, []);

  const connect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    try {
      setConnecting(true);
      const resp = await phantom.connect();
      setPublicKey(resp.publicKey.toString());
      setConnected(true);
    } catch (err) {
      console.warn("[Phantom] Connection rejected:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) return;
    try {
      await phantom.disconnect();
    } catch {
      // ignore
    } finally {
      setPublicKey(null);
      setConnected(false);
    }
  }, []);

  return (
    <PhantomContext.Provider value={{ publicKey, connected, connecting, connect, disconnect, isPhantomInstalled }}>
      {children}
    </PhantomContext.Provider>
  );
}

// -----------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------

export function usePhantom() {
  return useContext(PhantomContext);
}
