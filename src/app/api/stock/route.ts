import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/ainur/client";
import { buildAinurStockMap } from "@/lib/ainur/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderItem } from "@/types";

export const dynamic = "force-dynamic";

// Returns a map of product id → available stock count, pulled from Ainur and
// reduced by quantities locked in unpaid Supabase orders.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id") || DEFAULT_STORE_ID;

    const [stockMap, supabase] = await Promise.all([
      buildAinurStockMap(storeId),
      createClient(),
    ]);

    // Query pending orders to compute locked quantities
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("items")
      .eq("payment_status", "pending_payment")
      .neq("order_status", "cancelled");

    // Collect product_ids that miss ainur_id in order items (pre-v7 orders)
    const missingPids = new Set<string>();
    for (const row of pendingOrders ?? []) {
      const orderItems = row.items as OrderItem[];
      for (const item of orderItems) {
        if (!item.ainur_id && item.product_id) {
          missingPids.add(item.product_id);
        }
      }
    }

    // Batch-fetch ainur_id for missing products
    const productFallback: Record<string, string | null> = {};
    if (missingPids.size > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, ainur_id")
        .in("id", [...missingPids]);
      for (const p of products ?? []) {
        productFallback[p.id] = p.ainur_id ?? null;
      }
    }

    // Build locked map: ainur_id → total locked quantity
    const locked: Record<string, number> = {};
    for (const row of pendingOrders ?? []) {
      const orderItems = row.items as OrderItem[];
      for (const orderItem of orderItems) {
        const aid = orderItem.ainur_id ?? productFallback[orderItem.product_id] ?? undefined;
        if (aid) {
          locked[aid] = (locked[aid] ?? 0) + orderItem.quantity;
        }
      }
    }

    // Subtract locked quantities from the raw Ainur stock map
    const byId: Record<string, number> = {};
    for (const [id, raw] of Object.entries(stockMap.byId)) {
      const lockedQty = locked[id] ?? 0;
      byId[id] = Math.max(0, raw - lockedQty);
    }

    return NextResponse.json({ data: { byId, byName: stockMap.byName } });
  } catch (err) {
    console.error("[/api/stock] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
