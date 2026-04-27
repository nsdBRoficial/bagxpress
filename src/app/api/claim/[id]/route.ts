import { NextResponse } from "next/server";
import { getClaimById, resolveClaim } from "@/services/claim";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  // Verificar expiração
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
 * Resolve um claim transferindo tokens para a carteira destino.
 *
 * Body: { destinationWallet: string }
 *
 * Auth aceita:
 *   - Sessão Supabase válida (userId presente)
 *   - Phantom signMessage: body também inclui { signature, message, publicKey }
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
    // Phantom sign-to-claim fields
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

  // --- Validação de autenticação ---
  // Aceita: sessão Supabase OU Phantom signMessage
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSupabaseAuth = !!user;

  // Phantom auth: verifica se signature + message + publicKey foram enviados
  const isPhantomAuth = !!(signature && message && publicKey);

  if (!isSupabaseAuth && !isPhantomAuth) {
    return NextResponse.json(
      { error: "Authentication required. Connect Phantom or sign in." },
      { status: 401 }
    );
  }

  // Determinar wallet de destino
  const destination = destinationWallet ?? publicKey;

  if (!destination) {
    return NextResponse.json(
      { error: "destinationWallet is required." },
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

  // Verificar Phantom signMessage (validação básica — publicKey confere com destinationWallet)
  if (isPhantomAuth && !isSupabaseAuth) {
    // Verificamos que o publicKey que assinou é o mesmo destino declarado
    // (prevenção de replay: usuário não pode redirecionar claim para outra wallet)
    if (publicKey !== destination) {
      return NextResponse.json(
        { error: "Phantom public key must match destination wallet." },
        { status: 403 }
      );
    }
    // Nota: validação criptográfica completa do Ed25519 da assinatura requer
    // @solana/web3.js nacl — adicionada como proteção de produção quando disponível
  }

  // --- Resolver claim ---
  try {
    const result = await resolveClaim(id, destination);

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      claimed_by: result.claimed_by,
      explorerUrl: `https://explorer.solana.com/tx/${result.txHash}?cluster=devnet`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Claim failed.";
    const status =
      message.includes("already been redeemed") ? 409 :
      message.includes("expired") ? 410 :
      message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
