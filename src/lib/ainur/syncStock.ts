import { createClient } from "@supabase/supabase-js";
import { listAinurProducts, DEFAULT_STORE_ID } from "./client";

export interface SyncStockResult {
  total: number;
  updated: number;
  errors: { ainur_id: string; name: string; error: string }[];
}

export async function syncStockFromAinur(options?: {
  storeId?: string;
  triggeredBy?: string;
  adminEmail?: string;
}): Promise<SyncStockResult> {
  const storeId = options?.storeId ?? DEFAULT_STORE_ID;

  let products;
  try {
    products = await listAinurProducts({
      storeId,
      limit: 1000,
      _revalidate: 0,
      _timeoutMs: 30_000,
    });
  } catch (err) {
    const errorInfo = {
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error && err.cause ? String(err.cause) : undefined,
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 3).join("\n") : undefined,
    };
    console.error("[syncStockFromAinur] listAinurProducts failed:", JSON.stringify(errorInfo, null, 2));
    throw err;
  }

  const stockByAinurId = new Map<string, number>();
  for (const p of products) {
    const qty = Math.floor(Number(p.stock?.[storeId] ?? 0));
    stockByAinurId.set(p.id, qty);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: dbProducts } = await admin
    .from("products")
    .select("id, ainur_id, name")
    .not("ainur_id", "is", null);

  const total = dbProducts?.length ?? 0;
  let updated = 0;
  const errors: SyncStockResult["errors"] = [];

  for (const row of dbProducts ?? []) {
    const ainurStock = stockByAinurId.get(row.ainur_id!);
    if (ainurStock === undefined) continue;

    const { error } = await admin
      .from("products")
      .update({ count: ainurStock })
      .eq("id", row.id);

    if (error) {
      errors.push({
        ainur_id: row.ainur_id!,
        name: row.name,
        error: error.message,
      });
    } else {
      updated++;
    }
  }

  await admin.from("stock_sync_log").insert({
    triggered_by: options?.triggeredBy ?? "system",
    admin_email: options?.adminEmail ?? null,
    total_products: total,
    updated_count: updated,
    errors: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : null,
  });

  return { total, updated, errors };
}
