/**
 * src/services/tokenomics.ts
 *
 * PT-BR: Engine de Split de Liquidez, Recompra (Buyback) e Queima (Burn) do $BXP.
 * EN:    BXP Liquidity Split Engine, Buyback, and On-Chain Burn service.
 *
 * Fluxo / Flow:
 *   1. splitFee()        → Divide a taxa da plataforma em Treasury (50%) + Buyback (50%)
 *   2. executeBuyback()  → Usa Raydium CPMM para comprar BXP com SOL (fallback: Jupiter)
 *   3. executeBurn()     → Queima os BXP comprados diretamente on-chain
 *   4. executeSweep()    → Orquestra os passos acima para cada ordem de compra
 *
 * v4.0 — Oracle Integration: preço SOL/USD live via Jupiter + Pyth (sem hardcoded)
 * v3.1 — Migrado para BXP_CLASSIC (SPL Token padrão) + Raydium CPMM Devnet
 * CORRIGIDO: desestruturação rpcData, tipagem CpmmComputeData, cálculo de lamports
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import BN from "bn.js";

// ---------------------------------------------------------------------------
// PT-BR: Constantes de ambiente — limpas de aspas/comentários inline
// EN:    Environment constants — stripped of quotes and inline comments
// ---------------------------------------------------------------------------
const SOLANA_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const BXP_MINT_RAW = process.env.BXP_TOKEN_MINT ?? "";
const BXP_MINT = BXP_MINT_RAW.trim().replace(/['\"#\s].*$/g, "").trim();
const TARGET_POOL_ID_RAW = process.env.RAYDIUM_POOL_ID ?? null;
const TARGET_POOL_ID = TARGET_POOL_ID_RAW?.trim().replace(/['\"#\s].*$/g, "").trim() ?? null;

/**
 * PT-BR: Endereço nativo do WSOL na Solana (Wrapped SOL).
 * EN:    Native WSOL mint address on Solana (Wrapped SOL).
 */
const NATIVE_MINT = "So11111111111111111111111111111111111111112";

// ---------------------------------------------------------------------------
// PT-BR: Tipos exportados
// EN:    Exported types
// ---------------------------------------------------------------------------

export interface FeeSplitResult {
  totalFeeUsd: number;
  treasuryFeeUsd: number;
  buybackFeeUsd: number;
}

// ---------------------------------------------------------------------------
// PT-BR: Funções de cálculo de taxa — puras e determinísticas
// EN:    Fee calculation functions — pure and deterministic
// ---------------------------------------------------------------------------

/**
 * PT-BR: Calcula a taxa total da plataforma BagxPress (1.99% fixo).
 * EN:    Calculates the BagxPress platform fee (fixed 1.99%).
 *
 * @param usdAmount - Valor da compra em USD / Purchase amount in USD
 * @returns Taxa total em USD / Total fee in USD
 */
export function calculateProtocolFee(usdAmount: number): number {
  return usdAmount * 0.0199;
}

/**
 * PT-BR: Divide a taxa da plataforma em dois componentes: Treasury e Buyback.
 * EN:    Splits the platform fee into two components: Treasury and Buyback.
 *
 * Divisão / Split:
 *   - Treasury (50%): Mantido no cofre da plataforma / Retained in platform vault
 *   - Buyback  (50%): Usado para recomprar e queimar BXP / Used to buy and burn BXP
 *
 * @param usdAmount - Valor total da transação em USD / Total transaction value in USD
 * @returns Objeto com os valores de cada componente / Object with each component's value
 */
export function splitFee(usdAmount: number): FeeSplitResult {
  const totalFeeUsd = calculateProtocolFee(usdAmount);
  return {
    totalFeeUsd,
    treasuryFeeUsd: totalFeeUsd * 0.5,
    buybackFeeUsd: totalFeeUsd * 0.5,
  };
}

/**
 * PT-BR: Converte um valor em USD para lamports usando o preço Oracle.
 * EN:    Converts a USD amount to lamports using the Oracle price.
 *
 * IMPORTANTE: Usa Math.floor para garantir inteiro — necessário para BigInt do burn.
 * IMPORTANT:  Uses Math.floor to ensure integer — required for burn's BigInt.
 *
 * @param usdAmount  - Valor em USD / Value in USD
 * @param usdPerSol  - Preço Oracle do SOL em USD / Oracle SOL price in USD
 * @returns Lamports como número inteiro seguro / Lamports as a safe integer
 */
