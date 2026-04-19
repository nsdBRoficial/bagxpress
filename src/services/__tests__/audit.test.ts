/**
 * src/services/__tests__/audit.test.ts
 *
 * PT-BR: Testes unitários do Serviço de Audit Proof SHA-256.
 * EN:    Unit tests for the SHA-256 Audit Proof Service.
 *
 * Cobre / Covers:
 *   - generateAuditProof: determinismo, formato, versão
 *   - verifyAuditProof:   caso positivo, negativo, inputs inválidos
 *   - canonicalization:   resistência a reordenação de chaves e nulls
 */

import { describe, it, expect } from "vitest";
import {
  generateAuditProof,
  verifyAuditProof,
  formatAuditHash,
  type AuditData,
} from "../audit";

// ---------------------------------------------------------------------------
// PT-BR: Dados de teste base
// EN:    Base test data
// ---------------------------------------------------------------------------
const BASE_DATA: AuditData = {
  orderId:      "order-abc-123",
  amountUsd:    50,
  settlementTx: "5PUdxhSettlement111111111111111111111111111111111",
  buybackTx:    "7KlQrtBuyback11111111111111111111111111111111111",
  burnTx:       "9XmNopBurn111111111111111111111111111111111111111",
  usdPerSol:    147.23,
  burnedAmount: 242_940_000,
  timestamp:    "2026-04-18T21:00:00.000Z",
};

// ---------------------------------------------------------------------------
// PT-BR: Suite principal
// EN:    Main test suite
// ---------------------------------------------------------------------------

describe("Audit Service — generateAuditProof", () => {
  it("deve gerar um hash SHA-256 de 64 caracteres hex", () => {
    const proof = generateAuditProof(BASE_DATA);

    expect(proof.hash).toBeTypeOf("string");
    expect(proof.hash).toHaveLength(64);
    // PT-BR: Garante que é hexadecimal puro / EN: Ensures it's pure hexadecimal
    expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deve ser determinístico — mesmos dados, mesmo hash", () => {
    const proof1 = generateAuditProof(BASE_DATA);
    const proof2 = generateAuditProof({ ...BASE_DATA });

    expect(proof1.hash).toBe(proof2.hash);
  });

  it("deve incluir a versão correta do algoritmo", () => {
    const proof = generateAuditProof(BASE_DATA);

    expect(proof.version).toBe("bxp-audit-v1");
  });

  it("deve refletir os dados originais no resultado", () => {
    const proof = generateAuditProof(BASE_DATA);

    expect(proof.data.orderId).toBe(BASE_DATA.orderId);
    expect(proof.data.amountUsd).toBe(BASE_DATA.amountUsd);
    expect(proof.data.burnedAmount).toBe(BASE_DATA.burnedAmount);
  });

  it("deve produzir hash DIFERENTE quando qualquer campo muda", () => {
    const original = generateAuditProof(BASE_DATA);

    // PT-BR: Testa cada campo individualmente
    // EN:    Tests each field individually
    const cases: Partial<AuditData>[] = [
      { orderId:      "order-DIFERENTE" },
      { amountUsd:    99 },
      { settlementTx: "HashDiferente" },
      { buybackTx:    "HashDiferente" },
      { burnTx:       "HashDiferente" },
      { usdPerSol:    200 },
      { burnedAmount: 1 },
      { timestamp:    "2099-01-01T00:00:00.000Z" },
    ];

    for (const override of cases) {
      const modified = generateAuditProof({ ...BASE_DATA, ...override });
      expect(modified.hash).not.toBe(original.hash);
    }
  });

  it("deve tratar nulls de forma determinística", () => {
    // PT-BR: Provas com nulls devem sempre gerar o mesmo hash
    // EN:    Proofs with nulls must always generate the same hash
    const dataWithNulls: AuditData = {
      ...BASE_DATA,
      settlementTx: null,
      buybackTx:    null,
      burnTx:       null,
    };

    const proof1 = generateAuditProof(dataWithNulls);
    const proof2 = generateAuditProof({ ...dataWithNulls });

    expect(proof1.hash).toBe(proof2.hash);
    expect(proof1.hash).not.toBe(generateAuditProof(BASE_DATA).hash);
  });
});

// ---------------------------------------------------------------------------

describe("Audit Service — verifyAuditProof", () => {
  it("deve retornar true para dados e hash corretos", () => {
    const proof   = generateAuditProof(BASE_DATA);
    const isValid = verifyAuditProof(BASE_DATA, proof.hash);

    expect(isValid).toBe(true);
  });

  it("deve retornar false para hash incorreto", () => {
    const proof = generateAuditProof(BASE_DATA);
    // PT-BR: Altera um caractere no hash / EN: Changes one character in the hash
    const tampered = proof.hash.slice(0, -1) + (proof.hash.endsWith("a") ? "b" : "a");

    expect(verifyAuditProof(BASE_DATA, tampered)).toBe(false);
  });

  it("deve retornar false se os dados forem alterados", () => {
    const proof = generateAuditProof(BASE_DATA);
    const alteredData = { ...BASE_DATA, amountUsd: 9999 };

    expect(verifyAuditProof(alteredData, proof.hash)).toBe(false);
  });

  it("deve retornar false para um hash vazio", () => {
    expect(verifyAuditProof(BASE_DATA, "")).toBe(false);
  });

  it("deve retornar false para um hash de tamanho incorreto (< 64 chars)", () => {
    expect(verifyAuditProof(BASE_DATA, "abc123")).toBe(false);
  });

  it("deve retornar false para um hash de tamanho incorreto (> 64 chars)", () => {
    const longHash = "a".repeat(65);
    expect(verifyAuditProof(BASE_DATA, longHash)).toBe(false);
  });

  it("deve ser consistente com generateAuditProof (round-trip)", () => {
    // PT-BR: Gera e verifica — deve ser sempre verdadeiro
    // EN:    Generate and verify — must always be true
    const testCases: AuditData[] = [
      BASE_DATA,
      { ...BASE_DATA, settlementTx: null, burnTx: null },
      { ...BASE_DATA, amountUsd: 0.001, usdPerSol: 999.99 },
    ];

    for (const testData of testCases) {
      const proof   = generateAuditProof(testData);
      const isValid = verifyAuditProof(testData, proof.hash);
      expect(isValid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------

describe("Audit Service — formatAuditHash", () => {
  it("deve truncar corretamente um hash de 64 chars", () => {
    const hash      = "ab3f9c2d1e4f5678901234567890abcdef1234567890abcdef1234567890abcd";
    const formatted = formatAuditHash(hash);

    expect(formatted).toBe("ab3f9c2d...90abcd");
    expect(formatted).toHaveLength(8 + 3 + 6); // "ab3f9c2d" + "..." + "90abcd"
  });

  it("deve retornar o hash intacto se for menor que 14 chars", () => {
    const short = "abc123";
    expect(formatAuditHash(short)).toBe(short);
  });

  it("deve retornar string vazia se hash for vazio", () => {
    expect(formatAuditHash("")).toBe("");
  });
});
