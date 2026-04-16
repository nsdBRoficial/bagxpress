/**
 * Bags API Service — v2 (LIVE DATA MODE)
 *
 * Wrapper sobre a Bags Public API REST (https://public-api-v2.bags.fm/api/v1/)
 * Usa fetch direto ao invés do SDK no server-side para evitar incompatibilidades
 * com o runtime do Next.js 16 App Router (Anchor/BN.js / Buffer polyfills).
 *
 * Endpoints ativos:
 *   - /token-launch/creator/v3       → creators de um token pelo tokenMint
 *   - /fee-share/wallet/v2           → wallet do creator por handle/provider
 *   - /token-launch/feed             → feed de tokens recentes em lançamento
 *   - /solana/bags/pools/token-mint  → pool keys (Meteora DBC + DAMM v2)
 */

const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Dados brutos de criador vindos da Bags API */
export interface BagsTokenCreator {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: "twitter" | "tiktok" | "kick" | "github" | "unknown" | null;
  providerUsername: string | null;
  twitterUsername?: string;
  bagsUsername?: string;
  isAdmin?: boolean;
}

/** Perfil normalizado de um creator da Bags */
export interface BagsCreatorProfile {
  /** Handle de exibição: providerUsername ?? username ?? wallet truncado */
  displayName: string;
  /** URL do avatar */
  avatarUrl: string | null;
  /** Endereço da carteira Solana */
  wallet: string;
  /** Plataforma social de origem */
  provider: BagsTokenCreator["provider"];
  /** Username nativo da plataforma */
  providerUsername: string | null;
  /** Royalty do creator em % */
  royaltyPercent: number;
  /** Se é o criador principal do token */
  isCreator: boolean;
  /** Username Twitter disponível */
  twitterUsername?: string;
  /** Username Bags disponível */
  bagsUsername?: string;
}

/** Resposta completa de creators de um token */
export interface BagsCreatorData {
  tokenMint: string;
  creators: BagsCreatorProfile[];
  primaryCreator: BagsCreatorProfile | null;
}

/** Item do token launch feed da Bags */
export interface BagsTokenFeedItem {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: "PRE_LAUNCH" | "LAUNCHED" | "GRADUATED" | string;
  twitter: string;
  website: string;
  launchSignature: string;
  dbcPoolKey: string;
  dbcConfigKey: string;
}

/** Pool keys de um token na Bags/Meteora */
export interface BagsPoolKeys {
  tokenMint: string;
  dbcConfigKey: string;
  dbcPoolKey: string;
  dammV2PoolKey: string;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getBagsApiKey(): string | null {
  const key = process.env.BAGS_API_KEY;
  if (!key || key === "your_bags_api_key_here") return null;
  return key;
}



function normalizeCreator(raw: BagsTokenCreator): BagsCreatorProfile {
  const displayName =
    raw.providerUsername ??
    raw.bagsUsername ??
    raw.twitterUsername ??
    raw.username ??
    truncateWallet(raw.wallet);

  return {
    displayName,
    avatarUrl: raw.pfp || null,
    wallet: raw.wallet,
    provider: raw.provider,
    providerUsername: raw.providerUsername,
    royaltyPercent: raw.royaltyBps / 100,
    isCreator: raw.isCreator,
    twitterUsername: raw.twitterUsername,
    bagsUsername: raw.bagsUsername,
  };
}

function truncateWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function buildDemoCreatorData(tokenMint: string): BagsCreatorData {
  const demo: BagsCreatorProfile = {
    displayName: "bagxpress_demo",
    avatarUrl: null,
    wallet: "BXPdemo...1234",
    provider: "twitter",
    providerUsername: "bagxpress_demo",
    royaltyPercent: 5,
    isCreator: true,
    twitterUsername: "bagxpress_demo",
    bagsUsername: "bagxpress",
  };
  return { tokenMint, creators: [demo], primaryCreator: demo };
}

// ---------------------------------------------------------------------------
// API Calls
// ---------------------------------------------------------------------------

/**
 * Busca creators de um token específico pelo tokenMint.
 * Endpoint: GET /token-launch/creator/v3?tokenMint=ADDRESS
 */
export async function getTokenCreators(
  tokenMint: string
): Promise<BagsCreatorData> {
  const apiKey = getBagsApiKey();
  if (!apiKey) return buildDemoCreatorData(tokenMint);

  const url = `${BAGS_API_BASE}/token-launch/creator/v3?tokenMint=${tokenMint}`;
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bags API [creator/v3] ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.success || !Array.isArray(data.response)) {
    throw new Error(data.error || "Resposta inesperada da Bags API");
  }

  const rawCreators: BagsTokenCreator[] = data.response;
  const creators = rawCreators.map(normalizeCreator);
  const primaryCreator = creators.find((c) => c.isCreator) ?? creators[0] ?? null;

  return { tokenMint, creators, primaryCreator };
}

/**
 * Busca a wallet de um creator pelo handle social (Twitter/TikTok/etc).
 * Se a API retornar dados, também traz o displayName e avatar_url da plataforma.
 * Endpoint: GET /fee-share/wallet/v2?username=X&provider=twitter
 */
export async function getCreatorWalletByHandle(
  username: string,
  provider: "twitter" | "tiktok" | "kick" | "github" = "twitter"
): Promise<{
  wallet: string;
  displayName: string;
  avatarUrl: string | null;
} | null> {
  const apiKey = getBagsApiKey();
  if (!apiKey) return null;

  const url = `${BAGS_API_BASE}/fee-share/wallet/v2?username=${encodeURIComponent(username)}&provider=${provider}`;

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.response) return null;

    const { wallet, platformData } = data.response;
    return {
      wallet,
      displayName: platformData?.display_name ?? platformData?.username ?? username,
      avatarUrl: platformData?.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Busca o feed de tokens em lançamento na plataforma Bags.
 * Retorna os tokens mais recentes com nome, símbolo, imagem e status.
 * Endpoint: GET /token-launch/feed
 */
export async function getTokenLaunchFeed(): Promise<BagsTokenFeedItem[]> {
  const apiKey = getBagsApiKey();
  if (!apiKey) return [];

  try {
    const response = await fetch(`${BAGS_API_BASE}/token-launch/feed`, {
      headers: { "x-api-key": apiKey },
      // Cache de 30s para não sobrecarregar a API
      next: { revalidate: 30 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.success || !Array.isArray(data.response)) return [];

    return data.response as BagsTokenFeedItem[];
  } catch {
    return [];
  }
}

/**
 * Busca os pool keys (Meteora DBC + DAMM v2) de um token específico.
 * Endpoint: GET /solana/bags/pools/token-mint?tokenMint=ADDRESS
 */
export async function getPoolByTokenMint(
  tokenMint: string
): Promise<BagsPoolKeys | null> {
  const apiKey = getBagsApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `${BAGS_API_BASE}/solana/bags/pools/token-mint?tokenMint=${tokenMint}`,
      {
        headers: { "x-api-key": apiKey },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.response) return null;

    return data.response as BagsPoolKeys;
  } catch {
    return null;
  }
}
