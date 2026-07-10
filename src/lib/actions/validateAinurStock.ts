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
  let stockMap: Awaited<ReturnType<typeof buildAinurStockMap>>;
  try {
    stockMap = await buildAinurStockMap(undefined, true);
  } catch (err) {
    console.warn("validateAinurStock: AinurPOS недоступен, пропускаю проверку", err);
    return { valid: true };
  }

  for (const item of items) {
    if (!item.ainur_id) continue;

    const ainurStock = item.ainur_id in stockMap.byId ? stockMap.byId[item.ainur_id] : 0;

    if (item.quantity > ainurStock) {
      return {
        valid: false,
        error: "OUT_OF_STOCK",
        itemName: item.name,
        requested: item.quantity,
        available: ainurStock,
      };
    }
  }

  return { valid: true };
}
