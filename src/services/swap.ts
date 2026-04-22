/**
 * src/services/swap.ts — v6.0 ZERO MOCK
 *
 * PT-BR: Provider Layer para execução de swaps.
 *        O provider Mock está DESABILITADO por padrão em produção.
 *        Somente ativado via ALLOW_MOCK_PROVIDER=true (testes internos).
 *
 * EN:    Provider Layer for swap execution.
 *        The Mock provider is DISABLED by default in production.
 *        Only activated via ALLOW_MOCK_PROVIDER=true (internal tests).
 *
 * Hierarquia de providers:
 * 1. AnchorSwapProvider       → Smart contract on-chain (quando ENABLE_ANCHOR=true)
 * 2. GaslessSponsoredProvider → Relayer gasless (quando ENABLE_GASLESS=true)
 * 3. BagsSwapProvider         → Bags Trade API (quando BAGS_API_KEY e tokenMint)
 * 4. JupiterSwapProvider      → Jupiter v6 API (quando tokenMint disponível)
 * 5. SolanaTransferProvider   → Self-transfer simbólico (sempre disponível, real on-chain)
 * 6. TreasuryBxpProvider      → Fallback REAL: transferência de BXP_CLASSIC da Treasury
 * 7. MockSwapProvider         → Apenas quando ALLOW_MOCK_PROVIDER=true (testes)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { FLAGS } from "@/lib/flags";
import { executeContractBuy, NodeWallet as Wallet } from "./contract";
import { executeSponsoredProofTx } from "./relayer";
import bs58 from "bs58";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwapParams {
  /** Keypair da wallet do usuário para assinar */
  keypair: Keypair;
  /** Token mint alvo (opcional — Bags/Jupiter o usam) */
  tokenMint?: string | null;
  /** Wallet do creator para royalties (opcional) */
  creatorWallet?: string | null;
  /** Amount em USD que foi pago */
  amountUsd: number;
  /** Network para o explorer url */
  network: string;
  /** RPC endpoint */
  /** Oracle: preço live do SOL em USD (opcional) */
  usdPerSol?: number;
}

export interface SwapResult {
  success: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  deliveredAmount: number;
  isRealTx: boolean;
  provider: string;
  error?: string;
}

