// Server-side composition of Ainur fetches into stock maps.
// Importing this from a client component will throw — uses the secret token.
import {
  DEFAULT_STORE_ID,
  listAinurProducts,
} from "./client";
import { normalizeProductName, type StockMap } from "./stockOverlay";

/**
 * Pull the full Ainur product list and build the stock map used by the
 * overlay. Indexed both by Ainur product id (preferred) and by normalized
 * name (fallback for not-yet-linked Supabase products).
 *
 * On name collisions we keep the larger count — better to over-report than
 * to hide stock from the catalog.
 */
export async function buildAinurStockMap(storeId: string = DEFAULT_STORE_ID): Promise<StockMap> {
  const products = await listAinurProducts({ storeId, limit: 1000 });
  const byId: Record<string, number> = {};
  const byName: Record<string, number> = {};

  for (const p of products) {
    const rawCount = Number(p.stock?.[storeId] ?? 0);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;

    // Always record by id, even when count is 0 — an explicit Supabase ↔ Ainur
    // link means we trust Ainur. Without this, a linked-but-zero product would
    // silently fall through to the name-match fallback and surface a stale
    // Supabase count.
    if (p.id) {
      byId[p.id] = count;
    }

    // Name index only carries positive stock so a 0-stock entry can't displace
    // a real one on a name collision.
    if (count > 0) {
      const key = normalizeProductName(p.options?.name ?? "");
      if (key && (!(key in byName) || byName[key] < count)) {
        byName[key] = count;
      }
    }
  }

  return { byId, byName };
}
