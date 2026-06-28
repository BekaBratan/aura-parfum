"use server";

import { buildAinurStockMap } from "@/lib/ainur/server";
import { normalizeProductName } from "@/lib/ainur/stockOverlay";

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
    let available = 0;

    if (item.ainur_id && item.ainur_id in stockMap.byId) {
      available = stockMap.byId[item.ainur_id];
    } else {
      const key = normalizeProductName(item.name);
      if (key && key in stockMap.byName) {
        available = stockMap.byName[key];
      }
    }

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