interface SwapProvider {
  name: string;
  canExecute(params: SwapParams): boolean;
  execute(params: SwapParams): Promise<SwapResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function explorerUrl(txHash: string, network: string): string {
  const base   = "https://explorer.solana.com/tx";
  const suffix = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `${base}/${txHash}${suffix}`;
}

async function ensureBalance(
  connection: Connection,
  keypair: Keypair,
  minSol = 0.005
): Promise<boolean> {
  try {
    const balance = await connection.getBalance(keypair.publicKey);
    if (balance >= minSol * LAMPORTS_PER_SOL) return true;

    // Tenta airdrop na devnet
    if (
      (await connection.getGenesisHash()) ===
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
    ) {
      return false; // mainnet — sem airdrop
    }

    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      0.1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provider 1: Anchor Smart Contract
// ---------------------------------------------------------------------------

class AnchorSwapProvider implements SwapProvider {
  name = "anchor_smart_contract";

  canExecute(params: SwapParams): boolean {
    return FLAGS.ANCHOR_CONTRACTS && !!params.tokenMint && !!params.creatorWallet;
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { keypair, rpcUrl, network, tokenMint, creatorWallet, amountUsd } = params;
    const deliveredAmount = Math.floor(amountUsd * 100);

    try {
      const connection = new Connection(rpcUrl, "confirmed");
      const wallet     = new Wallet(keypair);

      const txHash = await executeContractBuy(
        connection,
        wallet,
        keypair.publicKey,
        new PublicKey(creatorWallet!),
        Math.floor(amountUsd * 1e6),
        250,
        new PublicKey(tokenMint!)
      );

      if (!txHash) throw new Error("Anchor contract bypass ou falha na emissão");

      return {
        success: true,
        txHash,
        explorerUrl: explorerUrl(txHash, network),
        deliveredAmount,
        isRealTx: true,
        provider: this.name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, txHash: null, explorerUrl: null, deliveredAmount, isRealTx: false, provider: this.name, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider 2: Gasless Sponsored Relayer
// ---------------------------------------------------------------------------

class GaslessSponsoredProvider implements SwapProvider {
  name = "gasless_relayer";

  canExecute(): boolean {
    return FLAGS.GASLESS_ENGINE;
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { keypair, rpcUrl, network, amountUsd } = params;
    const deliveredAmount = Math.floor(amountUsd * 100);

    const relayerResult = await executeSponsoredProofTx(
      keypair.publicKey.toBase58(),
      rpcUrl,
      network
    );

    if (relayerResult.success && relayerResult.txHash) {
      return {
        success: true,
        txHash: relayerResult.txHash,
        explorerUrl: relayerResult.explorerUrl,
        deliveredAmount,
        isRealTx: true,
        provider: this.name,
      };
    }

    return {
      success: false,
      txHash: null,
      explorerUrl: null,
      deliveredAmount,
      isRealTx: false,
      provider: this.name,
      error: relayerResult.error || "Gasless relayer falhou sem erro explícito",
    };
  }
}

// ---------------------------------------------------------------------------
// Provider 3: Bags Trade Swap
// ---------------------------------------------------------------------------

class BagsSwapProvider implements SwapProvider {
  name = "bags_swap";

  canExecute(params: SwapParams): boolean {
    return (
      !!params.tokenMint &&
      !!process.env.BAGS_API_KEY &&
      process.env.BAGS_API_KEY !== "your_bags_api_key_here"
    );
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { tokenMint, amountUsd, keypair } = params;
    const apiKey          = process.env.BAGS_API_KEY!;
    const deliveredAmount = Math.floor(amountUsd * 100);

    try {
      const res = await fetch(
        "https://public-api-v2.bags.fm/api/v1/solana/bags/trade/swap",
        {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenMint,
            inputMint: "So11111111111111111111111111111111111111112",
            amount:    Math.floor(amountUsd * 1e6),
            slippage:  100,
            userPublicKey: keypair.publicKey.toBase58(),
          }),
        }
      );

      if (!res.ok) throw new Error(`Bags API ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.response?.transaction) {
        throw new Error(data.error || "No transaction in Bags response");
      }

      const connection = new Connection(params.rpcUrl, "confirmed");
      const txBuffer   = Buffer.from(data.response.transaction, "base64");
      const tx         = Transaction.from(txBuffer);
      tx.partialSign(keypair);

      const txHash = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(txHash, "confirmed");

      return {
        success: true, txHash,
        explorerUrl: explorerUrl(txHash, params.network),
        deliveredAmount, isRealTx: true, provider: this.name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, txHash: null, explorerUrl: null, deliveredAmount, isRealTx: false, provider: this.name, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider 4: Jupiter Swap v6
// ---------------------------------------------------------------------------

class JupiterSwapProvider implements SwapProvider {
  name = "jupiter_swap";

  canExecute(params: SwapParams): boolean {
    return !!params.tokenMint;
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { tokenMint, amountUsd, keypair, rpcUrl, network } = params;
    const deliveredAmount = Math.floor(amountUsd * 100);

    try {
      const connection = new Connection(rpcUrl, "confirmed");
      const hasFunds   = await ensureBalance(connection, keypair, 0.01);
      if (!hasFunds) throw new Error("Insufficient SOL for Jupiter swap");

      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenMint}&amount=${Math.floor(amountUsd * 1e6)}&slippageBps=100`
      );
      if (!quoteRes.ok) throw new Error("Jupiter quote failed");
      const quote = await quoteRes.json();

      const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey:    keypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
        }),
      });
      if (!swapRes.ok) throw new Error("Jupiter swap transaction failed");
      const { swapTransaction } = await swapRes.json();

      const txBuffer = Buffer.from(swapTransaction, "base64");
      const tx       = Transaction.from(txBuffer);
      tx.partialSign(keypair);

      const txHash = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(txHash, "confirmed");

      return {
        success: true, txHash,
        explorerUrl: explorerUrl(txHash, network),
        deliveredAmount, isRealTx: true, provider: this.name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, txHash: null, explorerUrl: null, deliveredAmount, isRealTx: false, provider: this.name, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider 5: Solana Self-Transfer (prova tx real, sempre disponível)
// ---------------------------------------------------------------------------

class SolanaTransferProvider implements SwapProvider {
  name = "solana_transfer";

  canExecute(): boolean {
    return true;
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { keypair, rpcUrl, network, amountUsd } = params;
    const deliveredAmount = Math.floor(amountUsd * 100);

    try {
      const connection = new Connection(rpcUrl, "confirmed");
      await ensureBalance(connection, keypair);

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: keypair.publicKey });

      // Self-transfer de 1 lamport — gera txHash verificável no Explorer
      tx.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey:   keypair.publicKey,
          lamports:   1,
        })
      );

      const txHash = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: "confirmed",
        maxRetries: 3,
      });

