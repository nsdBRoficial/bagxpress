/**
 * GET /api/bags/creator — LIVE DATA MODE
 *
 * Busca dados reais de creator/token na plataforma Bags.
 *
 * Query params:
 *   - tokenMint: string  (endereço mint do token Solana — modo principal, retorna dados completos)
 *   - handle:    string  (ex: "satoshi" — busca wallet real + platformData via fee-share/wallet/v2)
 *
 * Resposta de sucesso (200):
 * {
 *   success: true,
 *   data: BagsCreatorData,
 *   source: "bags_api" | "handle_lookup" | "demo_fallback"
 * }
 *
 * Resposta de erro (400 / 500):
 * { success: false, error: string }
 */

import { NextResponse } from "next/server";
import { getTokenCreators, getCreatorWalletByHandle } from "@/services/bags";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenMint = searchParams.get("tokenMint");
    const handle = searchParams.get("handle");

    if (!tokenMint && !handle) {
      return NextResponse.json(
        { success: false, error: "Provide 'tokenMint' or 'handle' query param" },
        { status: 400 }
      );
    }

    const apiKeyConfigured =
      !!process.env.BAGS_API_KEY &&
      process.env.BAGS_API_KEY !== "your_bags_api_key_here";

    // -------------------------------------------------------------------------
    // Modo 1: tokenMint → dados completos do creator via /token-launch/creator/v3
    // -------------------------------------------------------------------------
    if (tokenMint) {
      const data = await getTokenCreators(tokenMint);
      return NextResponse.json({
        success: true,
        data,
        source: apiKeyConfigured ? "bags_api" : "demo_fallback",
      });
    }

    // -------------------------------------------------------------------------
    // Modo 2: handle → wallet real via /fee-share/wallet/v2 (LIVE se API key existe)
    // -------------------------------------------------------------------------
    const cleanHandle = handle!.replace(/^@/, "").trim().toLowerCase();

    if (!cleanHandle) {
      return NextResponse.json(
        { success: false, error: "Handle inválido" },
        { status: 400 }
      );
    }

    // Tentativa de resolver wallet real via API da Bags
    const realData = await getCreatorWalletByHandle(cleanHandle, "twitter");

    if (realData) {
      // ✅ Dados reais — criador encontrado na Bags via handle Twitter
      const profile = {
        displayName: realData.displayName,
        avatarUrl: realData.avatarUrl,
        wallet: realData.wallet,
        provider: "twitter" as const,
        providerUsername: cleanHandle,
        royaltyPercent: 5, // padrão Bags; precisaria do tokenMint para o valor exato
        isCreator: true,
        twitterUsername: cleanHandle,
        bagsUsername: cleanHandle,
      };

      return NextResponse.json({
        success: true,
        data: {
          tokenMint: null,
          creators: [profile],
          primaryCreator: profile,
          _note:
            "Handle mode: wallet resolved via fee-share/wallet/v2. Provide tokenMint for full token data (royalties, pool keys).",
        },
        source: "handle_lookup_live",
      });
    }

    // Fallback: handle não encontrado na Bags, usar unavatar.io para avatar social
    const fallbackProfile = {
      displayName: cleanHandle,
      avatarUrl: `https://unavatar.io/twitter/${cleanHandle}`,
      wallet: "Handle não encontrado na Bags",
      provider: "twitter" as const,
      providerUsername: cleanHandle,
      royaltyPercent: 0,
      isCreator: false,
      twitterUsername: cleanHandle,
      bagsUsername: cleanHandle,
    };

    return NextResponse.json({
      success: true,
      data: {
        tokenMint: null,
        creators: [fallbackProfile],
        primaryCreator: fallbackProfile,
        _note:
          "Creator não encontrado na Bags. Forneça o tokenMint do token para dados completos.",
      },
      source: "handle_not_found",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[/api/bags/creator] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
