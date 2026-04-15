/**
 * GET /api/bags/feed
 *
 * Retorna o token launch feed da Bags — lista de tokens recentes
 * com nome, símbolo, imagem, status e tokenMint.
 *
 * Usado pela demo para exibir tokens trending sem o usuário precisar
 * digitar um tokenMint manualmente.
 *
 * Cache: revalidate 30s (configurado no bags.ts)
 */

import { NextResponse } from "next/server";
import { getTokenLaunchFeed } from "@/services/bags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await getTokenLaunchFeed();

    return NextResponse.json({
      success: true,
      data: feed,
      count: feed.length,
      source:
        feed.length > 0
          ? "bags_api"
          : "demo_fallback",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[/api/bags/feed] Error:", message);
    return NextResponse.json(
      { success: false, error: message, data: [] },
      { status: 500 }
    );
  }
}
