import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();

    // Fetch the 10 most recent successful orders with their transactions
    const { data: orders, error } = await admin
      .from("orders")
      .select(`
        id,
        amount_usd,
        token_mint,
        creator_handle,
        status,
        created_at,
        transactions (
          tx_hash,
          is_real_tx,
          network,
          explorer_url
        )
      `)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: orders ?? [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[/api/feed] Error:", message);
    return NextResponse.json(
      { success: false, error: message, data: [] },
      { status: 500 }
    );
  }
}
