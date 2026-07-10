import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/ainur/client";
import { buildAinurStockMap } from "@/lib/ainur/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id") || DEFAULT_STORE_ID;

    const stockMap = await buildAinurStockMap(storeId);

    return NextResponse.json({ data: stockMap });
  } catch (err) {
    console.error("[/api/stock] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
