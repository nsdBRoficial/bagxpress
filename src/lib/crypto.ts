/**
 * src/lib/crypto.ts
 * Criptografia AES-256-GCM para proteger private keys de wallets Solana.
 *
 * SEGURANÇA:
 * - Usa WebCrypto API nativa (Node.js 18+) — sem dependências externas
 * - Cada operação gera um IV aleatório único de 12 bytes
 * - A chave mestre (ENCRYPTION_SECRET) nunca é exposta no cliente
 * - Dados criptografados são inúteis sem a chave mestre
 *
 * NUNCA use estas funções em client components — apenas server-side.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

/**
 * Deriva a CryptoKey a partir do ENCRYPTION_SECRET do ambiente.
 * A chave deve ter exatamente 32 bytes (64 chars hex).
 */
async function getMasterKey(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  // Converte hex string para bytes
  const keyBytes = Buffer.from(secret.padEnd(64, "0").slice(0, 64), "hex");

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedData {
  encrypted: string; // Base64
  iv: string;        // Base64 — necessário para descriptografar
}

/**
 * Criptografa um texto plano com AES-256-GCM.
 * Retorna { encrypted, iv } — ambos necessários para descriptografar.
 */
export async function encrypt(plaintext: string): Promise<EncryptedData> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para GCM
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return {
    encrypted: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

/**
 * Descriptografa dados criptografados com encrypt().
 * Requer o mesmo IV usado na criptografia e a mesma ENCRYPTION_SECRET.
 */
export async function decrypt(data: EncryptedData): Promise<string> {
  const key = await getMasterKey();
  const iv = Buffer.from(data.iv, "base64");
  const ciphertext = Buffer.from(data.encrypted, "base64");

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