function usdToLamports(usdAmount: number, usdPerSol: number): number {
  const solAmount = usdAmount / usdPerSol;
  return Math.floor(solAmount * 1_000_000_000); // 1 SOL = 1e9 lamports
}

// ---------------------------------------------------------------------------
// PT-BR: Depositar na Treasury — stub no-op para hackathon
// EN:    Treasury deposit — no-op stub for hackathon
// ---------------------------------------------------------------------------

/**
 * PT-BR: Registra o depósito simulado na Treasury (stub para hackathon).
 * EN:    Logs the simulated Treasury deposit (stub for hackathon).
 */
export async function treasuryDeposit(usdAmount: number, network: string): Promise<boolean> {
  console.log(
    `[Tokenomics] 🏦 Treasury: mantendo $${usdAmount.toFixed(4)} na plataforma. Rede: ${network}`
  );
  return true;
}

// ---------------------------------------------------------------------------
// PT-BR: Motor de Buyback — Raydium CPMM → Jupiter (fallback)
// EN:    Buyback engine — Raydium CPMM → Jupiter (fallback)
// ---------------------------------------------------------------------------

/**
 * PT-BR: Executa a recompra de BXP usando os fees de protocolo.
 * EN:    Executes BXP buyback using protocol fees.
 *
 * v4.0: Recebe `usdPerSol` do Oracle para conversão dinâmica (não hardcoded).
 *
 * Estratégia em cascata / Cascade strategy:
 *   1. Raydium CPMM (se TARGET_POOL_ID configurado)
 *   2. Jupiter V6 API (fallback)
 *   3. Retorna falha se ambos falharem
 *
 * @param usdAmount  - Valor em USD destinado ao buyback / USD value allocated to buyback
 * @param network    - Rede Solana (`devnet` ou `mainnet-beta`) / Solana network
 * @param usdPerSol  - Preço vivo do SOL em USD (do Oracle) / Live SOL price in USD (from Oracle)
 */
