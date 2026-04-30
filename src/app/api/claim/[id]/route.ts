import { NextResponse } from "next/server";
import { getClaimById, resolveClaim } from "@/services/claim";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateWallet } from "@/services/wallet";
import { PublicKey } from "@solana/web3.js";

/**
 * GET /api/claim/[id]
 * Retorna o estado público de um claim sem expor dados sensíveis.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid claim ID." }, { status: 400 });
  }

  const claim = await getClaimById(id);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  const expired = new Date() > new Date(claim.expires_at);

  return NextResponse.json({
    id: claim.id,
    amount: claim.amount,
    token_mint: claim.token_mint,
    claimed: claim.claimed,
    claimed_by: claim.claimed_by,
    claimed_at: claim.claimed_at,
    expires_at: claim.expires_at,
    created_at: claim.created_at,
    expired,
  });
}

/**
 * POST /api/claim/[id]
 * Resolve um claim transferindo tokens BXP para a carteira destino.
 *
 * Body: { destinationWallet?: string, signature?: string, message?: string, publicKey?: string }
 *
 * Auth aceita:
 *   1. Sessão Supabase (Google/Email) — wallet é buscada/criada automaticamente
 *   2. Phantom signMessage — publicKey + signature + message
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid claim ID." }, { status: 400 });
  }

  let body: {
    destinationWallet?: string;
    signature?: string;
    message?: string;
    publicKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { destinationWallet, signature, message, publicKey } = body;

  // --- Autenticação ---
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSupabaseAuth = !!user;

  // Phantom auth: signature + message + publicKey presentes
  const isPhantomAuth = !!(signature && message && publicKey);

  if (!isSupabaseAuth && !isPhantomAuth) {
    return NextResponse.json(
      { error: "Authentication required. Connect Phantom or sign in." },
      { status: 401 }
    );
  }

  // --- Determinar wallet de destino ---
  let destination = destinationWallet ?? publicKey;

  // Se usuário Supabase não enviou destinationWallet nem publicKey Phantom,
  // buscar/criar a wallet Solana do usuário automaticamente.
  if (!destination && isSupabaseAuth) {
    try {
      console.log(`[claim/POST] Supabase user without wallet — provisioning for user=${user!.id.slice(0, 8)}...`);
      const wallet = await getOrCreateWallet(user!.id);
      destination = wallet.publicKey;
      console.log(`[claim/POST] Wallet provisioned: ${destination.slice(0, 8)}...`);
    } catch (provErr: unknown) {
      const msg = provErr instanceof Error ? provErr.message : String(provErr);
      console.error("[claim/POST] Failed to provision wallet:", msg);
      return NextResponse.json(
        { error: "Failed to provision destination wallet. Please try again." },
        { status: 500 }
      );
    }
  }

  if (!destination) {
    return NextResponse.json(
      { error: "Destination wallet is required. Connect a Solana wallet." },
      { status: 400 }
    );
  }

  // Validar formato da public key Solana
  try {
    new PublicKey(destination);
  } catch {
    return NextResponse.json(
      { error: "Invalid Solana wallet address." },
      { status: 400 }
    );
  }

  // Validação Phantom: signer deve ser o mesmo destino declarado (anti-replay)
  if (isPhantomAuth && !isSupabaseAuth) {
    if (publicKey !== destination) {
      return NextResponse.json(
        { error: "Phantom public key must match destination wallet." },
        { status: 403 }
      );
    }
  }

  // --- Resolver claim ---
  try {
    console.log(`[claim/POST] Resolving claim id=${id} → destination=${destination.slice(0, 8)}... userId=${user?.id ?? "none"}`);
    const result = await resolveClaim(id, destination, user?.id ?? null);

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      claimed_by: result.claimed_by,
      explorerUrl: `https://explorer.solana.com/tx/${result.txHash}?cluster=devnet`,
    });
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : "Claim failed.";
    console.error(`[claim/POST] resolveClaim failed: ${errMessage}`);
    const status =
      errMessage.includes("already been redeemed") ? 409 :
      errMessage.includes("expired") ? 410 :
      errMessage.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: errMessage }, { status });
  }
}
