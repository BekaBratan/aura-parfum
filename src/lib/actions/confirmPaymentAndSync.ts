"use server";

import { createClient } from "@/lib/supabase/server";
import { createAinurSale, DEFAULT_STORE_ID } from "@/lib/ainur/client";
import type { Order } from "@/types";

function formatAinurDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export async function confirmPaymentAndSync(
  orderId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) return { error: "Заказ не найден" };

  const typed = order as unknown as Order;

  if (typed.payment_status !== "pending_payment") {
    return { error: "Заказ уже оплачен или отменён" };
  }

  const now = formatAinurDate(new Date());
  const storeId = process.env.AINUR_STORE_ID || DEFAULT_STORE_ID;
  const customerId = process.env.AINUR_CUSTOMER_ID || "";

  const totalKzt = Number(typed.total_display_currency ?? 0);
  const totalUsd = Number(typed.total_usd ?? 0);
  const kztRate = totalUsd > 0 ? totalKzt / totalUsd : 0;

  const ainurItems = typed.items
    .filter((item) => item.ainur_id)
    .map((item) => {
      const unitPriceKzt = kztRate > 0 ? Math.round(item.price_usd * kztRate) : 0;
      const lineDiscount = Number(item.discount_kzt ?? 0);
      const discountPerUnit = lineDiscount > 0 && item.quantity > 0 ? Math.round(lineDiscount / item.quantity) : 0;
      return {
        product_id: item.ainur_id!,
        quantity: item.quantity,
        discount_percent: 0,
        unit: item.unit === "ml" ? "ml" : "pcs",
        price: unitPriceKzt - discountPerUnit,
      };
    });

  if (ainurItems.length === 0) {
    return { error: "В заказе нет товаров, привязанных к AinurPOS" };
  }

  try {
    await createAinurSale({
      status: true,
      store_id: storeId,
      customer_id: customerId,
      date: now,
      discount_percent: 0,
      discount_sum: Number(typed.discount_kzt ?? 0),
      products: ainurItems,
      payment_details: {
        sum: Number(typed.total_display_currency ?? 0),
        type: "debit",
        status: true,
        date: now,
      },
      comment: `Заказ ${typed.invoice_number} — ${typed.customer_name}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return { error: `Ошибка синхронизации с AinurPOS: ${message}` };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId);

  if (updateError) {
    return { error: `Статус в AinurPOS обновлён, но не удалось обновить Supabase: ${updateError.message}` };
  }

  return { success: true };
}