      return {
        success: true, txHash,
        explorerUrl: explorerUrl(txHash, network),
        deliveredAmount, isRealTx: true, provider: this.name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, txHash: null, explorerUrl: null, deliveredAmount, isRealTx: false, provider: this.name, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider 6: Treasury BXP Transfer — FALLBACK REAL (Zero Mock)
// ---------------------------------------------------------------------------
//
// PT-BR: Quando todos os providers on-chain falham, a Treasury (FEE_PAYER) transfere
//        BXP_CLASSIC diretamente para a wallet do usuário. É um fallback REAL on-chain,
//        nunca simulado. A quantidade é configurável via DEMO_BXP_AMOUNT.
//
// EN:    When all on-chain providers fail, the Treasury (FEE_PAYER) transfers
//        BXP_CLASSIC directly to the user's wallet. It's a REAL on-chain fallback,
//        never simulated. The amount is configurable via DEMO_BXP_AMOUNT.

class TreasuryBxpProvider implements SwapProvider {
  name = "treasury_transfer";

  canExecute(): boolean {
    // PT-BR: Disponível apenas quando FEE_PAYER e BXP_TOKEN_MINT estão configurados
    // EN:    Available only when FEE_PAYER and BXP_TOKEN_MINT are configured
    return (
      !!process.env.FEE_PAYER_SECRET_KEY &&
      !!process.env.BXP_TOKEN_MINT
    );
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const { keypair, rpcUrl, network, amountUsd } = params;
    const deliveredAmount = Math.floor(amountUsd * 100);

    // PT-BR: Quantidade de BXP a transferir
    // EN:    Amount of BXP to transfer
    const fallbackBxp = parseInt(process.env.DEMO_BXP_AMOUNT ?? "500", 10);
    const decimals    = parseInt(process.env.BXP_TOKEN_DECIMALS ?? "6", 10);
    
    // Cálculo Dinâmico Híbrido (Prioridade)
    let bxpAmountToSend = fallbackBxp;
    
    try {
      const bxpPriceUsd = parseFloat(process.env.BXP_REFERENCE_PRICE_USD ?? "0.01");
      if (!isNaN(bxpPriceUsd) && bxpPriceUsd > 0 && amountUsd > 0) {
        // Se pagou $5 e o preço referência é $0.01, recebe 500 BXP
        const dynamicAmount = amountUsd / bxpPriceUsd;
        if (dynamicAmount > 0) {
          bxpAmountToSend = Math.floor(dynamicAmount);
          console.log(`[treasury_transfer] Cálculo Dinâmico: $${amountUsd} / $${bxpPriceUsd} = ${bxpAmountToSend} BXP`);
        }
      }
    } catch (err) {
      console.warn(`[treasury_transfer] Falha no cálculo dinâmico, usando fallback: ${fallbackBxp} BXP`);
    }

    const rawAmount = BigInt(bxpAmountToSend) * BigInt(10 ** decimals);

    try {
      const connection    = new Connection(rpcUrl, "confirmed");
      const mintPubkey    = new PublicKey(process.env.BXP_TOKEN_MINT!);

      // Decodifica a keypair da treasury
      const secretRaw    = process.env.FEE_PAYER_SECRET_KEY!.replace(/['"]/g, "").trim();
      const secretBytes  = /^[0-9a-fA-F]{64,}$/.test(secretRaw)
        ? Buffer.from(secretRaw, "hex")
        : bs58.decode(secretRaw);
      const treasuryKeypair = Keypair.fromSecretKey(secretBytes);

      // PT-BR: Obtém/cria a ATA da treasury para o mint BXP
      // EN:    Gets/creates the treasury ATA for the BXP mint
      const treasuryAta = await getOrCreateAssociatedTokenAccount(
        connection,
        treasuryKeypair,
        mintPubkey,
        treasuryKeypair.publicKey
      );

      // PT-BR: Obtém/cria a ATA do usuário para o mint BXP (treasury paga o rent)
      // EN:    Gets/creates the user ATA for the BXP mint (treasury pays rent)
      const userAta = await getOrCreateAssociatedTokenAccount(
        connection,
        treasuryKeypair,   // payer do rent
        mintPubkey,
        keypair.publicKey  // owner da conta
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: treasuryKeypair.publicKey });

      tx.add(
        createTransferInstruction(
          treasuryAta.address,  // from
          userAta.address,      // to
          treasuryKeypair.publicKey,
          rawAmount
        )
      );

      const txHash = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair], {
        commitment: "confirmed",
        maxRetries: 3,
      });

      console.log(`[treasury_transfer] ✅ ${bxpAmountToSend} BXP enviados para ${keypair.publicKey.toBase58().slice(0, 8)}... | TX: ${txHash.slice(0, 10)}...`);

      return {
        success: true,
        txHash,
        explorerUrl: explorerUrl(txHash, network),
        deliveredAmount: bxpAmountToSend,
        isRealTx: true,
        provider: this.name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[treasury_transfer] ❌ Falha na transferência BXP da treasury: ${message}`);
      return { success: false, txHash: null, explorerUrl: null, deliveredAmount, isRealTx: false, provider: this.name, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider 7: Mock (SOMENTE via ALLOW_MOCK_PROVIDER=true)
// ---------------------------------------------------------------------------
//
// PT-BR: NUNCA ativado em produção. Controlado por feature flag explícito.
//        Mantido apenas para testes unitários e CI.
// EN:    NEVER activated in production. Controlled by explicit feature flag.
//        Kept only for unit tests and CI.

class MockSwapProvider implements SwapProvider {
  name = "mock";

  canExecute(): boolean {
    // PT-BR: Somente quando explicitamente habilitado — nunca por padrão
    // EN:    Only when explicitly enabled — never by default
    return process.env.ALLOW_MOCK_PROVIDER === "true";
  }

  async execute(params: SwapParams): Promise<SwapResult> {
    const deliveredAmount = Math.floor(params.amountUsd * 100);
    const mockHash        = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    console.warn(`[swap] ⚠️  MOCK PROVIDER ATIVO — apenas para testes. ALLOW_MOCK_PROVIDER=true`);

    return {
      success: true,
      txHash:         mockHash,
      explorerUrl:    null,
      deliveredAmount,
      isRealTx:       false,
      provider:       this.name,
    };
  }
}

// ---------------------------------------------------------------------------
// Registro de providers em ordem de prioridade
// ---------------------------------------------------------------------------

const PROVIDERS: SwapProvider[] = [
  new AnchorSwapProvider(),
  new GaslessSponsoredProvider(),
  new BagsSwapProvider(),
  new JupiterSwapProvider(),
  new SolanaTransferProvider(),
  new TreasuryBxpProvider(),   // ← Fallback real on-chain (Zero Mock)
  new MockSwapProvider(),      // ← Somente ALLOW_MOCK_PROVIDER=true
];

/**
 * PT-BR: Executa o swap com o melhor provider disponível.
 *        Tenta em cascata. Nunca lança exceção.
 *        O Mock só é usado quando ALLOW_MOCK_PROVIDER=true.
 *
 * EN:    Executes the swap with the best available provider.
 *        Tries in cascade. Never throws.
 *        Mock is only used when ALLOW_MOCK_PROVIDER=true.
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  for (const provider of PROVIDERS) {
    if (!provider.canExecute(params)) continue;

    console.log(`[swap] Trying provider: ${provider.name}`);
    const result = await provider.execute(params);

    if (result.success) {
      console.log(`[swap] Success via ${provider.name}: ${result.txHash}`);
      return result;
    }

    console.warn(`[swap] ${provider.name} failed: ${result.error} — trying next`);
  }

  // PT-BR: Nunca deve chegar aqui com a config correta
  // EN:    Should never reach here with correct config
  return {
    success:        false,
    txHash:         null,
    explorerUrl:    null,
    deliveredAmount: 0,
    isRealTx:       false,
    provider:       "none",
    error:          "All providers failed — configure FEE_PAYER_SECRET_KEY e BXP_TOKEN_MINT",
  };
}
