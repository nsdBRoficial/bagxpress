/**
 * src/services/__tests__/webhook.test.ts
 *
 * PT-BR: Testes unitários do handler do Webhook Helius.
 * EN:    Unit tests for the Helius Webhook handler.
 *
 * Cobre / Covers:
 *   - Autenticação: secret inválido, ausente, correto
 *   - Idempotência: mesma TX não deve gerar registro duplicado
 *   - Filtragem: eventos sem BXP devem ser ignorados
 *   - Payload: array de eventos, evento único
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// PT-BR: Mocks de dependências externas
// EN:    Mocks for external dependencies
// ---------------------------------------------------------------------------

// PT-BR: Mock do Supabase Admin Client — captura upserts para inspeção
// EN:    Supabase Admin Client mock — captures upserts for inspection
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom   = vi.fn(() => ({ upsert: mockUpsert }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// PT-BR: Ambiente mínimo necessário
// EN:    Minimum required environment
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",    "https://fake.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY",   "fake-service-role-key");
vi.stubEnv("HELIUS_WEBHOOK_SECRET",       "test-secret-abc123");
vi.stubEnv("BXP_TOKEN_MINT",              "BXPMint11111111111111111111111111111111111111");

// ---------------------------------------------------------------------------
// PT-BR: Helpers para construir requests de teste
// EN:    Helpers to build test requests
// ---------------------------------------------------------------------------

const BXP_MINT   = "BXPMint11111111111111111111111111111111111111";
const VALID_SECRET = "test-secret-abc123";

/** PT-BR: Cria um evento Helius de burn simulado / EN: Creates a simulated Helius burn event */
function makeBurnEvent(signature = "TX_HASH_001", tokenAmount = 242_940_000) {
  return {
    signature,
    timestamp:      1713477600, // 2026-04-18T18:00:00Z
    type:           "TOKEN_MINT_BURN",
    description:    `Burned ${tokenAmount} BXP`,
    tokenTransfers: [
      {
        mint:            BXP_MINT,
        fromUserAccount: "OwnerWallet111",
        toUserAccount:   null,
        tokenAmount,
      },
    ],
  };
}

/** PT-BR: Cria um Request com autenticação e payload / EN: Creates a Request with auth and payload */
function makeRequest(
  body:   unknown,
  secret: string | null = VALID_SECRET
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret !== null) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request("http://localhost/api/webhooks/helius", {
    method:  "POST",
    headers,
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// PT-BR: Dynamic import do handler APÓS configurar mocks
// EN:    Dynamic import of handler AFTER setting up mocks
// ---------------------------------------------------------------------------

let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  // PT-BR: Re-importação dinâmica para garantir que mocks são aplicados
  // EN:    Dynamic re-import to ensure mocks are applied
  const module = await import("@/app/api/webhooks/helius/route");
  POST = module.POST;
});

// ---------------------------------------------------------------------------

describe("Helius Webhook — Autenticação", () => {
  it("deve retornar 401 se o secret estiver ausente", async () => {
    const req = makeRequest([makeBurnEvent()], null);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("deve retornar 401 se o secret for inválido", async () => {
    const req = makeRequest([makeBurnEvent()], "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("deve retornar 200 com o secret correto", async () => {
    const req = makeRequest([makeBurnEvent()]);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe("Helius Webhook — Processamento de Payload", () => {
  it("deve processar um único evento de burn e chamar upsert", async () => {
    const event = makeBurnEvent("TX_001", 500_000_000);
    const req   = makeRequest([event]);
    const res   = await POST(req);
    const body  = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(mockUpsert).toHaveBeenCalledOnce();

    const [insertedData] = mockUpsert.mock.calls[0];
    expect(insertedData.tx_hash).toBe("TX_001");
    expect(insertedData.amount_burned).toBe(500_000_000);
    expect(insertedData.source).toBe("helius");
  });

  it("deve processar múltiplos eventos em batch", async () => {
    const events = [
      makeBurnEvent("TX_BATCH_001", 100_000_000),
      makeBurnEvent("TX_BATCH_002", 200_000_000),
      makeBurnEvent("TX_BATCH_003", 300_000_000),
    ];
    const req  = makeRequest(events);
    const res  = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(3);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });

  it("deve ignorar eventos sem tokenTransfers", async () => {
    const event = { signature: "TX_NO_TRANSFERS", timestamp: 1713477600, type: "TRANSFER" };
    const req   = makeRequest([event]);
    const res   = await POST(req);
    const body  = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("deve retornar 200 mesmo com payload vazio", async () => {
    const req  = makeRequest([]);
    const res  = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("Helius Webhook — Idempotência", () => {
  it("deve usar upsert com onConflict=tx_hash para garantir idempotência", async () => {
    const req = makeRequest([makeBurnEvent("TX_DUPLICATE_001")]);
    await POST(req);

    // PT-BR: Verifica que o segundo argumento do upsert tem a opção de idempotência
    // EN:    Verifies that the second upsert argument has the idempotency option
    const [, upsertOptions] = mockUpsert.mock.calls[0];
    expect(upsertOptions?.onConflict).toBe("tx_hash");
    expect(upsertOptions?.ignoreDuplicates).toBe(true);
  });

  it("deve continuar processando outros eventos mesmo se o DB retornar erro em um", async () => {
    // PT-BR: Simula erro no primeiro upsert / EN: Simulates error in first upsert
    mockUpsert
      .mockResolvedValueOnce({ error: { message: "Duplicate key violation" } })
      .mockResolvedValue({ error: null });

    const events = [makeBurnEvent("TX_ERR"), makeBurnEvent("TX_OK")];
    const req    = makeRequest(events);
    const res    = await POST(req);

    expect(res.status).toBe(200);
    // PT-BR: O segundo evento ainda deve ser processado / EN: Second event should still be processed
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
