/**
 * src/services/wallet.ts
 * Gerenciamento de wallets Solana reais persistidas no Supabase.
 *
 * Responsabilidades:
 * - Criar keypair real por usuário (uma vez, ao primeiro acesso)
 * - Criptografar private key com AES-256-GCM antes de salvar
 * - Buscar ou criar wallet de forma idempotente
 * - Descriptografar para uso interno em transações (NUNCA expor via API)
 *
 * SEGURANÇA:
 * - Private key nunca é exposta em resposta de API
 * - Usa service role key (bypassa RLS) — apenas server-side
 * - Criptografia AES-256-GCM com IV único por wallet
 */

import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { encrypt, decrypt } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserWallet {
  publicKey: string;
  network: string;
  createdAt: string;
}

export interface DecryptedWallet extends UserWallet {
  keypair: Keypair;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Busca wallet existente do usuário ou cria uma nova.
 * Retorna apenas a public key (seguro para expor).
 */
export async function getOrCreateWallet(userId: string): Promise<UserWallet> {
  const supabase = createSupabaseAdminClient();

  // 1. Tenta buscar wallet existente
  const { data: existing, error: fetchError } = await supabase
    .from("wallets")
    .select("public_key, network, created_at")
    .eq("user_id", userId)
    .single();

  if (existing && !fetchError) {
    return {
      publicKey: existing.public_key,
      network: existing.network,
      createdAt: existing.created_at,
    };
  }

  // 2. Cria nova wallet
  return createWalletForUser(userId);
}

/**
 * Cria um novo Keypair Solana e persiste no banco criptografado.
 * Retorna apenas a public key.
 */
async function createWalletForUser(userId: string): Promise<UserWallet> {
  const supabase = createSupabaseAdminClient();

  // Gera keypair real
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKeyB64 = Buffer.from(keypair.secretKey).toString("base64");

  // Criptografa private key
  const { encrypted, iv } = await encrypt(privateKeyB64);

  const network = process.env.SOLANA_NETWORK ?? "devnet";

  const { data, error } = await supabase
    .from("wallets")
    .insert({
      user_id: userId,
      public_key: publicKey,
      encrypted_private_key: encrypted,
      encryption_iv: iv,
      network,
    })
    .select("public_key, network, created_at")
    .single();

  if (error) throw new Error(`Failed to persist wallet: ${error.message}`);

  return {
    publicKey: data.public_key,
    network: data.network,
    createdAt: data.created_at,
  };
}

/**
 * Recupera o Keypair completo (private key descriptografada) para assinar transações.
 * USO EXCLUSIVAMENTE SERVER-SIDE — nunca expor via API.
 */
export async function getDecryptedKeypair(userId: string): Promise<DecryptedWallet> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("wallets")
    .select("public_key, encrypted_private_key, encryption_iv, network, created_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Wallet not found. User must be authenticated.");
  }

  const privateKeyB64 = await decrypt({
    encrypted: data.encrypted_private_key,
    iv: data.encryption_iv,
  });

  const secretKey = Buffer.from(privateKeyB64, "base64");
  const keypair = Keypair.fromSecretKey(secretKey);

  return {
    keypair,
    publicKey: data.public_key,
    network: data.network,
    createdAt: data.created_at,
  };
}

/**
 * Busca o saldo SOL de uma wallet pelo public key.
 * Retorna saldo em SOL (não lamports).
 */
export async function getWalletBalance(publicKey: string): Promise<number> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const lamports = await connection.getBalance(new PublicKey(publicKey));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Tenta airdrop de SOL na devnet para a wallet do usuário.
 * Silencioso se falhar (devnet pode estar congestionada).
 */
export async function requestDevnetAirdrop(publicKey: string, solAmount = 0.1): Promise<string | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const sig = await connection.requestAirdrop(
      new PublicKey(publicKey),
      solAmount * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  } catch {
    return null;
  }
}
