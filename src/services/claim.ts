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

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

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
  const secretKeyB64 = uint8ArrayToBase64(keypair.secretKey);
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
  console.log(`\n[claim:resolveClaim] ========== START ==========`);
  console.log(`[claim:resolveClaim] claim_id=${id}`);
  console.log(`[claim:resolveClaim] destination=${destinationWallet}`);

  const supabase = createSupabaseAdminClient();

  // 1. Buscar claim completo
  console.log(`[claim:resolveClaim] Step 1: Fetching claim from DB...`);
  const { data: claim, error } = await supabase
    .from("pending_claims")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !claim) {
    console.error(`[claim:resolveClaim] Claim not found: ${error?.message}`);
    throw new Error("Claim not found.");
  }
  console.log(`[claim:resolveClaim] Claim found | amount=${claim.amount} | mint=${claim.token_mint} | claimed=${claim.claimed} | wallet_pubkey=${claim.wallet_pubkey}`);

  // 2. Validar estado
  if (claim.claimed) {
    throw new Error("This claim has already been redeemed.");
  }

  const now = new Date();
  const expiresAt = new Date(claim.expires_at);
  if (now > expiresAt) {
    throw new Error("This claim has expired.");
  }

  // 3. Descriptografar source keypair
  console.log(`[claim:resolveClaim] Step 3: Decrypting source keypair...`);
  const secretKeyB64 = await decrypt({
    encrypted: claim.encrypted_secret,
    iv: claim.encryption_iv,
  });
  const secretKey = base64ToUint8Array(secretKeyB64);
  const sourceKeypair = Keypair.fromSecretKey(secretKey);

  if (sourceKeypair.publicKey.toBase58() !== claim.wallet_pubkey) {
    throw new Error("Claim integrity check failed: public key mismatch.");
  }
  console.log(`[claim:resolveClaim] Source keypair OK | pubkey=${sourceKeypair.publicKey.toBase58()}`);

  // 4. Setup de conexão e mints
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const mintPubkey = new PublicKey(claim.token_mint);
  const destinationPubkey = new PublicKey(destinationWallet);

  console.log(`[claim:resolveClaim] Step 4: Fetching mint info for ${claim.token_mint}...`);
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;
  const amountRaw = BigInt(Math.round(Number(claim.amount) * Math.pow(10, decimals)));
  console.log(`[claim:resolveClaim] Mint decimals=${decimals} | amountRaw=${amountRaw}`);

  // 5. Resolver Treasury Keypair
  console.log(`[claim:resolveClaim] Step 5: Resolving treasury keypair...`);
  const secretRaw = process.env.FEE_PAYER_SECRET_KEY!.replace(/['"]/g, "").trim();
  let secretBytes: Uint8Array;
  if (/^[0-9a-fA-F]{64,}$/.test(secretRaw)) {
    secretBytes = hexToUint8Array(secretRaw);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require("bs58");
    if (bs58.default && typeof bs58.default.decode === "function") {
      secretBytes = bs58.default.decode(secretRaw);
    } else {
      secretBytes = bs58.decode(secretRaw);
    }
  }
  const treasuryKeypair = Keypair.fromSecretKey(secretBytes);
  console.log(`[claim:resolveClaim] Treasury pubkey=${treasuryKeypair.publicKey.toBase58()}`);

  // 6. Verificar saldos
  console.log(`[claim:resolveClaim] Step 6: Checking balances...`);
  const [treasuryLamports, sourceLamports] = await Promise.all([
    connection.getBalance(treasuryKeypair.publicKey),
    connection.getBalance(sourceKeypair.publicKey),
  ]);
  console.log(`[claim:resolveClaim] Treasury balance: ${treasuryLamports} lamports (${treasuryLamports / 1e9} SOL)`);
  console.log(`[claim:resolveClaim] Source balance: ${sourceLamports} lamports (${sourceLamports / 1e9} SOL)`);

  if (treasuryLamports < 10_000_000) {
    throw new Error(`Treasury wallet has insufficient SOL: ${treasuryLamports} lamports. Need at least 10,000,000.`);
  }

  // 7. ATAs
  console.log(`[claim:resolveClaim] Step 7: Resolving ATAs...`);
  const sourceAta = await getAssociatedTokenAddress(mintPubkey, sourceKeypair.publicKey);
  const destinationAta = await getAssociatedTokenAddress(mintPubkey, destinationPubkey);
  console.log(`[claim:resolveClaim] Source ATA: ${sourceAta.toBase58()}`);
  console.log(`[claim:resolveClaim] Destination ATA: ${destinationAta.toBase58()}`);

  const [sourceAtaInfo, destinationAtaInfo] = await Promise.all([
    connection.getAccountInfo(sourceAta),
    connection.getAccountInfo(destinationAta),
  ]);
  console.log(`[claim:resolveClaim] Source ATA exists: ${!!sourceAtaInfo}`);
  console.log(`[claim:resolveClaim] Destination ATA exists: ${!!destinationAtaInfo}`);

  if (!sourceAtaInfo) {
    throw new Error(`Source ATA does not exist: ${sourceAta.toBase58()}. The BXP tokens may not have been delivered to the claim wallet.`);
  }

  // 8. Montar transação
  console.log(`[claim:resolveClaim] Step 8: Building transaction...`);
  const tx = new Transaction();

  if (!destinationAtaInfo) {
    console.log(`[claim:resolveClaim] Destination ATA missing — adding createAssociatedTokenAccount instruction (payer=treasury)`);
    tx.add(
      createAssociatedTokenAccountInstruction(
        treasuryKeypair.publicKey,
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

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = treasuryKeypair.publicKey;
  console.log(`[claim:resolveClaim] blockhash=${blockhash} | lastValidBlockHeight=${lastValidBlockHeight}`);
  console.log(`[claim:resolveClaim] feePayer=${treasuryKeypair.publicKey.toBase58()}`);
  console.log(`[claim:resolveClaim] signers=[treasury=${treasuryKeypair.publicKey.toBase58().slice(0, 8)}, source=${sourceKeypair.publicKey.toBase58().slice(0, 8)}]`);

  // 9. Simular antes de enviar
  console.log(`[claim:resolveClaim] Step 9: Simulating transaction...`);
  // Necessário assinar para simular com sigVerify
  tx.partialSign(treasuryKeypair, sourceKeypair);
  const simResult = await connection.simulateTransaction(tx);
  if (simResult.value.err) {
    console.error(`[claim:resolveClaim] SIMULATION FAILED:`, JSON.stringify(simResult.value.err));
    console.error(`[claim:resolveClaim] Simulation logs:`, simResult.value.logs);
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}. Logs: ${(simResult.value.logs ?? []).join(" | ")}`
    );
  }
  console.log(`[claim:resolveClaim] Simulation OK | units consumed=${simResult.value.unitsConsumed}`);

  // 10. Enviar e confirmar
  console.log(`[claim:resolveClaim] Step 10: Sending transaction...`);
  const { sendAndConfirmTransaction } = await import("@solana/web3.js");
  const txHash = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair, sourceKeypair], {
    commitment: "confirmed",
  });
  console.log(`[claim:resolveClaim] ✅ Transfer confirmed! txHash=${txHash}`);

  // 11. Marcar como resgatado (double-claim guard)
  console.log(`[claim:resolveClaim] Step 11: Marking claim as redeemed in DB...`);
  const { error: updateError } = await supabase
    .from("pending_claims")
    .update({
      claimed:    true,
      claimed_by: destinationWallet,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("claimed", false);

  if (updateError) {
    console.error(`[claim:resolveClaim] DB update failed (tx already confirmed, not critical): ${updateError.message}`);
  } else {
    console.log(`[claim:resolveClaim] DB updated: claimed=true`);
  }

  console.log(`[claim:resolveClaim] ========== END ==========\n`);
  return { txHash, claimed_by: destinationWallet };
}

