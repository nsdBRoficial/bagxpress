/**
 * src/services/audit.ts
 *
 * PT-BR: Serviço de Auditoria Criptográfica — SHA-256 Audit Proof
 * EN:    Cryptographic Audit Service — SHA-256 Audit Proof
 *
 * Fornece verificabilidade determinística da cadeia de custódia completa:
 *   pagamento → settlement → buyback → burn
 *
 * PROPRIEDADES GARANTIDAS:
 *   - Determinístico: os mesmos dados sempre geram o mesmo hash
 *   - Imutável:       qualquer alteração nos dados muda o hash
 *   - Público:        qualquer pessoa pode re-computar e verificar
 *   - Zero confiança: não depende de autoridade central
 *
 * Provides deterministic verifiability of the full custody chain:
 *   payment → settlement → buyback → burn
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// PT-BR: Tipos de entrada do Audit Proof
// EN:    Audit Proof input types
// ---------------------------------------------------------------------------

export interface AuditData {
  /** PT-BR: ID único da ordem de compra / EN: Unique purchase order ID */
  orderId:       string;
  /** PT-BR: Valor total pago em USD / EN: Total amount paid in USD */
  amountUsd:     number;
  /** PT-BR: Hash da transação de settlement (repasse ao criador) / EN: Creator payout transaction hash */
  settlementTx:  string | null;
  /** PT-BR: Hash da transação de buyback / EN: Buyback transaction hash */
  buybackTx:     string | null;
  /** PT-BR: Hash da transação de burn / EN: Burn transaction hash */
  burnTx:        string | null;
  /** PT-BR: Preço do SOL em USD no momento da transação (Oracle) / EN: SOL price in USD at transaction time (Oracle) */
  usdPerSol:     number;
  /** PT-BR: Quantidade de BXP queimada (em unidades brutas, sem decimais) / EN: Amount of BXP burned (in raw units, no decimals) */
  burnedAmount:  number;
  /** PT-BR: Timestamp ISO 8601 da transação / EN: ISO 8601 timestamp of the transaction */
  timestamp:     string;
}

export interface AuditProofResult {
  /** PT-BR: Hash SHA-256 hex da prova / EN: Hex SHA-256 hash of the proof */
  hash:      string;
  /** PT-BR: Versão do algoritmo de prova / EN: Proof algorithm version */
  version:   string;
  /** PT-BR: Dados que foram incluídos no hash / EN: Data included in the hash */
  data:      AuditData;
}

/** PT-BR: Versão do algoritmo — incrementar ao mudar o esquema / EN: Algorithm version — increment when schema changes */
const PROOF_VERSION = "bxp-audit-v1";

// ---------------------------------------------------------------------------
// PT-BR: Serialização determinística
// EN:    Deterministic serialization
// ---------------------------------------------------------------------------

/**
 * PT-BR: Serializa o AuditData de forma determinística (chaves ordenadas).
 * EN:    Serializes AuditData deterministically (sorted keys).
 *
 * CRÍTICO: O JSON.stringify padrão não garante ordem de chaves entre runtimes.
 * Ordenamos explicitamente para garantir que o hash seja sempre igual
 * independentemente de engine/plataforma.
 *
 * CRITICAL: Standard JSON.stringify doesn't guarantee key order across runtimes.
 * We sort explicitly to ensure the hash is always identical
 * regardless of engine/platform.
 *
 * @param data - Dados de auditoria / Audit data
 * @returns String JSON canônica / Canonical JSON string
 */
function canonicalize(data: AuditData): string {
  // PT-BR: Normaliza nulls para a string "null" para evitar ambiguidade
  // EN:    Normalizes nulls to the string "null" to avoid ambiguity
  const normalized: Record<string, string | number> = {
    orderId:      data.orderId,
    amountUsd:    data.amountUsd,
    settlementTx: data.settlementTx ?? "null",
    buybackTx:    data.buybackTx    ?? "null",
    burnTx:       data.burnTx       ?? "null",
    usdPerSol:    data.usdPerSol,
    burnedAmount: data.burnedAmount,
    timestamp:    data.timestamp,
    version:      PROOF_VERSION,
  };

  // PT-BR: Ordena as chaves alfabeticamente para serialização canônica
  // EN:    Sorts keys alphabetically for canonical serialization
  const sortedKeys = Object.keys(normalized).sort();
  const canonical  = sortedKeys.reduce((acc, key) => {
    acc[key] = normalized[key];
    return acc;
  }, {} as Record<string, string | number>);

  return JSON.stringify(canonical);
}

