/**
 * POST /api/execute-buy — v4.0 ORACLE + FULL TRANSPARENCY
 *
 * PT-BR: Executa a compra real após confirmação do pagamento via Stripe.
 * EN:    Executes the real purchase after Stripe payment confirmation.
 *
 * Fluxo / Flow:
 *   1. Identifica o usuário (autenticado ou anônimo)
 *   2. Busca o preço live do SOL via Oracle (Jupiter → Pyth → fallback)
 *   3. Resolve/cria a wallet real persistida (autenticado) ou efêmera (anônimo)
 *   4. Executa swap via SwapProviderFactory (Bags → Jupiter → SolanaTransfer → Mock)
 *   5. Persiste o resultado no banco (tabelas `orders` + `transactions`)
 *   6. Settlement: Envia o valor líquido em SOL para a MOCK_CREATOR_WALLET
 *   7. Sweep: Aciona o buyback e burn reais de BXP via Raydium CPMM / Jupiter
 *   8. Retorna `executionSteps` detalhados para Full Transparency UX
 *
 * v4.0:
 *   - Oracle Integration: preço SOL/USD live via Jupiter + Pyth (sem hardcoded)
 *   - Full Transparency: resposta inclui `executionSteps` com logs estruturados
 *   - Settlement usa preço Oracle para cálculo preciso dos lamports
 */

import { NextResponse } from "next/server";
import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWallet, getDecryptedKeypair } from "@/services/wallet";
import { executeSwap } from "@/services/swap";
import { executeSweep, splitFee } from "@/services/tokenomics";
import { getSolPrice } from "@/services/oracle";
import { generateAuditProof, formatAuditHash } from "@/services/audit";
import bs58 from "bs58";

// ---------------------------------------------------------------------------
// PT-BR: Constantes de ambiente
// EN:    Environment constants
// ---------------------------------------------------------------------------
const SOLANA_RPC    = process.env.SOLANA_RPC_URL    ?? "https://api.devnet.solana.com";
const NETWORK       = process.env.SOLANA_NETWORK    ?? "devnet";
const MOCK_CREATOR_WALLET = process.env.MOCK_CREATOR_WALLET ?? "";

// ---------------------------------------------------------------------------
// PT-BR: Tipo de step para Full Transparency UX
// EN:    Step type for Full Transparency UX
// ---------------------------------------------------------------------------

type StepStatus = "info" | "success" | "warning" | "error";

interface ExecutionStep {
  /** PT-BR: Ícone emoji do step / EN: Step emoji icon */
  icon:    string;
  /** PT-BR: Categoria do step / EN: Step category */
  label:   string;
  /** PT-BR: Mensagem principal / EN: Main message */
  message: string;
  /** PT-BR: Detalhe secundário (valores, hashes, etc.) / EN: Secondary detail (values, hashes, etc.) */
  detail?: string;
  /** PT-BR: URL do explorador para link clicável / EN: Explorer URL for clickable link */
  link?:   string;
  /** PT-BR: Status visual / EN: Visual status */
  status:  StepStatus;
}

