/**
 * POST /api/execute-buy — v2 REAL PRODUCT MODE
 *
 * Executa compra real após confirmação do Stripe.
 * Fluxo:
 * 1. Identifica usuário (auth ou anon)
 * 2. Busca/cria wallet real persistida (auth) ou ephemeral (anon)
 * 3. Executa swap via SwapProviderFactory (Bags → Jupiter → SolanaTransfer → Mock)
 * 4. Persiste resultado no banco (orders + transactions)
 * 5. Retorna txHash + explorerUrl clicável
 */

import { NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWallet, getDecryptedKeypair } from "@/services/wallet";
import { executeSwap } from "@/services/swap";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const NETWORK = process.env.SOLANA_NETWORK ?? "devnet";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, amount, tokenMint, creatorWallet } = body;

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId e amount são obrigatórios" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------
    // 1. Identificar usuário
    // -----------------------------------------------------------------
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const admin = createSupabaseAdminClient();

    // Atualiza order → executing
    await admin
      .from("orders")
      .update({ status: "executing", updated_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", orderId);

    // -----------------------------------------------------------------
    // 2. Resolver wallet
    // -----------------------------------------------------------------
    let keypair: Keypair;
    let walletPublicKey: string;
    let isRealWallet = false;

    if (userId) {
      try {
        const walletInfo = await getOrCreateWallet(userId);
        const decrypted = await getDecryptedKeypair(userId);
        keypair = decrypted.keypair;
        walletPublicKey = walletInfo.publicKey;
        isRealWallet = true;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[execute-buy] Wallet fetch failed, ephemeral fallback:", message);
        keypair = Keypair.generate();
        walletPublicKey = keypair.publicKey.toBase58();
      }
    } else {
      keypair = Keypair.generate();
      walletPublicKey = keypair.publicKey.toBase58();
    }

    // -----------------------------------------------------------------
    // 3. Executar swap via provider factory
    // -----------------------------------------------------------------
    const swapResult = await executeSwap({
      keypair,
      tokenMint: tokenMint ?? null,
      creatorWallet: creatorWallet ?? null,
      amountUsd: Number(amount),
      network: NETWORK,
      rpcUrl: SOLANA_RPC,
    });

    // -----------------------------------------------------------------
    // 4. Persistir resultado no banco
    // -----------------------------------------------------------------
    const { data: orderRow } = await admin
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", orderId)
      .single();

    if (orderRow) {
      await admin.from("transactions").upsert(
        {
          order_id: orderRow.id,
          ...(userId ? { user_id: userId } : {}),
          tx_hash: swapResult.txHash,
          delivered_amount: swapResult.deliveredAmount,
          is_real_tx: swapResult.isRealTx,
          network: NETWORK,
          explorer_url: swapResult.explorerUrl,
          status: swapResult.isRealTx ? "confirmed" : "mock",
        },
        { onConflict: "order_id" }
      );

      await admin
        .from("orders")
        .update({
          status: swapResult.success ? "completed" : "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderRow.id);
    }

    const walletDisplay = `${walletPublicKey.slice(0, 4)}...${walletPublicKey.slice(-4)}`;

    return NextResponse.json({
      success: true,
      wallet: walletDisplay,
      walletFull: walletPublicKey,
      txHash: swapResult.txHash,
      deliveredAmount: swapResult.deliveredAmount,
      isRealTx: swapResult.isRealTx,
      isRealWallet,
      explorerUrl: swapResult.explorerUrl,
      provider: swapResult.provider,
      network: NETWORK,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[execute-buy] Fatal:", message);
    return NextResponse.json(
      { success: false, error: message || "Execution failed" },
      { status: 500 }
    );
  }
}