export async function executeBuyback(
  usdAmount: number,
  network: string,
  usdPerSol: number
): Promise<{ success: boolean; bxpAmount: number; txHash: string | null; provider: string }> {
  console.log(`[Tokenomics] 💸 Iniciando Buyback de $${usdAmount.toFixed(4)} USD...`);
  console.log(`[Tokenomics]    → Preço Oracle: 1 SOL = $${usdPerSol.toFixed(2)} | Equivalente: ~${(usdAmount / usdPerSol).toFixed(6)} SOL`);

  // PT-BR: Validação antecipada: FEE_PAYER_SECRET_KEY é obrigatório para qualquer buyback real
  // EN:    Early validation: FEE_PAYER_SECRET_KEY is required for any real buyback
  if (!process.env.FEE_PAYER_SECRET_KEY) {
    console.error("[Tokenomics] ❌ FEE_PAYER_SECRET_KEY ausente no ambiente!");
    throw new Error("FEE_PAYER_SECRET_KEY ausente");
  }

  const owner = Keypair.fromSecretKey(
    bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, ""))
  );
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // PT-BR: Converte USD → Lamports usando preço Oracle (inteiro, nunca undefined/NaN)
  // EN:    Converts USD → Lamports using Oracle price (integer, never undefined/NaN)
  const amountInLamports = usdToLamports(usdAmount, usdPerSol);
  console.log(`[Tokenomics]    → amountInLamports: ${amountInLamports}`);

  // ── Tentativa 1: RAYDIUM CPMM SDK ────────────────────────────────────────
  if (TARGET_POOL_ID && TARGET_POOL_ID.length > 30) {
    try {
      console.log(`[Tokenomics] 🟢 Tentando Raydium CPMM (Pool: ${TARGET_POOL_ID})...`);

      // PT-BR: Carrega o SDK Raydium com a wallet do treasury (fee payer)
      // EN:    Load Raydium SDK with the treasury wallet (fee payer)
      const raydium = await Raydium.load({
        owner,
        connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        blockhashCommitment: "confirmed",
      });

      // PT-BR: Busca dados da pool on-chain. O SDK retorna `rpcData` (não `poolRpcData`).
      // EN:    Fetches pool data on-chain. SDK returns `rpcData` (not `poolRpcData`).
      // CORREÇÃO CRÍTICA: desestruturação com o nome correto `rpcData`
      const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(TARGET_POOL_ID);

      // PT-BR: Valida que os dados críticos da pool foram carregados corretamente
      // EN:    Validates that critical pool data was loaded correctly
      if (!rpcData) {
        throw new Error("rpcData é undefined — pool ID pode estar incorreto ou a pool não existe na devnet");
      }
      if (!rpcData.configInfo) {
        throw new Error("rpcData.configInfo é undefined — pool pode estar incompleta ou incompatível com CPMM v7");
      }

      console.log(`[Tokenomics]    MintA: ${poolInfo.mintA.address}`);
      console.log(`[Tokenomics]    MintB: ${poolInfo.mintB.address}`);
      console.log(`[Tokenomics]    vaultA: ${rpcData.vaultAAmount?.toString() ?? "N/A"}`);
      console.log(`[Tokenomics]    vaultB: ${rpcData.vaultBAmount?.toString() ?? "N/A"}`);

      // PT-BR: Determina direção do swap: estamos pagando com WSOL (SOL nativo)
      // EN:    Determines swap direction: we are paying with WSOL (native SOL)
      const wsolIsMintA = poolInfo.mintA.address === NATIVE_MINT;
      const baseIn = wsolIsMintA;   // Se WSOL é mintA, estamos na direção A→B
      const outputMint = wsolIsMintA ? poolInfo.mintB.address : poolInfo.mintA.address;

      console.log(
        `[Tokenomics]    WSOL é mintA: ${wsolIsMintA} | baseIn: ${baseIn} | outputMint: ${outputMint}`
      );

      // PT-BR: Monta o objeto CpmmComputeData conforme tipagem exigida pelo Raydium SDK v2.
      // EN:    Builds the CpmmComputeData object as required by Raydium SDK v2 typing.
      //
      // CORREÇÃO CRÍTICA: O SDK exige os campos:
      //   - id, version, configInfo, mintA, mintB (do poolInfo — tipo ApiV3Token)
      //   - reservas e vaults do rpcData (via spread)
      // ATENÇÃO: mintA/mintB devem ser declarados APÓS o spread do rpcData para
      // não serem sobrescritos pelo campo de mesmo nome no rpcData (que é PublicKey,
      // não ApiV3Token). O cast para `any` é necessário para compatibilidade do SDK.
      const poolPublicKey = new PublicKey(TARGET_POOL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolCompute = {
        ...rpcData,                      // PT-BR: spread primeiro: baseReserve, quoteReserve, vaults, etc.
        id:         poolPublicKey,       // EN:    spread first: baseReserve, quoteReserve, vaults, etc.
        version:    7 as const,
        configInfo: rpcData.configInfo!,
        mintA:      poolInfo.mintA,      // PT-BR: sobrescreve com ApiV3Token correto / EN: override with correct ApiV3Token
        mintB:      poolInfo.mintB,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const inputAmount = new BN(amountInLamports);

      // PT-BR: Calcula a saída esperada com base nas reservas atuais da pool
      // EN:    Calculates expected output based on current pool reserves
      const { amountOut, minAmountOut, fee } = raydium.cpmm.computeSwapAmount({
        pool:       poolCompute,
        amountIn:   inputAmount,
        outputMint,
        slippage:   0.25, // 25% de slippage tolerado na devnet / 25% slippage tolerance on devnet
        swapBaseIn: true,
      });

      console.log(`[Tokenomics]    amountOut   : ${amountOut.toString()} unidades brutas de BXP`);
      console.log(`[Tokenomics]    minAmountOut: ${minAmountOut.toString()} unidades brutas de BXP`);
      console.log(`[Tokenomics]    fee         : ${fee?.toString() ?? "N/A"} lamports`);

      // PT-BR: Executa o swap on-chain, usando minAmountOut como saída garantida
      // EN:    Executes the swap on-chain, using minAmountOut as guaranteed output
      const { execute } = await raydium.cpmm.swap({
        poolInfo,
        baseIn,
        inputAmount,
        swapResult:          { inputAmount, outputAmount: minAmountOut },
        slippage:            0.25,
        computeBudgetConfig: { units: 600_000, microLamports: 200_000 },
        txVersion:           TxVersion.LEGACY,
      });

      // PT-BR: Executa sem parâmetros (ExecuteParams não suporta { sequential })
      // EN:    Execute without params (ExecuteParams does not support { sequential })
      const { txId } = await execute();
      const bxpAmount = Number(amountOut);

      console.log(`[Tokenomics] ✅ Buyback via Raydium CPMM OK! Tx: ${txId}`);
      console.log(`[Tokenomics]    BXP comprado: ${bxpAmount} unidades brutas`);

      return { success: true, bxpAmount, txHash: txId, provider: "Raydium CPMM" };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Tokenomics] ⚠️  Raydium CPMM falhou: ${msg}`);
      console.warn(`[Tokenomics]    → Tentando fallback Jupiter V6...`);
    }
  } else {
    console.log(
      `[Tokenomics] ⏭️  RAYDIUM_POOL_ID não configurado ou inválido — pulando para Jupiter.`
    );
  }

  // ── Tentativa 2: JUPITER API FALLBACK ────────────────────────────────────

  // PT-BR: Valida que BXP_MINT está configurado antes de tentar Jupiter
  // EN:    Validates BXP_MINT is configured before attempting Jupiter
  if (!BXP_MINT || BXP_MINT.length < 30) {
    console.error("[Tokenomics] ❌ BXP_TOKEN_MINT inválido — não é possível acionar Jupiter.");
    return { success: false, bxpAmount: 0, txHash: null, provider: "Failed (no mint)" };
  }

  try {
    console.log(`[Tokenomics] 🟡 Tentando Jupiter V6 Fallback API...`);
    console.log(`[Tokenomics]    inputMint: WSOL | outputMint: ${BXP_MINT} | amount: ${amountInLamports}`);

    const quoteRes = await fetch(
      `https://quote-api.jup.ag/v6/quote` +
        `?inputMint=${NATIVE_MINT}` +
        `&outputMint=${BXP_MINT}` +
        `&amount=${amountInLamports}` +
        `&slippageBps=2500` // 25% slippage para devnet
    );
    if (!quoteRes.ok) throw new Error(`Jupiter quote falhou com status ${quoteRes.status}`);
    const quote = await quoteRes.json();

    if (!quote.outAmount) throw new Error("Jupiter quote não retornou outAmount");
    console.log(`[Tokenomics]    Jupiter quote: ${quote.outAmount} BXP bruto esperado`);

    const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse:     quote,
        userPublicKey:     owner.publicKey.toBase58(),
        wrapAndUnwrapSol:  true,
      }),
    });
    if (!swapRes.ok) throw new Error(`Jupiter swap build falhou com status ${swapRes.status}`);
    const { swapTransaction } = await swapRes.json();

    const txBuffer = Buffer.from(swapTransaction, "base64");
    const tx = Transaction.from(txBuffer);
    tx.partialSign(owner);

    const txHash = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txHash, "confirmed");
    const bxpAmount = Number(quote.outAmount);

    console.log(`[Tokenomics] ✅ Buyback via Jupiter OK! Tx: ${txHash}`);
    console.log(`[Tokenomics]    BXP comprado: ${bxpAmount} unidades brutas`);

    return { success: true, bxpAmount, txHash, provider: "Jupiter" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Tokenomics] ❌ Jupiter Fallback também falhou: ${msg}`);
    return { success: false, bxpAmount: 0, txHash: null, provider: "Failed" };
  }
}

// ---------------------------------------------------------------------------
// PT-BR: Motor de Queima On-Chain — TOKEN_PROGRAM_ID → TOKEN_2022 (fallback)
// EN:    On-Chain Burn Engine — TOKEN_PROGRAM_ID → TOKEN_2022 (fallback)
// ---------------------------------------------------------------------------

/**
 * PT-BR: Queima diretamente on-chain os BXP adquiridos no buyback.
 * EN:    Burns on-chain the BXP acquired during the buyback.
 *
 * Tenta TOKEN_PROGRAM_ID primeiro (BXP_CLASSIC — padrão pós-v3.1),
 * depois TOKEN_2022_PROGRAM_ID como fallback para compatibilidade retroativa.
 *
 * IMPORTANTE: `bxpAmountRaw` DEVE ser um inteiro positivo. Valores fracionários
 * causarão o erro "Cannot convert undefined to a BigInt" na instrução de burn.
 * A conversão `BigInt(bxpAmountRaw)` lançará TypeError se o valor não for inteiro.
 *
 * @param bxpAmountRaw - Quantidade de BXP em unidades brutas (inteiro) / Raw BXP units (integer)
 * @param network      - Rede Solana / Solana network
 */
export async function executeBurn(
  bxpAmountRaw: number,
  network: string
): Promise<{ success: boolean; txHash: string | null }> {
  // PT-BR: Validações de guarda para evitar o TypeError de BigInt
  // EN:    Guard validations to prevent BigInt TypeError
  if (!bxpAmountRaw || bxpAmountRaw <= 0) {
    console.warn(`[Tokenomics] ⚠️  Burn ignorado: bxpAmountRaw=${bxpAmountRaw} (zero ou inválido)`);
    return { success: false, txHash: null };
  }

  // PT-BR: Garante que o valor é um inteiro antes de converter para BigInt
  // EN:    Ensures the value is an integer before converting to BigInt
  const burnAmount = Math.floor(bxpAmountRaw);

  if (burnAmount <= 0) {
    console.warn(`[Tokenomics] ⚠️  Burn ignorado após Math.floor: burnAmount=${burnAmount}`);
    return { success: false, txHash: null };
  }

  console.log(`[Tokenomics] 🔥 Iniciando BURN atômico de ${burnAmount} unidades brutas de BXP...`);
  console.log(`[Tokenomics]    Rede: ${network} | Mint: ${BXP_MINT || "NÃO CONFIGURADO"}`);

  if (!process.env.FEE_PAYER_SECRET_KEY) {
    throw new Error("FEE_PAYER_SECRET_KEY ausente");
  }

  if (!BXP_MINT || BXP_MINT.length < 30) {
    console.error("[Tokenomics] ❌ BXP_TOKEN_MINT inválido — burn impossível.");
    return { success: false, txHash: null };
  }

  const owner = Keypair.fromSecretKey(
    bs58.decode(process.env.FEE_PAYER_SECRET_KEY.replace(/["']/g, ""))
  );
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const mintPubkey = new PublicKey(BXP_MINT);

  // PT-BR: Converte para BigInt APÓS validação de inteiro — evita TypeError
  // EN:    Converts to BigInt AFTER integer validation — prevents TypeError
  const burnAmountBigInt = BigInt(burnAmount);

  // PT-BR: Tenta com TOKEN_PROGRAM_ID primeiro (SPL padrão), depois TOKEN_2022
  // EN:    Tries TOKEN_PROGRAM_ID first (standard SPL), then TOKEN_2022
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const programName = programId === TOKEN_PROGRAM_ID ? "TOKEN_PROGRAM_ID" : "TOKEN_2022_PROGRAM_ID";
    try {
      console.log(`[Tokenomics] 🔄 Tentando burn com ${programName}...`);
      const ata = await getAssociatedTokenAddress(mintPubkey, owner.publicKey, false, programId);
      const tx = new Transaction().add(
        createBurnInstruction(ata, mintPubkey, owner.publicKey, burnAmountBigInt, [], programId)
      );
      const txHash = await sendAndConfirmTransaction(connection, tx, [owner], {
        commitment: "confirmed",
      });
      console.log(`[Tokenomics] ✅ BXP QUEIMADO com sucesso! Programa: ${programName} | Tx: ${txHash}`);
      return { success: true, txHash };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Tokenomics] ⚠️  Burn com ${programName} falhou: ${msg}`);
    }
  }

  console.error("[Tokenomics] ❌ Burn falhou com TOKEN_PROGRAM_ID e TOKEN_2022_PROGRAM_ID.");
  return { success: false, txHash: null };
}

