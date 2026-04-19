/**
 * src/services/oracle.ts
 *
 * PT-BR: Serviço de Oráculo de Preço — SOL/USD Live Feed
 * EN:    Price Oracle Service — SOL/USD Live Feed
 *
 * Estratégia de redundância em cascata / Cascade redundancy strategy:
 *   1. Jupiter Price API V6  → https://price.jup.ag/v6/price?ids=SOL  (PRINCIPAL)
 *   2. Pyth Network HTTP API → https://hermes.pyth.network/api/latest_price_feeds (FALLBACK)
 *   3. Valor hardcoded $150  → Emergência se ambas as APIs falharem (SAFETY NET)
 *
 * O preço é cacheado por 60 segundos para evitar throttling nas APIs.
 */

/** PT-BR: Mint address do SOL Wrapped / EN: Wrapped SOL mint address */
const WSOL_MINT = "So11111111111111111111111111111111111111112";

/** PT-BR: Price Feed ID do SOL na Pyth Network / EN: SOL price feed ID on Pyth Network */
const PYTH_SOL_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/** PT-BR: Valor de fallback seguro em caso de falha total das APIs / EN: Safe fallback value if all APIs fail */
const FALLBACK_USD_PER_SOL = 150;

/** PT-BR: Duração do cache em milissegundos (60 segundos) / EN: Cache duration in milliseconds (60 seconds) */
const CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// PT-BR: Cache simples em memória (processo-level) para evitar excesso de chamadas
// EN:    Simple in-memory cache (process-level) to avoid excessive calls
// ---------------------------------------------------------------------------
let cachedPrice: number | null = null;
let cacheTimestamp = 0;

export interface OraclePriceResult {
  /** PT-BR: Preço de 1 SOL em USD / EN: Price of 1 SOL in USD */
  usdPerSol: number;
  /** PT-BR: Fonte do preço / EN: Price source */
  source: "jupiter" | "pyth" | "fallback";
  /** PT-BR: Se o preço veio do cache / EN: Whether the price came from cache */
  cached: boolean;
  /** PT-BR: Timestamp da busca / EN: Fetch timestamp */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// PT-BR: Provider 1 — Jupiter Price API V6
// EN:    Provider 1 — Jupiter Price API V6
// ---------------------------------------------------------------------------

/**
 * PT-BR: Busca o preço do SOL via Jupiter Price API V6.
 * EN:    Fetches SOL price via Jupiter Price API V6.
 *
 * Endpoint: https://price.jup.ag/v6/price?ids=SOL
 * Resposta esperada / Expected response:
 *   { data: { SOL: { price: 145.32, ... } } }
 *
 * @returns Preço em USD ou null se falhar / USD price or null if failed
 */
async function fetchFromJupiter(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000); // 5s timeout

