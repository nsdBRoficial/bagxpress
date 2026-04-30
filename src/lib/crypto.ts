/**
 * src/lib/crypto.ts
 * v2.0 — Winner Hackathon Build
 *
 * PT-BR: Criptografia AES-256-GCM para proteger private keys de wallets Solana.
 * EN: AES-256-GCM encryption to protect Solana wallet private keys.
 *
 * SEGURANÇA / SECURITY:
 * - PT-BR: Usa WebCrypto API nativa (Node.js 18+) — sem dependências externas
 * - EN: Uses native WebCrypto API (Node.js 18+) — no external dependencies
 * - PT-BR: Cada operação gera um IV aleatório único de 12 bytes
 * - EN: Each operation generates a unique random 12-byte IV
 * - PT-BR: A chave mestre (ENCRYPTION_SECRET) nunca é exposta no cliente
 * - EN: The master key (ENCRYPTION_SECRET) is never exposed client-side
 *
 * NUNCA use estas funções em client components — apenas server-side.
 * NEVER use these functions in client components — server-side only.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function toPureArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Deriva a CryptoKey a partir do ENCRYPTION_SECRET do ambiente.
 * A chave deve ter exatamente 32 bytes (64 chars hex).
 */
async function getMasterKey(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  // Converte hex string para bytes e garante ArrayBuffer puro (não SharedArrayBuffer)
  const keyBytes = hexToUint8Array(secret.padEnd(64, "0").slice(0, 64));
  const keyBuffer = toPureArrayBuffer(keyBytes);

  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
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
    { name: ALGORITHM, iv: toPureArrayBuffer(iv) },
    key,
    toPureArrayBuffer(encoded)
  );

  return {
    encrypted: uint8ArrayToBase64(ciphertext),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Descriptografa dados criptografados com encrypt().
 * Requer o mesmo IV usado na criptografia e a mesma ENCRYPTION_SECRET.
 */
export async function decrypt(data: EncryptedData): Promise<string> {
  const key = await getMasterKey();
  const ivBytes = base64ToUint8Array(data.iv);
  const ciphertextBytes = base64ToUint8Array(data.encrypted);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: toPureArrayBuffer(ivBytes) },
    key,
    toPureArrayBuffer(ciphertextBytes)
  );

  // PT-BR: Descriptografa e retorna a string UTF-8
  // EN: Decrypt and return UTF-8 string
  if (!(decrypted instanceof ArrayBuffer)) {
    throw new Error("Decryption did not return ArrayBuffer");
  }

  return new TextDecoder("utf-8").decode(decrypted);
}
