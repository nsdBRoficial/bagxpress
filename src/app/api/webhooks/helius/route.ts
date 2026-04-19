/**
 * POST /api/webhooks/helius/route.ts
 *
 * PT-BR: Webhook receptor para eventos on-chain do Helius.
 * EN:    Webhook receiver for Helius on-chain events.
 *
 * Responsabilidades / Responsibilities:
 *   1. Valida o secret token do Helius (header `authorization`)
 *   2. Filtra eventos de burn do token BXP
 *   3. Persiste eventos únicos na tabela `burn_events` (idempotente por tx_hash)
 *   4. Retorna 200 rapidamente para evitar reenvios do Helius
 *
 * Configuração necessária / Required configuration:
 *   - HELIUS_WEBHOOK_SECRET: secret definido no Helius Dashboard
 *   - BXP_TOKEN_MINT:        mint address do token BXP
 *   - SUPABASE_SERVICE_ROLE_KEY: para escrita no banco sem RLS
 *
 * Helius envia POST com array de Enhanced Transaction objects:
 *   https://docs.helius.dev/webhooks-and-websockets/enhanced-webhooks
 *
 * SEGURANÇA:
 *   - Validação de secret (Bearer token) contra tempo constante (timing-safe)
 *   - Idempotência por UNIQUE constraint no tx_hash (sem duplicatas)
 *   - Nenhuma informação sensível exposta em erros públicos
 */

import { NextResponse } from "next/server";
import { createClient }  from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// PT-BR: Admin client do Supabase — bypassa RLS para escrita no banco
// EN:    Supabase admin client — bypasses RLS for database writes
// ---------------------------------------------------------------------------
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// PT-BR: Tipos do payload Helius Enhanced Transaction
// EN:    Helius Enhanced Transaction payload types
// ---------------------------------------------------------------------------

interface HelisTokenTransfer {
  /** PT-BR: Mint address do token / EN: Token mint address */
  mint:        string;
  /** PT-BR: Endereço de origem / EN: Source address */
  fromUserAccount?: string;
  /** PT-BR: Endereço de destino / EN: Destination address */
  toUserAccount?:   string;
  /** PT-BR: Quantidade transferida (em unidades base) / EN: Amount transferred (in base units) */
  tokenAmount: number;
}

interface HeliusEvent {
  /** PT-BR: Assinatura (hash) da transação / EN: Transaction signature (hash) */
  signature:      string;
  /** PT-BR: Timestamp Unix da transação / EN: Transaction Unix timestamp */
  timestamp:      number;
  /** PT-BR: Tipo de evento Helius / EN: Helius event type */
  type:           string;
  /** PT-BR: Transferências de token na transação / EN: Token transfers in the transaction */
  tokenTransfers?: HelisTokenTransfer[];
  /** PT-BR: Descrição legível do evento / EN: Human-readable event description */
  description?:   string;
}

// ---------------------------------------------------------------------------
// PT-BR: Validação timing-safe do secret do webhook
// EN:    Timing-safe webhook secret validation
// ---------------------------------------------------------------------------

/**
 * PT-BR: Compara dois strings de forma timing-safe para prevenir timing attacks.
 * EN:    Compares two strings in a timing-safe way to prevent timing attacks.
 *
 * SEGURANÇA: Não use === para comparar secrets — vazamento de timing.
 * SECURITY:  Don't use === to compare secrets — timing leak.
 */