// ---------------------------------------------------------------------------
// PT-BR: Orquestrador principal do Sweep — chamado pela rota execute-buy
// EN:    Main Sweep orchestrator — called by the execute-buy route
// ---------------------------------------------------------------------------

/**
 * PT-BR: Executa o ciclo completo de Sweep para uma ordem de compra.
 * EN:    Executes the full Sweep cycle for a purchase order.
 *
 * Sequência / Sequence:
 *   1. Calcula a divisão de taxa (Split)
 *   2. Registra depósito na Treasury (stub)
 *   3. Executa Buyback (Raydium CPMM ou Jupiter)
 *   4. Queima os BXP comprados on-chain
 *
 * @param orderId   - ID da ordem para rastreamento em logs / Order ID for log tracking
 * @param usdAmount - Valor total da transação em USD / Total transaction value in USD
 * @param network   - Rede Solana (`devnet` ou `mainnet-beta`) / Solana network
 */
export async function executeSweep(
  orderId:    string,
  usdAmount:  number,
  network:    string,
  usdPerSol:  number
): Promise<{
  feeInfo:    FeeSplitResult;
  buybackTx:  string | null;
  burnTx:     string | null;
  bxpBurned:  number;
  provider:   string | null;
}> {
  console.log(`[Tokenomics] ═══════════════════════════════════════════`);
  console.log(`[Tokenomics] 🔄 SWEEP INICIADO para Ordem: ${orderId}`);
  console.log(`[Tokenomics]    Valor total : $${usdAmount.toFixed(4)} USD`);
  console.log(`[Tokenomics]    Oracle price: 1 SOL = $${usdPerSol.toFixed(2)}`);

  // PT-BR: Calcula a divisão da taxa da plataforma
  // EN:    Calculates the platform fee split
  const feeInfo = splitFee(usdAmount);
  console.log(`[Tokenomics]    Fee total   : $${feeInfo.totalFeeUsd.toFixed(4)} USD`);
  console.log(`[Tokenomics]    → Treasury  : $${feeInfo.treasuryFeeUsd.toFixed(4)} USD`);
  console.log(`[Tokenomics]    → Buyback   : $${feeInfo.buybackFeeUsd.toFixed(4)} USD`);

  // PT-BR: Passo 1: Depositar na Treasury (sem-op para hackathon)
  // EN:    Step 1: Treasury deposit (no-op for hackathon)
  await treasuryDeposit(feeInfo.treasuryFeeUsd, network);

  // PT-BR: Passo 2: Buyback — compra BXP com a parcela de buyback (preço Oracle propagado)
  // EN:    Step 2: Buyback — buy BXP with the buyback portion (Oracle price propagated)
  const buybackResult = await executeBuyback(feeInfo.buybackFeeUsd, network, usdPerSol);

  // PT-BR: Passo 3: Burn — queima os BXP comprados (se o buyback teve sucesso)
  // EN:    Step 3: Burn — burn the purchased BXP (if buyback was successful)
  let burnResult: { success: boolean; txHash: string | null } = { success: false, txHash: null };

  if (buybackResult.success && buybackResult.bxpAmount > 0) {
    burnResult = await executeBurn(buybackResult.bxpAmount, network);
  } else {
    console.warn(
      `[Tokenomics] ⚠️  Burn pulado: buyback falhou ou retornou 0 BXP. ` +
        `success=${buybackResult.success}, bxpAmount=${buybackResult.bxpAmount}`
    );
  }

  const bxpBurnedDisplay = (buybackResult.bxpAmount / 1e6).toFixed(6);
  console.log(
    `[Tokenomics] 🔥 Protocol bought & burned ${bxpBurnedDisplay} $BXP via ${buybackResult.provider}`
  );
  console.log(`[Tokenomics] ═══════════════════════════════════════════`);

  return {
    feeInfo,
    buybackTx: buybackResult.txHash,
    burnTx:    burnResult.txHash,
    bxpBurned: buybackResult.bxpAmount,
    provider:  buybackResult.provider,
  };
}
