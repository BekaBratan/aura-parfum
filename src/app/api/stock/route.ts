import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/ainur/client";
import { buildAinurStockMap } from "@/lib/ainur/server";

export const dynamic = "force-dynamic";

// Returns a map of normalized product name → stock count, pulled from the
// configured Ainur store. The catalogue uses this as a live-stock overlay on
// top of the Supabase product table.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id") || DEFAULT_STORE_ID;
    const data = await buildAinurStockMap(storeId);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[/api/stock] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
