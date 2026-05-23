import type { OrderItem, CartItem } from "@/types";
import { GENDER_LABELS } from "@/lib/utils";

export interface OrderItemDetail {
  // Short tag with class hint — used both for the badge UI and the PDF/WhatsApp text.
  key: string;
  label: string;
  tone: "category" | "deluxe" | "premium" | "type" | "gender" | "country" | "code";
}

const CATEGORY_NAMES: Record<string, string> = {
  oil: "Масло",
  perfume: "Парфюм",
  accessory: "Аксессуар",
};

export interface OrderItemDetailsOptions {
  // Internal SKU/code is admin-only — never include it in anything the customer sees
  // (cart, checkout, invoice page, PDF, WhatsApp). Admin pages opt in explicitly.
  includeCode?: boolean;
}

/**
 * Build the list of descriptor chips for a product item that ended up in an order
 * (or is sitting in the cart). Returns the same details that the catalog card
 * shows — category, quality, gender, country (+ code on admin) — as plain data
 * so it can be rendered to HTML, the PDF or a WhatsApp message uniformly.
 */
export function getOrderItemDetails(
  item: OrderItem | CartItem,
  options: OrderItemDetailsOptions = {},
): OrderItemDetail[] {
  const out: OrderItemDetail[] = [];

  const categoryName = CATEGORY_NAMES[item.category];
  if (categoryName) {
    out.push({ key: "category", label: categoryName, tone: "category" });
  }

  const attrs = item.attributes ?? null;
  const quality = attrs?.quality as string | undefined;
  if (quality === "De Luxe") out.push({ key: "deluxe", label: "De Luxe", tone: "deluxe" });
  else if (quality === "Premium") out.push({ key: "premium", label: "Premium", tone: "premium" });

  const accessoryType = attrs?.type as string | undefined;
  if (item.category === "accessory" && accessoryType) {
    out.push({ key: "type", label: String(accessoryType), tone: "type" });
  }

  const gender = (attrs?.gender as string | undefined) ?? item.gender ?? undefined;
  if (gender && GENDER_LABELS[gender]) {
    out.push({ key: "gender", label: GENDER_LABELS[gender], tone: "gender" });
  }

  if (item.country_of_origin) {
    out.push({ key: "country", label: item.country_of_origin, tone: "country" });
  }

  if (options.includeCode && item.code) {
    out.push({ key: "code", label: item.code, tone: "code" });
  }

  return out;
}

// Plain-text rendering ("Парфюм · De Luxe · Мужской · Франция · код: 00655")
// used by the PDF generator and WhatsApp message. Code is admin-only.
export function formatOrderItemDetails(
  item: OrderItem | CartItem,
  options: OrderItemDetailsOptions = {},
): string {
  return getOrderItemDetails(item, options)
    .map((d) => (d.tone === "code" ? `код: ${d.label}` : d.label))
    .join(" · ");
}
