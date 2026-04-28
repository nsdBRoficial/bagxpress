/**
 * POST /api/auth/provision-wallet
 *
 * Garante que o usuário autenticado possui uma wallet Solana.
 * Chamado automaticamente pelo AuthProvider no evento SIGNED_IN.
 *
 * - Idempotente: se a wallet já existe, retorna sem criar nova
 * - Usa getOrCreateWallet() que persiste a key criptografada no Supabase
 * - Retorna apenas a public key (a private key NUNCA é exposta)
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateWallet } from "@/services/wallet";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const wallet = await getOrCreateWallet(user.id);

    console.log(
      `[provision-wallet] user=${user.id.slice(0, 8)}... wallet=${wallet.publicKey.slice(0, 8)}... network=${wallet.network}`
    );

    return NextResponse.json({
      success: true,
      publicKey: wallet.publicKey,
      network: wallet.network,
      createdAt: wallet.createdAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to provision wallet";
    console.error("[provision-wallet] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
