import type { Product } from "@/types";

// Normalize a product name so small spelling/whitespace/casing differences
// don't break the fallback name match.
const TRAILING_MARKERS = /(\s+(fr|lz|c\/v|cv|premium|премиум|de\s*luxe|deluxe|делюкс|оригинал|original|w|m|u))+\s*$/gi;

export function normalizeProductName(raw: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(TRAILING_MARKERS, " ")
    .replace(/&/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface StockMap {
  byId: Record<string, number>;
  byName: Record<string, number>;
}

export const EMPTY_STOCK_MAP: StockMap = { byId: {}, byName: {} };

/**
 * Replace `count` on each Supabase product with the matching count from Ainur.
 * Matching priority:
 *   1. exact `ainur_id` if the product has one set in Supabase
 *   2. fallback: normalized name match
 * Products with an `ainur_id` that isn't found in AinurPOS are treated as out of stock.
 * Products without `ainur_id` keep their original Supabase count.
 */
export function applyStockOverlay(products: Product[], stockMap: StockMap): Product[] {
  const isEmpty = Object.keys(stockMap.byId).length === 0 && Object.keys(stockMap.byName).length === 0;
  if (isEmpty) return products;

  return products.map((p) => {
    if (p.ainur_id && p.ainur_id in stockMap.byId) {
      return { ...p, count: stockMap.byId[p.ainur_id] };
    }
    const key = normalizeProductName(p.name);
    if (key && key in stockMap.byName) {
      return { ...p, count: stockMap.byName[key] };
    }
    if (p.ainur_id) {
      return { ...p, count: 0 };
    }
    return p;
  });
}

const STOCK_FETCH_TIMEOUT_MS = 8_000;

// Client-side fetch — used from "use client" components. Hits our /api/stock proxy.
// Returns EMPTY_STOCK_MAP when AinurPOS is unreachable or times out — falls back to Supabase counts.
export async function fetchAinurStockMap(): Promise<StockMap> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STOCK_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("/api/stock", { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`/api/stock failed: ${res.status}`);
    const json = (await res.json()) as { data?: StockMap; error?: string };
    if (json.error || !json.data) throw new Error(json.error ?? "Empty stock map");
    return json.data;
  } catch (err) {
    console.warn("fetchAinurStockMap: AinurPOS недоступен, использую Supabase count", err);
    return EMPTY_STOCK_MAP;
  }
}

// Server-side fetch — used from server components like the home page.
// Imports the Ainur server helper lazily to avoid pulling the secret token
// into any client bundle.
// Returns EMPTY_STOCK_MAP when AinurPOS is unreachable.
export async function fetchAinurStockMapServer(): Promise<StockMap> {
  try {
    const { buildAinurStockMap } = await import("./server");
    return await buildAinurStockMap();
  } catch (err) {
    console.warn("fetchAinurStockMapServer: AinurPOS недоступен, использую Supabase count", err);
    return EMPTY_STOCK_MAP;
  }
}