    const res = await fetch(
      `https://price.jup.ag/v6/price?ids=${WSOL_MINT}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Oracle] Jupiter respondeu ${res.status} — tentando Pyth...`);
      return null;
    }

    const json = await res.json();
    // PT-BR: Jupiter retorna o preço pelo mint address do WSOL como chave
    // EN:    Jupiter returns the price keyed by the WSOL mint address
    const price = json?.data?.[WSOL_MINT]?.price ?? json?.data?.["SOL"]?.price;

    if (typeof price !== "number" || price <= 0) {
      console.warn(`[Oracle] Jupiter retornou preço inválido: ${JSON.stringify(json?.data)}`);
      return null;
    }

    console.log(`[Oracle] ✅ Jupiter Price API: 1 SOL = $${price.toFixed(2)}`);
    return price;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[Oracle] Jupiter falhou: ${msg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// PT-BR: Provider 2 — Pyth Network Hermes HTTP API
// EN:    Provider 2 — Pyth Network Hermes HTTP API
// ---------------------------------------------------------------------------

/**
 * PT-BR: Busca o preço do SOL via Pyth Network Hermes HTTP API.
 * EN:    Fetches SOL price via Pyth Network Hermes HTTP API.
 *
 * Endpoint: https://hermes.pyth.network/api/latest_price_feeds?ids[]=<FEED_ID>
 * O preço retornado é um número inteiro com expoente negativo (ex: 14532000000 × 10^-8)
 * The returned price is an integer with a negative exponent (e.g., 14532000000 × 10^-8)
 *
 * @returns Preço em USD ou null se falhar / USD price or null if failed
 */
async function fetchFromPyth(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000); // 5s timeout

    const url = `https://hermes.pyth.network/api/latest_price_feeds?ids[]=${PYTH_SOL_FEED_ID}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Oracle] Pyth Hermes respondeu ${res.status}`);
      return null;
    }

    const json = await res.json();
    const feed = Array.isArray(json) ? json[0] : json?.[0];

    if (!feed?.price?.price || !feed?.price?.expo) {
      console.warn(`[Oracle] Pyth Hermes retornou estrutura inesperada: ${JSON.stringify(feed)}`);
      return null;
    }

    // PT-BR: Converte o preço Pyth: price × 10^expo
    // EN:    Converts Pyth price: price × 10^expo
    const rawPrice = parseInt(feed.price.price, 10);
    const expo = parseInt(feed.price.expo, 10);
    const price = rawPrice * Math.pow(10, expo);

    if (!isFinite(price) || price <= 0) {
      console.warn(`[Oracle] Pyth preço calculado inválido: ${rawPrice} × 10^${expo} = ${price}`);
      return null;
    }

    console.log(`[Oracle] ✅ Pyth Network: 1 SOL = $${price.toFixed(2)}`);
    return price;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[Oracle] Pyth falhou: ${msg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// PT-BR: Função principal de busca de preço com cascata e cache
// EN:    Main price fetch function with cascade and cache
// ---------------------------------------------------------------------------

/**
 * PT-BR: Retorna o preço atual do SOL em USD com dupla redundância e cache.
 * EN:    Returns the current SOL price in USD with dual redundancy and cache.
 *
 * Sequência de tentativas / Attempt sequence:
 *   1. Cache (se válido)
 *   2. Jupiter Price API V6
 *   3. Pyth Network Hermes
 *   4. Fallback hardcoded ($150)
 *
 * @returns OraclePriceResult com o preço e metadados da fonte
 */
export async function getSolPrice(): Promise<OraclePriceResult> {
  const now = Date.now();

  // PT-BR: Verifica cache — evita chamadas desnecessárias dentro do TTL
  // EN:    Checks cache — avoids unnecessary calls within TTL
  if (cachedPrice !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    console.log(`[Oracle] 💾 Cache hit: 1 SOL = $${cachedPrice.toFixed(2)} (${Math.round((now - cacheTimestamp) / 1000)}s atrás)`);
    return {
      usdPerSol:  cachedPrice,
      source:     "jupiter", // PT-BR: conserva a fonte original / EN: preserves original source
      cached:     true,
      fetchedAt:  new Date(cacheTimestamp).toISOString(),
    };
  }

  // PT-BR: Tentativa 1 — Jupiter (principal)
  // EN:    Attempt 1 — Jupiter (primary)
  const jupiterPrice = await fetchFromJupiter();
  if (jupiterPrice !== null) {
    cachedPrice = jupiterPrice;
    cacheTimestamp = now;
    return {
      usdPerSol: jupiterPrice,
      source:    "jupiter",
      cached:    false,
      fetchedAt: new Date(now).toISOString(),
    };
  }

  // PT-BR: Tentativa 2 — Pyth Network (fallback)
  // EN:    Attempt 2 — Pyth Network (fallback)
  const pythPrice = await fetchFromPyth();
  if (pythPrice !== null) {
    cachedPrice = pythPrice;
    cacheTimestamp = now;
    return {
      usdPerSol: pythPrice,
      source:    "pyth",
      cached:    false,
      fetchedAt: new Date(now).toISOString(),
    };
  }

  // PT-BR: Safety net — valor hardcoded de emergência
  // EN:    Safety net — hardcoded emergency value
  console.error(
    `[Oracle] ❌ Todas as APIs falharam. Usando fallback: $${FALLBACK_USD_PER_SOL}/SOL`
  );
  return {
    usdPerSol: FALLBACK_USD_PER_SOL,
    source:    "fallback",
    cached:    false,
    fetchedAt: new Date(now).toISOString(),
  };
}

/**
 * PT-BR: Converte um valor em USD para lamports usando o preço Oracle atual.
 * EN:    Converts a USD amount to lamports using the current Oracle price.
 *
 * @param usdAmount  - Valor em USD / USD amount
 * @param usdPerSol  - Preço do SOL em USD (do Oracle) / SOL price in USD (from Oracle)
 * @returns Lamports como inteiro seguro / Lamports as safe integer
 */
export function usdToLamportsWithOracle(usdAmount: number, usdPerSol: number): number {
  const solAmount = usdAmount / usdPerSol;
  return Math.floor(solAmount * 1_000_000_000); // 1 SOL = 1e9 lamports
}
