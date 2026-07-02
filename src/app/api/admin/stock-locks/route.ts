import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderItem } from "@/types";

export const dynamic = "force-dynamic";

// Returns a map of ainur_id → quantity locked in pending-payment orders.
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("items")
      .eq("payment_status", "pending_payment")
      .neq("order_status", "cancelled");

    const missingPids = new Set<string>();
    for (const row of pendingOrders ?? []) {
      const orderItems = row.items as OrderItem[];
      for (const item of orderItems) {
        if (!item.ainur_id && item.product_id) {
          missingPids.add(item.product_id);
        }
      }
    }

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

    return NextResponse.json({ locked });
  } catch (err) {
    console.error("[/api/admin/stock-locks] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
