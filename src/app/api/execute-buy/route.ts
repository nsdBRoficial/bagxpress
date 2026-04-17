/**
 * POST /api/execute-buy — v2 REAL PRODUCT MODE
 *
 * Executa compra real após confirmação do Stripe.
 * Fluxo:
 * 1. Identifica usuário (auth ou anon)
 * 2. Busca/cria wallet real persistida (auth) ou ephemeral (anon)
 * 3. Executa swap via SwapProviderFactory (Bags → Jupiter → SolanaTransfer → Mock)
 * 4. Persiste resultado no banco (orders + transactions)
 * 5. Settlement: Transfere do Treasury para MOCK_CREATOR_WALLET o líquido
 * 6. Sweep: Aciona buyback e burn reais em BXP via Raydium/Jupiter
 */

import { NextResponse } from "next/server";
import { Keypair, Connection, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWallet, getDecryptedKeypair } from "@/services/wallet";
import { executeSwap } from "@/services/swap";
import { executeSweep, splitFee } from "@/services/tokenomics";
import bs58 from "bs58";

const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const NETWORK = process.env.SOLANA_NETWORK ?? "devnet";
const MOCK_CREATOR_WALLET = process.env.MOCK_CREATOR_WALLET ?? "";

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

    // -----------------------------------------------------------------
    // 5. Settlement (Creator Wallet) & Sweep (Tokenomics)
    // -----------------------------------------------------------------
    let sweepResult = null;
    let settlementTx = null;

    if (swapResult.success) {
      const feeInfo = splitFee(Number(amount));
      const netCreatorUsd = Number(amount) - feeInfo.totalFeeUsd;

      // Settlement
      try {
        if (MOCK_CREATOR_WALLET && process.env.FEE_PAYER_SECRET_KEY) {
          const secretKeyBase58 = process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, "");
          const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
          const connection = new Connection(SOLANA_RPC, "confirmed");

          // Simulando a conversão USD -> SOL (simplificado: $200 / SOL)
          const solAmount = netCreatorUsd / 200; 

          const tx = new Transaction().add(
             SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey: new Keypair().publicKey, // dummy para converter base58 logo abaixo
             }) // Apenas inicializando tx
          );

          // Subsituir dummy
          tx.instructions[0] = SystemProgram.transfer({
            fromPubkey: treasuryKeypair.publicKey,
            toPubkey: new (require('@solana/web3.js').PublicKey)(MOCK_CREATOR_WALLET),
            lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
          });

          settlementTx = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair], {
             commitment: "confirmed"
          });
          console.log(`[Settlement] Pagamento enviado ao criador: ${settlementTx}`);
        }
      } catch (e: unknown) {
        console.error("[Settlement] Falha ao enviar on-chain para Creator Wallet:", String(e));
      }

      // Sweep real
      sweepResult = await executeSweep(orderRow?.id ?? "unknown-order", Number(amount), NETWORK);
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
      sweep: sweepResult,
      settlementTx,
      tokenSymbol: tokenMint ? "Creator Token" : "BagxPress Pass"
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

