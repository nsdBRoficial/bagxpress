"use client";

/**
 * PhantomContext — Lightweight Phantom wallet integration.
 * PT-BR: Contexto para conexão opcional com Phantom.
 *
 * CORREÇÕES V11.5:
 * - Hydration guard: `mounted` state evita mismatch SSR/CSR
 * - Event listeners: escuta `accountChanged` e `disconnect` da extensão
 * - Retry: se Phantom ainda não carregou no mount, tenta novamente via timeout
 * - State consistente: disconnect limpa tudo corretamente
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface PhantomProvider {
  publicKey: { toString: () => string; toBase58: () => string } | null;
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
  isConnected: boolean;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface PhantomContextValue {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  mounted: boolean;
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
  mounted: false,
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
  const [mounted, setMounted] = useState(false);

  // Refs para event handlers (permite removeEventListener limpo)
  const onAccountChangedRef = useRef<((...args: unknown[]) => void) | null>(null);
  const onDisconnectRef = useRef<((...args: unknown[]) => void) | null>(null);

  const getPhantom = useCallback((): PhantomProvider | null => {
    if (typeof window === "undefined") return null;
    const phantom = (window as unknown as { solana?: PhantomProvider }).solana;
    if (phantom?.isPhantom) return phantom;
    return null;
  }, []);

  // Registra event listeners da Phantom e retorna função de cleanup
  const attachListeners = useCallback((phantom: PhantomProvider) => {
    // Remove listeners anteriores se existirem
    if (onAccountChangedRef.current) {
      phantom.off("accountChanged", onAccountChangedRef.current);
    }
    if (onDisconnectRef.current) {
      phantom.off("disconnect", onDisconnectRef.current);
    }

    const onAccountChanged = (newPublicKey: unknown) => {
      if (newPublicKey && typeof (newPublicKey as { toString?: () => string }).toString === "function") {
        const pk = (newPublicKey as { toString: () => string }).toString();
        setPublicKey(pk);
        setConnected(true);
        localStorage.setItem("phantom_auto_connect", "true");
      } else {
        // Conta removida/desconectada
        setPublicKey(null);
        setConnected(false);
        localStorage.removeItem("phantom_auto_connect");
      }
    };

    const onDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
      localStorage.removeItem("phantom_auto_connect");
    };

    onAccountChangedRef.current = onAccountChanged as (...args: unknown[]) => void;
    onDisconnectRef.current = onDisconnect;

    phantom.on("accountChanged", onAccountChangedRef.current);
    phantom.on("disconnect", onDisconnectRef.current);

    return () => {
      phantom.off("accountChanged", onAccountChangedRef.current!);
      phantom.off("disconnect", onDisconnectRef.current!);
    };
  }, []);

  // Detect Phantom on mount — com retry para quando a extensão ainda está carregando
  useEffect(() => {
    setMounted(true);

    let cleanupListeners: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryDetect = async (attempt = 0) => {
      const phantom = getPhantom();

      if (phantom) {
        setIsPhantomInstalled(true);
        cleanupListeners = attachListeners(phantom);
        
        // Auto-connect apenas se o usuário tiver conectado explicitamente antes (evita popup indesejado)
        if (localStorage.getItem("phantom_auto_connect") === "true") {
          try {
            const resp = await phantom.connect({ onlyIfTrusted: true });
            if (resp.publicKey) {
              setPublicKey(resp.publicKey.toString());
              setConnected(true);
            }
          } catch (err) {
            console.warn("Phantom auto-connect failed:", err);
            localStorage.removeItem("phantom_auto_connect");
          }
        }
      } else if (attempt < 3) {
        // Retry: extensão pode ainda estar injetando no window.solana
        retryTimer = setTimeout(() => tryDetect(attempt + 1), 500);
      }
    };

    tryDetect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupListeners) cleanupListeners();
    };
  }, [getPhantom, attachListeners]);

  const connect = async () => {
    if (connecting) return;
    try {
      setConnecting(true);
      const phantom = getPhantom();
      if (!phantom) {
        window.open("https://phantom.app/", "_blank");
        return;
      }
      const resp = await phantom.connect();
      setPublicKey(resp.publicKey.toString());
      setConnected(true);
      localStorage.setItem("phantom_auto_connect", "true");
      attachListeners(phantom);
    } catch (err) {
      console.error("Phantom connect error:", err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) return;
    try {
      await phantom.disconnect();
    } catch {
      // Ignora erros de disconnect
    } finally {
      setPublicKey(null);
      setConnected(false);
    }
  }, [getPhantom]);

  return (
    <PhantomContext.Provider
      value={{
        publicKey,
        connected,
        connecting,
        mounted,
        connect,
        disconnect,
        isPhantomInstalled,
      }}
    >
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