function isValidSecret(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
      // PT-BR: Mesmo com tamanhos diferentes, fazemos a comparação para tempo constante
      // EN:    Even with different lengths, we compare for constant time
      timingSafeEqual(Buffer.alloc(b.length), b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PT-BR: Extrai o amount total de BXP queimado de um evento Helius
// EN:    Extracts total BXP burned amount from a Helius event
// ---------------------------------------------------------------------------

/**
 * PT-BR: Identifica e agrega transferências do BXP Mint no evento.
 * EN:    Identifies and aggregates BXP Mint transfers in the event.
 *
 * @param event   - Evento Helius Enhanced Transaction
 * @param bxpMint - Mint address do token BXP
 * @returns Amount total em unidades base, ou 0 se não houver transferências BXP
 */
function extractBxpBurnAmount(event: HeliusEvent, bxpMint: string): number {
  if (!event.tokenTransfers?.length) return 0;

  return event.tokenTransfers
    .filter((t) => t.mint === bxpMint)
    .reduce((sum, t) => sum + (t.tokenAmount ?? 0), 0);
}

// ---------------------------------------------------------------------------
// PT-BR: Handler principal do webhook
// EN:    Main webhook handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // ── 1. Validar secret do Helius ───────────────────────────────────────────
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET ?? "";
  const bxpMint       = (process.env.BXP_TOKEN_MINT ?? "").trim().replace(/['"\s#].*$/g, "");

  if (!webhookSecret) {
    // PT-BR: Secret não configurado — rejeita silenciosamente (não expõe detalhes)
    // EN:    Secret not configured — silently rejects (doesn't expose details)
    console.error("[Helius Webhook] ❌ HELIUS_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  // PT-BR: Suporta "Bearer <secret>" ou direto o secret
  // EN:    Supports "Bearer <secret>" or the secret directly
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!isValidSecret(providedSecret, webhookSecret)) {
    console.warn("[Helius Webhook] ⚠️  Secret inválido — request rejeitado");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parsear payload ────────────────────────────────────────────────────
  let events: HeliusEvent[];

  try {
    const body = await req.json();
    // PT-BR: Helius envia um array de eventos
    // EN:    Helius sends an array of events
    events = Array.isArray(body) ? body : [body];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Helius Webhook] ❌ Falha ao parsear payload: ${msg}`);
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  if (!events.length) {
    return NextResponse.json({ processed: 0 });
  }

  // ── 3. Filtrar e processar eventos de burn do BXP ─────────────────────────
  const admin = getAdminClient();
  let processed = 0;
  let skipped   = 0;

  for (const event of events) {
    // PT-BR: Filtra apenas eventos que envolvem transferências do BXP
    // EN:    Filters only events involving BXP token transfers
    if (!event.signature || !event.tokenTransfers?.length) {
      skipped++;
      continue;
    }

    // PT-BR: Verifica se o evento inclui o mint do BXP
    // EN:    Checks if the event includes the BXP mint
    const hasBxpTransfer = event.tokenTransfers.some(
      (t) => bxpMint && t.mint === bxpMint
    );

    if (!hasBxpTransfer && bxpMint) {
      skipped++;
      continue;
    }

    const amountBurned = extractBxpBurnAmount(event, bxpMint);
    const burnedAt     = event.timestamp
      ? new Date(event.timestamp * 1000).toISOString()
      : new Date().toISOString();

    // ── 4. Persistir com idempotência por tx_hash ─────────────────────────
    //    PT-BR: `onConflict: "tx_hash"` garante que a mesma TX nunca é inserida duas vezes.
    //    EN:    `onConflict: "tx_hash"` ensures the same TX is never inserted twice.
    const { error: dbError } = await admin
      .from("burn_events")
      .upsert(
        {
          tx_hash:      event.signature,
          amount_burned: amountBurned,
          burned_at:    burnedAt,
          source:       "helius",
        },
        {
          onConflict:        "tx_hash",
          ignoreDuplicates:  true,   // PT-BR: silencia conflitos de idempotência / EN: silences idempotency conflicts
        }
      );

    if (dbError) {
      // PT-BR: Log detalhado no servidor, mas continua processando outros eventos
      // EN:    Detailed server log, but continues processing other events
      console.error(
        `[Helius Webhook] ❌ Erro ao salvar burn_event para ${event.signature}: ${dbError.message}`
      );
    } else {
      console.log(
        `[Helius Webhook] 🔥 Burn registrado: ${event.signature.slice(0, 10)}... ` +
        `| amount: ${amountBurned} | at: ${burnedAt}`
      );
      processed++;
    }
  }

  console.log(
    `[Helius Webhook] ✅ Processamento concluído: ${processed} salvos, ${skipped} ignorados`
  );

  // PT-BR: Sempre retorna 200 para evitar reenvios do Helius
  // EN:    Always returns 200 to avoid Helius retries
  return NextResponse.json({ processed, skipped });
}