// ---------------------------------------------------------------------------
// PT-BR: Funções públicas
// EN:    Public functions
// ---------------------------------------------------------------------------

/**
 * PT-BR: Gera uma prova de auditoria SHA-256 para uma transação completa.
 * EN:    Generates a SHA-256 audit proof for a complete transaction.
 *
 * O hash é determinístico — dados idênticos sempre produzem o mesmo hash.
 * The hash is deterministic — identical data always produces the same hash.
 *
 * @param data - Dados da transação a serem provados / Transaction data to be proven
 * @returns AuditProofResult com hash e metadados / AuditProofResult with hash and metadata
 *
 * @example
 * const proof = generateAuditProof({
 *   orderId: "abc-123",
 *   amountUsd: 50,
 *   settlementTx: "5PUdxh...",
 *   buybackTx: "7KlQrt...",
 *   burnTx: "9XmNop...",
 *   usdPerSol: 147.23,
 *   burnedAmount: 242940000, // raw units (1e6 = 1 BXP)
 *   timestamp: "2026-04-18T21:00:00.000Z",
 * });
 * // proof.hash === "ab3f9c2d1e..." (64-char hex)
 */
export function generateAuditProof(data: AuditData): AuditProofResult {
  const canonical = canonicalize(data);
  const hash      = createHash("sha256").update(canonical, "utf8").digest("hex");

  console.log(`[Audit] 📋 Proof gerado para ordem ${data.orderId}: ${hash.slice(0, 16)}...`);

  return {
    hash,
    version: PROOF_VERSION,
    data,
  };
}

/**
 * PT-BR: Verifica se um hash de auditoria corresponde aos dados fornecidos.
 * EN:    Verifies whether an audit hash matches the provided data.
 *
 * Qualquer pessoa pode usar esta função para verificar a integridade da prova
 * sem depender de nenhuma autoridade ou servidor.
 *
 * Anyone can use this function to verify proof integrity
 * without relying on any authority or server.
 *
 * @param data - Dados originais da transação / Original transaction data
 * @param hash - Hash a verificar (64-char hex) / Hash to verify (64-char hex)
 * @returns true se o hash corresponde, false caso contrário / true if hash matches, false otherwise
 *
 * @example
 * const isValid = verifyAuditProof(originalData, "ab3f9c2d1e...");
 * // isValid === true
 */
export function verifyAuditProof(data: AuditData, hash: string): boolean {
  if (!hash || typeof hash !== "string" || hash.length !== 64) {
    console.warn(`[Audit] ⚠️  Hash inválido fornecido para verificação: "${hash}"`);
    return false;
  }

  const expected = createHash("sha256").update(canonicalize(data), "utf8").digest("hex");
  const isValid  = expected === hash;

  if (isValid) {
    console.log(`[Audit] ✅ Hash verificado com sucesso para ordem ${data.orderId}`);
  } else {
    console.warn(`[Audit] ❌ Hash NÃO corresponde para ordem ${data.orderId}`);
    console.warn(`[Audit]    Esperado : ${expected.slice(0, 16)}...`);
    console.warn(`[Audit]    Recebido : ${hash.slice(0, 16)}...`);
  }

  return isValid;
}

/**
 * PT-BR: Formata o hash para exibição truncada (primeiros 8 + últimos 6 chars).
 * EN:    Formats the hash for truncated display (first 8 + last 6 chars).
 *
 * @param hash - Hash completo de 64 caracteres / Full 64-character hash
 * @returns Hash truncado para exibição / Truncated hash for display
 */
export function formatAuditHash(hash: string): string {
  if (!hash || hash.length < 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
