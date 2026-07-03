"use server";

import { createClient } from "@/lib/supabase/server";
import { buildAinurStockMap } from "@/lib/ainur/server";
import type { OrderItem } from "@/types";

export type ValidationItem = {
  product_id: string;
  name: string;
  quantity: number;
  ainur_id?: string | null;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: "OUT_OF_STOCK"; itemName: string; requested: number; available: number };

export async function validateAinurStock(items: ValidationItem[]): Promise<ValidationResult> {
  let stockMap: Awaited<ReturnType<typeof buildAinurStockMap>>;
  try {
    stockMap = await buildAinurStockMap(undefined, true);
  } catch (err) {
    console.warn("validateAinurStock: AinurPOS недоступен, пропускаю проверку", err);
    return { valid: true };
  }
  const supabase = await createClient();

  // Build a map of locked quantities from unpaid Ainur-linked orders
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("items")
    .eq("payment_status", "pending_payment")
    .neq("order_status", "cancelled");

  // Collect product_ids that miss ainur_id in order items (pre-v7 orders)
  const missingPids = new Set<string>();
  for (const row of pendingOrders ?? []) {
    const orderItems = row.items as OrderItem[];
    for (const orderItem of orderItems) {
      if (!orderItem.ainur_id && orderItem.product_id) {
        missingPids.add(orderItem.product_id);
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

  for (const item of items) {
    if (!item.ainur_id) continue;

    const ainurStock = item.ainur_id in stockMap.byId ? stockMap.byId[item.ainur_id] : 0;
    const lockedQty = locked[item.ainur_id] ?? 0;
    const available = Math.max(0, ainurStock - lockedQty);

    if (item.quantity > available) {
      return {
        valid: false,
        error: "OUT_OF_STOCK",
        itemName: item.name,
        requested: item.quantity,
        available,
      };
    }
  }

  return { valid: true };
}
