"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppliedDiscountLine } from "@/types";

export type CheckoutOrderItem = {
  product_id: string;
  quantity: number;
  ainur_id?: string | null;
  discount_kzt?: number | null;
  applied_discount_name?: string | null;
};

export type CreateOrderCheckoutInput = {
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  comment?: string | null;
  kztRate: number;
  discountKzt: number;
  appliedDiscounts: AppliedDiscountLine[];
  items: CheckoutOrderItem[];
};

// Wraps create_order_with_stock_check. The RPC re-reads product prices and
// stock from the DB and derives the client's personal discount server-side
// from the session (profiles.discount_percent) — the frontend only sends the
// intent (ids + quantities + rule-discount hints), never money values.
export async function createOrderCheckout(
  input: CreateOrderCheckoutInput,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_order_with_stock_check", {
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_city: input.customer_city,
    p_customer_address: input.customer_address,
    p_comment: input.comment || null,
    p_items: input.items,
    p_currency_code: "KZT",
    p_rate_to_usd: input.kztRate,
    p_discount_kzt: input.discountKzt,
    p_applied_discounts: input.appliedDiscounts,
  });

  if (error) return { ok: false, error: error.message };

  const createdOrder = Array.isArray(data) ? data[0] : data;
  if (!createdOrder?.order_id) return { ok: false, error: "Не удалось создать заказ" };

  return { ok: true, orderId: createdOrder.order_id };
}