export async function POST(req: Request) {
  /** PT-BR: Array de steps que será retornado na resposta para Full Transparency UX */
  /** EN:    Steps array returned in response for Full Transparency UX */
  const steps: ExecutionStep[] = [];

  /**
   * PT-BR: Utilitário para adicionar um step e logar no terminal ao mesmo tempo.
   * EN:    Utility to add a step and log to the terminal simultaneously.
   */
  const step = (
    icon:    string,
    label:   string,
    message: string,
    status:  StepStatus = "info",
    detail?: string,
    link?:   string
  ): void => {
    steps.push({ icon, label, message, detail, link, status });
    const prefix = `[execute-buy][${label}]`;
    if (status === "error")   console.error(`${prefix} ${message}${detail ? ` | ${detail}` : ""}`);
    else if (status === "warning") console.warn(`${prefix} ${message}${detail ? ` | ${detail}` : ""}`);
    else                        console.log(`${prefix} ${message}${detail ? ` | ${detail}` : ""}`);
  };

  try {
    const body = await req.json();
    const { orderId, amount, tokenMint, creatorWallet } = body;

    // PT-BR: Validação básica dos campos obrigatórios
    // EN:    Basic validation of required fields
    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId e amount são obrigatórios" },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: `amount inválido: "${amount}"` },
        { status: 400 }
      );
    }

    step("🚀", "Protocolo", "BagxPress Zero-UX Protocol iniciado", "info");

    // -----------------------------------------------------------------------
    // ORACLE: Busca preço live do SOL / Fetch live SOL price
    // -----------------------------------------------------------------------

    step("🔮", "Oracle", "Buscando cotação live do SOL...", "info");
    const oracle = await getSolPrice();

    const oracleSourceLabel =
      oracle.source === "jupiter" ? "Jupiter Price API V6" :
      oracle.source === "pyth"    ? "Pyth Network Hermes" :
                                    "Fallback hardcoded (APIs offline)";

    step(
      "💱",
      "Oracle",
      `Conversão Oracle: 1 SOL = $${oracle.usdPerSol.toFixed(2)} USD`,
      oracle.source === "fallback" ? "warning" : "success",
      `Fonte: ${oracleSourceLabel}${oracle.cached ? " (cache)" : " (live)"}`,
    );

    const usdPerSol = oracle.usdPerSol;

    // -----------------------------------------------------------------------
    // FEES: Cálculo de valores com Oracle / Fee calculation with Oracle
    // -----------------------------------------------------------------------

    const feeInfo       = splitFee(amountNum);
    const netCreatorUsd = amountNum - feeInfo.totalFeeUsd;
    const netSolAmount  = netCreatorUsd / usdPerSol;
    const netLamports   = Math.floor(netSolAmount * LAMPORTS_PER_SOL);

    step(
      "💰",
      "Fees",
      `Valor bruto: $${amountNum.toFixed(2)} | Taxa: $${feeInfo.totalFeeUsd.toFixed(2)} | Líquido: $${netCreatorUsd.toFixed(2)}`,
      "info",
      `Treasury: $${feeInfo.treasuryFeeUsd.toFixed(2)} | Buyback: $${feeInfo.buybackFeeUsd.toFixed(2)}`
    );

    // -----------------------------------------------------------------------
    // 1. Identificar usuário / Identify user
    // -----------------------------------------------------------------------
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const admin  = createSupabaseAdminClient();

    await admin
      .from("orders")
      .update({ status: "executing", updated_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", orderId);

    // -----------------------------------------------------------------------
    // 2. Resolver wallet / Resolve wallet
    // -----------------------------------------------------------------------
    let keypair: Keypair;
    let walletPublicKey: string;
    let isRealWallet = false;

    if (userId) {
      try {
        const walletInfo = await getOrCreateWallet(userId);
        const decrypted  = await getDecryptedKeypair(userId);
        keypair          = decrypted.keypair;
        walletPublicKey  = walletInfo.publicKey;
        isRealWallet     = true;
        step("🔐", "Wallet", `Wallet persistida resolvida`, "success", `${walletPublicKey.slice(0, 8)}...${walletPublicKey.slice(-4)}`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[execute-buy] Falha ao resolver wallet real, usando efêmera:", message);
        keypair         = Keypair.generate();
        walletPublicKey = keypair.publicKey.toBase58();
        step("🔑", "Wallet", "Wallet efêmera gerada (fallback)", "warning", walletPublicKey.slice(0, 8) + "...");
      }
    } else {
      keypair         = Keypair.generate();
      walletPublicKey = keypair.publicKey.toBase58();
      step("🔑", "Wallet", "Wallet efêmera gerada para sessão anônima", "info", walletPublicKey.slice(0, 8) + "...");
    }

    // -----------------------------------------------------------------------
    // 3. Executar swap / Execute swap
    // -----------------------------------------------------------------------
    step("⚡", "Swap", `Roteando swap para user wallet via ${NETWORK}...`, "info");

    const swapResult = await executeSwap({
      keypair,
      tokenMint:     tokenMint ?? null,
      creatorWallet: creatorWallet ?? null,
      amountUsd:     amountNum,
      network:       NETWORK,
      rpcUrl:        SOLANA_RPC,
    });

    if (swapResult.success && swapResult.txHash) {
      const explorerUrl = `https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet`;
      step(
        "✅",
        "Swap",
        `Swap confirmado on-chain via ${swapResult.provider}`,
        "success",
        `${swapResult.deliveredAmount} tokens entregues`,
        explorerUrl
      );
    } else {
      step("✅", "Swap", `Swap simulado via ${swapResult.provider}`, "info", `${swapResult.deliveredAmount} tokens`);
    }

    // -----------------------------------------------------------------------
    // 4. Persistir resultado / Persist result
    // -----------------------------------------------------------------------
    const { data: orderRow } = await admin
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", orderId)
      .single();

    if (orderRow) {
      await admin.from("transactions").upsert(
        {
          order_id:         orderRow.id,
          ...(userId ? { user_id: userId } : {}),
          tx_hash:          swapResult.txHash,
          delivered_amount: swapResult.deliveredAmount,
          is_real_tx:       swapResult.isRealTx,
          network:          NETWORK,
          explorer_url:     swapResult.explorerUrl,
          status:           swapResult.isRealTx ? "confirmed" : "mock",
        },
        { onConflict: "order_id" }
      );

      await admin
        .from("orders")
        .update({
          status:     swapResult.success ? "completed" : "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderRow.id);
    }

    // -----------------------------------------------------------------------
    // 5. Settlement + 6. Sweep (somente se swap foi bem-sucedido)
    // -----------------------------------------------------------------------
    let sweepResult = null;
    let settlementTx: string | null = null;

    if (swapResult.success) {
      // ── 5. Settlement ─────────────────────────────────────────────────────
      step(
        "💸",
        "Settlement",
        `Repassando $${netCreatorUsd.toFixed(2)} (~${netSolAmount.toFixed(5)} SOL) ao criador...`,
        "info",
        `${netLamports} lamports @ 1 SOL = $${usdPerSol.toFixed(2)}`
      );

      try {
        const hasSettlementConfig =
          MOCK_CREATOR_WALLET.length > 10 &&
          !!process.env.FEE_PAYER_SECRET_KEY;

        if (!hasSettlementConfig) {
          step(
            "⚠️", "Settlement",
            "Skipped: MOCK_CREATOR_WALLET ou FEE_PAYER_SECRET_KEY ausente",
            "warning"
          );
        } else {
          if (!Number.isFinite(netLamports) || netLamports <= 0) {
            throw new Error(
              `netLamports inválido: ${netLamports} (netCreatorUsd=${netCreatorUsd})`
            );
          }

          const secretKeyBase58  = process.env.FEE_PAYER_SECRET_KEY!.replace(/["']/g, "");
          const treasuryKeypair  = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
          const connection       = new Connection(SOLANA_RPC, "confirmed");
          const creatorPubkey    = new PublicKey(MOCK_CREATOR_WALLET);

          const settleTx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey:   creatorPubkey,
              lamports:   netLamports,
            })
          );

          settlementTx = await sendAndConfirmTransaction(
            connection,
            settleTx,
            [treasuryKeypair],
            { commitment: "confirmed" }
          );

          const settleExplorerUrl = `https://explorer.solana.com/tx/${settlementTx}?cluster=devnet`;
          step(
            "✅",
            "Settlement",
            `Repasse ao criador confirmado on-chain`,
            "success",
            `${settlementTx.slice(0, 10)}...${settlementTx.slice(-6)} | $${netCreatorUsd.toFixed(2)} USD`,
            settleExplorerUrl
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        step("❌", "Settlement", `Falha no repasse ao criador: ${msg}`, "error");
      }

      // ── 6. Sweep: Buyback + Burn ───────────────────────────────────────
      step("🔄", "Sweep", "Iniciando Buyback + Burn via protocolo tokenomics...", "info");

      sweepResult = await executeSweep(
        orderRow?.id ?? "unknown-order",
        amountNum,
        NETWORK,
        usdPerSol  // PT-BR: preço Oracle propagado / EN: Oracle price propagated
      );

      if (sweepResult.buybackTx) {
        const buybackUrl = `https://explorer.solana.com/tx/${sweepResult.buybackTx}?cluster=devnet`;
        step(
          "🔄",
          "Buyback",
          `Buyback executado na Raydium CPMM Pool`,
          "success",
          `${sweepResult.buybackTx.slice(0, 10)}... | Provider: ${sweepResult.provider}`,
          buybackUrl
        );
      } else {
        step("⚠️", "Buyback", `Buyback simulado via ${sweepResult.provider ?? "mock"}`, "warning");
      }

      const bxpHuman = (sweepResult.bxpBurned / 1e6).toFixed(4);

      if (sweepResult.burnTx) {
        const burnUrl = `https://explorer.solana.com/tx/${sweepResult.burnTx}?cluster=devnet`;
        step(
          "🔥",
          "Burn",
          `Queimados ${bxpHuman} $BXP on-chain`,
          "success",
          `${sweepResult.burnTx.slice(0, 10)}...${sweepResult.burnTx.slice(-6)}`,
          burnUrl
        );
      } else {
        step("🔥", "Burn", `${bxpHuman} $BXP marcados para queima (simulado)`, "info");
      }
    }

    // -----------------------------------------------------------------------
    // 7. Audit Proof SHA-256
    // -----------------------------------------------------------------------
    const now = new Date().toISOString();
    const auditProofResult = generateAuditProof({
      orderId:      orderId,
      amountUsd:    amountNum,
      settlementTx: settlementTx,
      buybackTx:    sweepResult?.buybackTx ?? null,
      burnTx:       sweepResult?.burnTx    ?? null,
      usdPerSol:    usdPerSol,
      burnedAmount: sweepResult?.bxpBurned ?? 0,
      timestamp:    now,
    });

    step(
      "📋",
      "Audit",
      `Audit Hash: ${formatAuditHash(auditProofResult.hash)}`,
      "success",
      `SHA-256 · ${auditProofResult.version} · Verificável publicamente`
    );

    // -----------------------------------------------------------------------
    // 8. Resposta de sucesso / Success response
    // -----------------------------------------------------------------------
    const walletDisplay = `${walletPublicKey.slice(0, 4)}...${walletPublicKey.slice(-4)}`;

    step(
      "🎉",
      "Protocolo",
      "Fluxo BagxPress completo com sucesso!",
      "success",
      `Oracle: $${usdPerSol.toFixed(2)}/SOL | Provider: ${swapResult.provider}`
    );

    return NextResponse.json({
      success:         true,
      wallet:          walletDisplay,
      walletFull:      walletPublicKey,
      txHash:          swapResult.txHash,
      deliveredAmount: swapResult.deliveredAmount,
      isRealTx:        swapResult.isRealTx,
      isRealWallet,
      explorerUrl:     swapResult.explorerUrl,
      provider:        swapResult.provider,
      network:         NETWORK,
      sweep:           sweepResult,
      settlementTx,
      tokenSymbol:     tokenMint ? "Creator Token" : "BagxPress Pass",
      // PT-BR: Payload de Full Transparency — array ordenado de steps de execução
      // EN:    Full Transparency payload — ordered array of execution steps
      executionSteps:  steps,
      oracle: {
        usdPerSol: oracle.usdPerSol,
        source:    oracle.source,
        cached:    oracle.cached,
        fetchedAt: oracle.fetchedAt,
      },
      // PT-BR: Audit Proof SHA-256 para verificação criptográfica independente
      // EN:    SHA-256 Audit Proof for independent cryptographic verification
      auditProof:      auditProofResult.hash,
      auditVersion:    auditProofResult.version,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[execute-buy] ❌ Fatal:", message);

    steps.push({
      icon:    "❌",
      label:   "Fatal",
      message: message || "Execution failed",
      status:  "error",
    });

    return NextResponse.json(
      { success: false, error: message || "Execution failed", executionSteps: steps },
      { status: 500 }
    );
  }
}
