"use server";

import { buildAinurStockMap } from "@/lib/ainur/server";

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
  const stockMap = await buildAinurStockMap(undefined, true);

  for (const item of items) {
    // Product without ainur_id is managed by Supabase stock — skip Ainur check
    if (!item.ainur_id) continue;

    const available = item.ainur_id in stockMap.byId ? stockMap.byId[item.ainur_id] : 0;

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
