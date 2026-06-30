import type { ProductCategory, ProductUnit } from "@/types";
import { formatKzt, convertToKzt } from "@/lib/currency";

// Categories whose `price_usd` column stores a raw KZT amount (no USD conversion).
// Same list also identifies categories sold by `pcs` rather than `ml`.
export const KZT_PRICED_CATEGORIES: ProductCategory[] = ["accessory", "original", "analog"];

export function isKztPriced(category: string | null | undefined): boolean {
  return KZT_PRICED_CATEGORIES.includes(category as ProductCategory);
}

// For KZT-priced categories `price_usd` already holds KZT; for the rest convert from USD.
export function itemPriceKzt(priceUsd: number, category: string, kztRate: number): number {
  return isKztPriced(category) ? priceUsd : priceUsd * kztRate;
}

// Format a KZT amount (already converted)
export function formatPrice(kztAmount: number): string {
  return formatKzt(kztAmount);
}

// Convert USD → KZT and format. Returns "—" if price is missing (migration pending).
export function formatPriceUsd(priceUsd: number | undefined | null, kztRate: number): string {
  const p = Number(priceUsd);
  if (!isFinite(p) || p < 0) return "—";
  return formatKzt(convertToKzt(p, kztRate || 1));
}

export function formatPricePerUnit(
  priceUsd: number | undefined | null,
  unit: ProductUnit,
  kztRate: number
): string {
  return `${formatPriceUsd(priceUsd, kztRate)} / ${UNIT_LABELS[unit]}`;
}

// Read price from product safely — handles both price_usd (new) and price (legacy pre-migration)
export function getProductPrice(product: { price_usd?: number | null; price?: number | null }): number {
  const usd = Number(product.price_usd);
  if (isFinite(usd) && usd > 0) return usd;
  const legacy = Number((product as { price?: number }).price);
  return isFinite(legacy) ? legacy : 0;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  oil: "Масла",
  perfume: "Парфюм",
  original: "Оригинал",
  analog: "Аналог",
  accessory: "Аксессуары",
};

export const UNIT_LABELS: Record<ProductUnit, string> = {
  ml: "мл",
  pcs: "шт.",
};

export const GENDER_LABELS: Record<string, string> = {
  men: "Мужской",
  women: "Женский",
  unisex: "Унисекс",
};

export const CATEGORY_ORDER: ProductCategory[] = ["oil", "perfume", "original", "analog", "accessory"];

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  shipped: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменен",
};

export function buildWhatsAppMessage(
  invoiceNumber: string,
  items: {
    name: string;
    brand: string;
    quantity: number;
    price: number;
    volume_ml: number | null;
    unit?: ProductUnit;
  }[],
  customer: {
    customer_name: string;
    customer_phone: string;
    customer_city: string;
    customer_address: string;
    comment?: string;
  },
  totalPrice: number,
  paymentStatus = "pending_payment"
): string {
  const lines = [
    "*AZ-ZAHRA invoice*",
    `Invoice: ${invoiceNumber}`,
    `Payment status: ${PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}`,
    "",
    "*Customer:*",
    `Name: ${customer.customer_name}`,
    `Phone: ${customer.customer_phone}`,
    `City: ${customer.customer_city}`,
    `Address: ${customer.customer_address}`,
    "",
    "*Items:*",
    ...items.map((item) => {
      const unitLabel = item.unit === "pcs" ? "шт." : "мл";
      return `- ${item.brand} ${item.name} ${item.quantity} ${unitLabel} = ${formatPrice(item.price * item.quantity)}`;
    }),
    "",
    `*Total:* ${formatPrice(totalPrice)}`,
  ];

  if (customer.comment) {
    lines.push(`Comment: ${customer.comment}`);
  }

  return encodeURIComponent(lines.join("\n"));
}
<<<<<<< HEAD

export function itemKzt(priceUsd: number, category: string | null | undefined, kztRate: number): number {
  return isKztPriced(category) ? priceUsd : priceUsd * kztRate;
}

export function getQtyLabel(quantity: number, volume_ml: number | null, unit?: string | null): string {
  const u = unit ?? (volume_ml ? "ml" : "pcs");
  return u === "ml" ? `${quantity} мл` : `${quantity} шт.`;
}

export function buildInvoiceWhatsAppText(order: Order, siteUrl: string, kztRate: number): string {
  const productLines = order.items.flatMap((item, index) => {
    const brand = item.category !== "accessory" && item.brand ? `${item.brand} ` : "";
    const qty = getQtyLabel(item.quantity, item.volume_ml, item.unit);
    const priceKzt = itemKzt(item.price_usd, item.category, kztRate);
    const details = formatOrderItemDetails(item);
    const baseKzt = priceKzt * item.quantity;
    const discountKzt = Number(item.discount_kzt ?? 0);
    const hasDiscount = discountKzt > 0;
    const finalKzt = Math.max(0, baseKzt - discountKzt);
    const sumText = hasDiscount
      ? `${formatKzt(baseKzt)} → ${formatKzt(finalKzt)}`
      : formatKzt(baseKzt);
    const head = `${index + 1}. ${brand}${item.name} — ${qty} × ${formatKzt(priceKzt)} = ${sumText}`;
    const out: string[] = [head];
    if (details) out.push(`   ${details}`);
    if (hasDiscount) {
      const ruleName = item.applied_discount_name ? `«${item.applied_discount_name}»: ` : "";
      out.push(`   Скидка ${ruleName}−${formatKzt(discountKzt)}`);
    }
    return out;
  });

  const subtotal = order.items.reduce(
    (s, i) => s + itemKzt(i.price_usd, i.category, kztRate) * i.quantity,
    0,
  );
  const discountKzt = Number(order.discount_kzt ?? 0);
  const total = Math.max(0, subtotal - discountKzt);
  const discountLines = discountKzt > 0
    ? [
        `Сумма: ${formatKzt(subtotal)}`,
        ...(order.applied_discounts ?? []).map((a) => `${a.name}: −${formatKzt(a.amount_kzt)}`),
      ]
    : [];

  const lines = [
    "Здравствуйте! Новый заказ AZ-ZAHRA Parfume.",
    "",
    `Накладная № ${order.invoice_number}`,
    `Клиент: ${order.customer_name}`,
    `Телефон: ${order.customer_phone}`,
    `Адрес: ${order.customer_city}, ${order.customer_address}`,
    "",
    "Товары:",
    ...productLines,
    "",
    ...discountLines,
    `Итого: ${formatKzt(total)}`,
    `Статус оплаты: ${PAYMENT_STATUS_LABELS[order.payment_status]}`,
    "",
    "Ссылка на заказ:",
    `${siteUrl}/invoice/${order.id}`,
    "",
    "PDF-накладная:",
    `${siteUrl}/api/invoice/${order.id}/pdf`,
  ];

  return encodeURIComponent(lines.join("\n"));
}
=======
>>>>>>> parent of dd6b687 (redirect checkout to WhatsApp, remove success page, move cancel to WhatsApp)
