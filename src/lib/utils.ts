import type { ProductCategory, ProductUnit } from "@/types";
import { formatKzt, convertToKzt } from "@/lib/currency";

// For accessories price_usd stores raw KZT; for others it's real USD
export function itemPriceKzt(priceUsd: number, category: string, kztRate: number): number {
  return category === "accessory" ? priceUsd : priceUsd * kztRate;
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

export const CATEGORY_ORDER: ProductCategory[] = ["oil", "perfume", "accessory"];

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
