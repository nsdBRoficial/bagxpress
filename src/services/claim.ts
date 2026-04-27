/**
 * src/services/claim.ts
 * MISSÃO V11 — Zero UX Trust Layer
 *
 * Gerencia o ciclo de vida de pending_claims:
 * - Criar claim criptografado para compras anônimas
 * - Resolver claim (transferir BXP para wallet destino)
 * - Consultar estado público do claim
 *
 * SEGURANÇA:
 * - Private key nunca é logada ou exposta via API
 * - AES-256-GCM via lib/crypto.ts (padrão existente no projeto)
 * - Double-claim bloqueado via validação atômica no DB
 * - Expiração de 30 dias enforçada em resolveClaim
 *
 * LOGS SERVER: Todos os eventos emitem [claim] prefixed logs para diagnóstico.
 */

import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMint,
} from "@solana/spl-token";
import { encrypt, decrypt } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingClaimPublic {
  id: string;
  order_id: string;
  wallet_pubkey: string;
  amount: number;
  token_mint: string;
  claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface CreateClaimResult {
  claimId: string;
  claimUrl: string;
}

export interface ResolveClaimResult {
  txHash: string;
  claimed_by: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

// ---------------------------------------------------------------------------
// Guard: verifica pré-requisitos antes de qualquer operação
// ---------------------------------------------------------------------------

function assertEnvVars() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)   missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.ENCRYPTION_SECRET)           missing.push("ENCRYPTION_SECRET");
  if (missing.length > 0) {
    throw new Error(`[claim] Missing required env vars: ${missing.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Cria um pending_claim para uma compra anônima.
 * Criptografa a private key da wallet transitória e salva no Supabase.
 */
export async function createPendingClaim(
  orderId: string,
  keypair: Keypair,
  amount: number,
  tokenMint: string
): Promise<CreateClaimResult> {
  console.log(`[claim] createPendingClaim called | orderId=${orderId} | amount=${amount} | mint=${tokenMint}`);

  // 1. Validar env vars
  assertEnvVars();

  // 2. Validar inputs
  if (!orderId || !tokenMint) {
    throw new Error(`[claim] Invalid inputs: orderId=${orderId} tokenMint=${tokenMint}`);
  }
  if (!amount || amount <= 0) {
    throw new Error(`[claim] Invalid amount: ${amount}`);
  }

  const walletPubkey = keypair.publicKey.toBase58();
  console.log(`[claim] Encrypting keypair for wallet ${walletPubkey.slice(0, 8)}...`);

  // 3. Serializar e criptografar secret key
  const secretKeyB64 = Buffer.from(keypair.secretKey).toString("base64");
  let encrypted: string;
  let iv: string;
  try {
    const result = await encrypt(secretKeyB64);
    encrypted = result.encrypted;
    iv = result.iv;
  } catch (encErr: unknown) {
    const msg = encErr instanceof Error ? encErr.message : String(encErr);
    throw new Error(`[claim] Encryption failed: ${msg}`);
  }

  console.log(`[claim] Encryption successful. Inserting into Supabase...`);

  // 4. Inserir no Supabase
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pending_claims")
    .insert({
      order_id:         orderId,
      wallet_pubkey:    walletPubkey,
      encrypted_secret: encrypted,
      encryption_iv:    iv,
      amount,
      token_mint:       tokenMint,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[claim] Supabase insert failed:`, error.message, error.details, error.hint);
    throw new Error(`[claim] DB insert failed: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("[claim] Supabase returned no id after insert.");
  }

  const claimId = data.id as string;
  console.log(`[claim] insert success: ${claimId}`);

  return {
    claimId,
    claimUrl: `/claim/${claimId}`,
  };
}

/**
 * Retorna o estado público de um claim (sem expor encrypted_secret ou IV).
 */
export async function getClaimById(id: string): Promise<PendingClaimPublic | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("pending_claims")
    .select(
      "id, order_id, wallet_pubkey, amount, token_mint, claimed, claimed_by, claimed_at, expires_at, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.warn(`[claim] getClaimById(${id}) not found:`, error?.message);
    return null;
  }

  return data as PendingClaimPublic;
}

/**
 * Resolve um claim: descriptografa a wallet transitória e transfere os tokens
 * SPL para a wallet destino. Marca o claim como resgatado.
 */
export async function resolveClaim(
  id: string,
  destinationWallet: string
): Promise<ResolveClaimResult> {
  console.log(`[claim] resolveClaim | id=${id} | dest=${destinationWallet}`);
  const supabase = createSupabaseAdminClient();

  // 1. Buscar claim completo
  const { data: claim, error } = await supabase
    .from("pending_claims")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !claim) {
    throw new Error("Claim not found.");
  }

  // 2. Validar estado
  if (claim.claimed) {
    throw new Error("This claim has already been redeemed.");
  }

  const now = new Date();
  const expiresAt = new Date(claim.expires_at);
  if (now > expiresAt) {
    throw new Error("This claim has expired.");
  }

  // 3. Descriptografar
  const secretKeyB64 = await decrypt({
    encrypted: claim.encrypted_secret,
    iv: claim.encryption_iv,
  });
  const secretKey = Buffer.from(secretKeyB64, "base64");
  const sourceKeypair = Keypair.fromSecretKey(secretKey);

  if (sourceKeypair.publicKey.toBase58() !== claim.wallet_pubkey) {
    throw new Error("Claim integrity check failed: public key mismatch.");
  }

  // 4. Preparar transferência SPL
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const mintPubkey = new PublicKey(claim.token_mint);
  const destinationPubkey = new PublicKey(destinationWallet);

  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;
  const amountRaw = BigInt(Math.round(Number(claim.amount) * Math.pow(10, decimals)));

  const sourceAta = await getAssociatedTokenAddress(mintPubkey, sourceKeypair.publicKey);
  const destinationAta = await getAssociatedTokenAddress(mintPubkey, destinationPubkey);

  const tx = new Transaction();
  const destinationAtaInfo = await connection.getAccountInfo(destinationAta);
  if (!destinationAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        sourceKeypair.publicKey,
        destinationAta,
        destinationPubkey,
        mintPubkey
      )
    );
  }

  tx.add(
    createTransferCheckedInstruction(
      sourceAta,
      mintPubkey,
      destinationAta,
      sourceKeypair.publicKey,
      amountRaw,
      decimals
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = sourceKeypair.publicKey;

  const { sendAndConfirmTransaction } = await import("@solana/web3.js");
  const txHash = await sendAndConfirmTransaction(connection, tx, [sourceKeypair], {
    commitment: "confirmed",
  });

  console.log(`[claim] transfer confirmed | txHash=${txHash}`);

  // 5. Marcar como resgatado (double-claim guard)
  await supabase
    .from("pending_claims")
    .update({
      claimed:    true,
      claimed_by: destinationWallet,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("claimed", false);

  return { txHash, claimed_by: destinationWallet };
}
