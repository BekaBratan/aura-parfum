import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAinurStockMap } from "@/lib/ainur/server";
import type { OrderItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let productId = url.searchParams.get("product_id");
    const productName = url.searchParams.get("name");

    const supabase = await createClient();

    // Search by name if no product_id given
    if (!productId && productName) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${productName}%`)
        .limit(10);
      return NextResponse.json({ searchResults: products ?? [] });
    }

    if (!productId) {
      return NextResponse.json({ error: "Pass ?product_id= or ?name=" }, { status: 400 });
    }

    // 1. Get product info
    const { data: product } = await supabase
      .from("products")
      .select("id, name, ainur_id, count")
      .eq("id", productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Get Ainur stock (if product has ainur_id)
    let ainurStock: number | null = null;
    if (product.ainur_id) {
      const stockMap = await buildAinurStockMap();
      ainurStock = stockMap.byId[product.ainur_id] ?? 0;
    }

    // 3. Query pending orders and build locked map
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, invoice_number, items")
      .eq("payment_status", "pending_payment")
      .neq("order_status", "cancelled");

    // Fallback: collect all product_ids that lack ainur_id in items
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

    const ordersWithLock: Array<{ id: string; invoice_number: string; quantity: number }> = [];
    let lockedQty = 0;

    for (const row of pendingOrders ?? []) {
      const orderItems = row.items as OrderItem[];
      for (const orderItem of orderItems) {
        const aid = orderItem.ainur_id ?? productFallback[orderItem.product_id] ?? undefined;
        if (aid && aid === product.ainur_id) {
          lockedQty += orderItem.quantity;
          ordersWithLock.push({
            id: row.id,
            invoice_number: row.invoice_number,
            quantity: orderItem.quantity,
          });
        }
      }
    }

    // Items in this order that DON'T store ainur_id (pre-v7)
    const itemsWithoutAid = pendingOrders?.flatMap((o) =>
      (o.items as OrderItem[]).filter((i) => !i.ainur_id && i.product_id).map((i) => i.product_id)
    ) ?? [];

    const available = ainurStock !== null ? Math.max(0, ainurStock - lockedQty) : product.count;

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        ainur_id: product.ainur_id,
        supabaseCount: product.count,
      },
      ainurStock,
      lockedQty,
      available,
      pendingOrdersTotal: pendingOrders?.length ?? 0,
      ordersWithLock,
      itemsMissingAinurId: [...new Set(itemsWithoutAid)],
    });
  } catch (err) {
    console.error("[/api/debug/locked] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
