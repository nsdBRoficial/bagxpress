import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl, ParsedTransactionWithMeta } from "@solana/web3.js";
import { getSolPrice } from "@/services/oracle";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * MISSÃO V10.3 — REAL DATA TRUTH ENGINE
 * 
 * Agrega dados reais da Solana Devnet para o Dashboard BXP.
 * Parses avançados de Raydium Buybacks, Burns, e Settlements reais.
 */

const BXP_MINT = "5xSwDXXc2pp5xy99sAAdFuhyGPv1XQPectZrxtG6tRKL";
const TREASURY_ADDRESS = process.env.FEE_PAYER_PUBLIC_KEY || "8PzYpY5D7v9B9z5vS7pW9X7S7z5vS7pW9X7S7z5vS7pW";
const MAX_SUPPLY = 10000000; // 10M fixos no genesis
const RAYDIUM_V4_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"; // Typical Raydium Devnet/Mainnet ID

let cachedData: any = null;
let lastFetch = 0;
const CACHE_TTL = 10000; // 10s para performance máxima sem quebrar RPC

export async function GET(req: NextRequest) {
  const now = Date.now();
  
  if (cachedData && (now - lastFetch < CACHE_TTL)) {
    return NextResponse.json(cachedData);
  }

  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed");
    const mintPubkey = new PublicKey(BXP_MINT);
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);

    // 1. Fetch Total Supply (Real on-chain)
    const supplyInfo = await connection.getTokenSupply(mintPubkey);
    const totalSupply = Number(supplyInfo.value.amount) / Math.pow(10, supplyInfo.value.decimals);

    // 2. Burned Calculation (Max Supply - Current Supply)
    const burnedTotal = Math.max(0, MAX_SUPPLY - totalSupply);

    // 3. Fetch Largest Accounts (Real on-chain)
    const largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);
    const topHolders = largestAccounts.value.map((acc, index) => ({
      rank: index + 1,
      address: acc.address.toBase58(),
      balance: acc.uiAmount,
      percentage: ((acc.uiAmount || 0) / totalSupply) * 100,
      label: "Token Account" 
    })).slice(0, 5);

    // 4. Treasury Balance (SOL + BXP)
    let treasurySol = null;
    let treasuryBxp = null;
    try {
      const balance = await connection.getBalance(treasuryPubkey);
      treasurySol = balance / 1e9;

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(treasuryPubkey, { mint: mintPubkey });
      if (tokenAccounts.value.length > 0) {
        treasuryBxp = tokenAccounts.value.reduce((acc, accountInfo) => {
          return acc + (accountInfo.account.data.parsed.info.tokenAmount.uiAmount || 0);
        }, 0);
      } else {
        treasuryBxp = 0;
      }
    } catch (e) {
      console.warn("Falha ao buscar saldos do treasury", e);
    }

    // 5. Oracle Price (Cascata: Jupiter -> DexScreener -> Null)
    const { usdPerSol } = await getSolPrice();
    let bxpPriceUsd = null;
    
    try {
      const jupRes = await fetch(`https://price.jup.ag/v6/price?ids=${BXP_MINT}`);
      const jupData = await jupRes.json();
      if (jupData?.data?.[BXP_MINT]?.price) {
        bxpPriceUsd = jupData.data[BXP_MINT].price;
      } else {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${BXP_MINT}`);
        const dexData = await dexRes.json();
        if (dexData?.pairs && dexData.pairs.length > 0) {
          bxpPriceUsd = parseFloat(dexData.pairs[0].priceUsd);
        }
      }
    } catch (e) {
      console.warn("Falha ao buscar preco do BXP", e);
    }

    // 6. Real Data Truth Engine: Event Normalizer & Feed
    let activity: any[] = [];
    let burnedToday = 0;
    
    try {
      // 6.1 Supabase Check for Real Burns Today
      const supabase = createSupabaseAdminClient();
      const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: burnEvents } = await supabase
        .from('burn_events')
        .select('amount_burned')
        .gte('created_at', oneDayAgoIso);
      
      if (burnEvents && burnEvents.length > 0) {
         burnedToday = burnEvents.reduce((acc, ev) => acc + Number(ev.amount_burned), 0);
      }

      // 6.2 Semantic RPC Parsing
      const sigs = await connection.getSignaturesForAddress(mintPubkey, { limit: 15 });
      const txHashes = sigs.map(s => s.signature);
      const parsedTxs = await connection.getParsedTransactions(txHashes, { maxSupportedTransactionVersion: 0 });
      
      const oneDayAgoSecs = (Date.now() / 1000) - (24 * 60 * 60);

      parsedTxs.forEach((tx: ParsedTransactionWithMeta | null, idx: number) => {
        if (!tx || !tx.meta) return;

        const sigInfo = sigs[idx];
        const blockTime = tx.blockTime || sigInfo.blockTime;
        
        let type = "RAW_TRANSFER";
        let amount: number | null = null;
        let wallet = "Unknown";
        let source = "RPC";
        
        const preTokenBalances = tx.meta.preTokenBalances || [];
        const postTokenBalances = tx.meta.postTokenBalances || [];
        const logMessages = (tx.meta.logMessages || []).join(" ").toLowerCase();

        // Check for Raydium / Swap patterns
        const isRaydium = logMessages.includes(RAYDIUM_V4_PROGRAM_ID.toLowerCase()) || logMessages.includes("raydium") || logMessages.includes("swap");
        
        // Detect Burn
        const isBurn = logMessages.includes("burn");

        const treasuryPre = preTokenBalances.find(b => b.owner === TREASURY_ADDRESS && b.mint === BXP_MINT);
        const treasuryPost = postTokenBalances.find(b => b.owner === TREASURY_ADDRESS && b.mint === BXP_MINT);

        if (isRaydium) {
           source = "Raydium";
           // Simplistic logic for DEVNET identifying a swap
           const anyPre = preTokenBalances.find(b => b.mint === BXP_MINT && Number(b.uiTokenAmount.uiAmount) > 0);
           const anyPost = postTokenBalances.find(b => b.mint === BXP_MINT && b.owner === anyPre?.owner);
           if (anyPre && anyPost) {
             const diff = Number(anyPre.uiTokenAmount.uiAmount) - Number(anyPost.uiTokenAmount.uiAmount);
             if (diff > 0) {
               // A user sold or protocol bought?
               if (treasuryPre && treasuryPost && Number(treasuryPost.uiTokenAmount.uiAmount) > Number(treasuryPre.uiTokenAmount.uiAmount)) {
                 type = "BUYBACK_RAYDIUM";
                 amount = Number(treasuryPost.uiTokenAmount.uiAmount) - Number(treasuryPre.uiTokenAmount.uiAmount);
                 wallet = TREASURY_ADDRESS;
               } else {
                 type = "SWAP_SELL";
                 amount = diff;
                 wallet = anyPre.owner || "Unknown";
               }
             } else if (diff < 0) {
               type = "SWAP_BUY";
               amount = Math.abs(diff);
               wallet = anyPre.owner || "Unknown";
             }
           }
        } else if (isBurn) {
           type = "BURN";
           // Fallback burn calculation if supabase is empty
           const preSupply = Number(tx.meta.preBalances[0]); // Approximation logic fallback
           const anyPre = preTokenBalances.find(b => b.mint === BXP_MINT && Number(b.uiTokenAmount.uiAmount) > 0);
           const anyPost = postTokenBalances.find(b => b.mint === BXP_MINT && b.owner === anyPre?.owner);
           if (anyPre && anyPost) {
              amount = Number(anyPre.uiTokenAmount.uiAmount) - Number(anyPost.uiTokenAmount.uiAmount);
           }
           if (burnedToday === 0 && blockTime && blockTime > oneDayAgoSecs) {
              burnedToday += (amount || 0);
           }
        } else if (treasuryPre && treasuryPost) {
           const diff = Number(treasuryPost.uiTokenAmount.uiAmount) - Number(treasuryPre.uiTokenAmount.uiAmount);
           if (diff > 0) {
             type = "TREASURY_INFLOW";
             amount = diff;
             wallet = "Treasury";
           } else if (diff < 0) {
             type = "CREATOR_SETTLEMENT"; // Assuming outflows are usually settlements or sweeps
             amount = Math.abs(diff);
             wallet = "Treasury";
           }
        } else {
           const anyPre = preTokenBalances.find(b => b.mint === BXP_MINT && Number(b.uiTokenAmount.uiAmount) > 0);
           const anyPost = postTokenBalances.find(b => b.mint === BXP_MINT && b.owner === anyPre?.owner);
           if (anyPre && anyPost) {
              const diff = Number(anyPre.uiTokenAmount.uiAmount) - Number(anyPost.uiTokenAmount.uiAmount);
              if (diff > 0) {
                 type = "BUY_USER"; // Generic user transfer
                 amount = diff;
                 wallet = anyPre.owner || "Unknown";
              }
           }
        }

        activity.push({
          id: sigInfo.signature,
          type: type,
          amount: amount,
          wallet: wallet,
          txHash: sigInfo.signature,
          time: blockTime ? new Date(blockTime * 1000).toLocaleString() : "Unknown",
          relativeTime: blockTime ? getRelativeTime(blockTime * 1000) : "Unknown",
          source: source
        });
      });

    } catch (e) {
      console.warn("Falha ao realizar parse de transacoes", e);
    }

    const data = {
      price: bxpPriceUsd,
      priceChange24h: null,
      totalSupply: MAX_SUPPLY,
      circulatingSupply: totalSupply,
      burnedTotal: burnedTotal,
      burnedToday: burnedToday,
      treasuryBalance: treasurySol !== null ? (treasurySol * usdPerSol) + ((treasuryBxp || 0) * (bxpPriceUsd || 0)) : null,
      holders: null, 
      volume24h: null,
      lastTransaction: activity.length > 0 ? {
        hash: activity[0].txHash,
        type: activity[0].type,
        amount: activity[0].amount,
        time: activity[0].relativeTime
      } : null,
      activity: activity.slice(0, 5),
      topHolders: topHolders
    };

    cachedData = data;
    lastFetch = now;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Tokenomics API Error:", error);
    return NextResponse.json({
      price: null,
      priceChange24h: null,
      totalSupply: null,
      circulatingSupply: null,
      burnedTotal: null,
      burnedToday: null,
      treasuryBalance: null,
      holders: null,
      volume24h: null,
      lastTransaction: null,
      activity: [],
      topHolders: [],
      error: "Live data unavailable"
    });
  }
}

function getRelativeTime(timestamp: number) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const daysDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
  const hoursDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
  const minutesDifference = Math.round((timestamp - Date.now()) / (1000 * 60));
  const secondsDifference = Math.round((timestamp - Date.now()) / 1000);

  if (Math.abs(daysDifference) > 0) return rtf.format(daysDifference, 'day');
  if (Math.abs(hoursDifference) > 0) return rtf.format(hoursDifference, 'hour');
  if (Math.abs(minutesDifference) > 0) return rtf.format(minutesDifference, 'minute');
  return rtf.format(secondsDifference, 'second');
}
