import type {
  AppliedDiscountLine,
  CartItem,
  Discount,
  ProductCategory,
} from "@/types";

// ─── Pure utilities ────────────────────────────────────────────────────────

/**
 * Per-line USD subtotal. Accessories store their KZT price in `price_usd`
 * (project quirk), so we divide back by the current rate to compare against
 * USD trigger thresholds.
 */
function lineUsd(item: CartItem, kztRate: number): number {
  if (item.category === "accessory") {
    return kztRate > 0 ? (item.price_usd / kztRate) * item.quantity : 0;
  }
  return item.price_usd * item.quantity;
}

/**
 * Per-line KZT subtotal — the actual amount the customer is paying for that
 * line before any discount. Used both for displaying the discount and for
 * computing percentage cuts.
 */
function lineKzt(item: CartItem, kztRate: number): number {
  if (item.category === "accessory") return item.price_usd * item.quantity;
  return item.price_usd * kztRate * item.quantity;
}

function isWithinValidity(d: Discount, now: Date): boolean {
  if (d.valid_from && new Date(d.valid_from) > now) return false;
  if (d.valid_until && new Date(d.valid_until) < now) return false;
  return true;
}

function triggerMet(d: Discount, items: CartItem[], lineUsds: number[]): boolean {
  switch (d.trigger_type) {
    case "all_cart": {
      const totalUsd = lineUsds.reduce((s, u) => s + u, 0);
      return totalUsd >= (d.trigger_threshold_amount ?? 0);
    }
    case "category_total": {
      const cats = d.trigger_category_ids ?? [];
      if (cats.length === 0) return false;
      let matched = 0;
      items.forEach((it, i) => {
        if (cats.includes(it.category)) matched += lineUsds[i];
      });
      return matched >= (d.trigger_threshold_amount ?? 0);
    }
    case "category_per_product": {
      const cats = d.trigger_category_ids ?? [];
      if (cats.length === 0) return false;
      const threshold = d.trigger_threshold_amount;
      const minQty = d.trigger_min_quantity;
      // Rule fires if at least one cart line in the chosen categories clears
      // every set condition (threshold and/or min qty) on its own.
      // lineMatchesApply re-checks per line so only qualifying lines get the discount.
      return items.some((it, i) => {
        if (!cats.includes(it.category)) return false;
        if (threshold != null && lineUsds[i] < threshold) return false;
        if (minQty != null && it.quantity < minQty) return false;
        return true;
      });
    }
    case "specific_products": {
      const required = d.trigger_product_ids ?? [];
      if (required.length === 0) return false;
      const minQty = d.trigger_min_quantity ?? 1;

      // Each listed product must appear in the cart with qty >= minQty.
      const qtyByProduct = new Map<string, number>();
      const usdByProduct = new Map<string, number>();
      items.forEach((it, i) => {
        if (!required.includes(it.product_id)) return;
        qtyByProduct.set(it.product_id, (qtyByProduct.get(it.product_id) ?? 0) + it.quantity);
        usdByProduct.set(it.product_id, (usdByProduct.get(it.product_id) ?? 0) + lineUsds[i]);
      });
      for (const pid of required) {
        if ((qtyByProduct.get(pid) ?? 0) < minQty) return false;
      }
      // Optional combined-USD threshold across the listed products (AND with qty).
      if (d.trigger_threshold_amount != null) {
        let combined = 0;
        for (const v of usdByProduct.values()) combined += v;
        if (combined < d.trigger_threshold_amount) return false;
      }
      return true;
    }
  }
}

function lineMatchesApply(d: Discount, item: CartItem, lineUsd: number): boolean {
  switch (d.apply_to) {
    case "all_cart":          return true;
    case "category":          return (d.apply_category_ids ?? []).includes(item.category);
    case "trigger_product": {
      if (d.trigger_type === "specific_products") {
        return (d.trigger_product_ids ?? []).includes(item.product_id);
      }
      if (d.trigger_type === "category_per_product") {
        const cats = d.trigger_category_ids ?? [];
        if (!cats.includes(item.category)) return false;
        if (d.trigger_threshold_amount != null && lineUsd < d.trigger_threshold_amount) return false;
        if (d.trigger_min_quantity != null && item.quantity < d.trigger_min_quantity) return false;
        return true;
      }
      return false;
    }
    case "specific_products": return (d.apply_product_ids ?? []).includes(item.product_id);
  }
}

function calcDiscountAmount(d: Discount, baseKzt: number): number {
  if (baseKzt <= 0) return 0;
  if (d.discount_type === "percentage") {
    const pct = Math.min(100, Math.max(0, d.discount_value));
    return Math.round(baseKzt * (pct / 100));
  }
  // fixed: KZT. Cap so the line never goes negative.
  return Math.min(d.discount_value, baseKzt);
}

// ─── Public engine ─────────────────────────────────────────────────────────

export interface DiscountedLine {
  product_id: string;
  baseKzt: number;
  baseUsd: number;
  discountKzt: number;
  finalKzt: number;
  appliedDiscountId: string | null;
}

export interface DiscountResult {
  lines: DiscountedLine[];
  subtotalKzt: number;
  discountKzt: number;
  totalKzt: number;
  applied: AppliedDiscountLine[];
}

const EMPTY_RESULT: DiscountResult = {
  lines: [], subtotalKzt: 0, discountKzt: 0, totalKzt: 0, applied: [],
};

/**
 * Compute discounts for a cart. Pure function — same input → same output.
 *
 * STACKING RULE: discounts do NOT stack on the same cart line. For each
 * line item, the engine picks the single discount that produces the
 * greatest absolute price reduction in KZT. Tie-breaker: the rule with
 * the higher `priority` value wins; remaining ties fall back to id order
 * for deterministic output.
 *
 * Returned amounts:
 *   - `subtotalKzt`: cart total before any discount
 *   - `discountKzt`: sum of all per-line discounts
 *   - `totalKzt`:    `max(0, subtotalKzt - discountKzt)` — never negative
 *   - `applied`:     per-rule aggregate, suitable for storing on the order
 */
export function calculateDiscounts(
  cartItems: CartItem[],
  discounts: Discount[],
  kztRate: number,
  now: Date = new Date(),
): DiscountResult {
  if (cartItems.length === 0) return EMPTY_RESULT;

  const lineUsds = cartItems.map((it) => lineUsd(it, kztRate));
  const lineKzts = cartItems.map((it) => lineKzt(it, kztRate));
  const subtotalKzt = lineKzts.reduce((s, v) => s + v, 0);

  // Active + in window + trigger-condition satisfied.
  const candidates = discounts.filter(
    (d) => d.is_active && isWithinValidity(d, now) && triggerMet(d, cartItems, lineUsds),
  );

  const lines: DiscountedLine[] = cartItems.map((item, i) => {
    const baseKzt = lineKzts[i];
    let best: { d: Discount; amount: number } | null = null;
    for (const d of candidates) {
      if (!lineMatchesApply(d, item, lineUsds[i])) continue;
      const amount = calcDiscountAmount(d, baseKzt);
      if (amount <= 0) continue;
      if (
        !best ||
        amount > best.amount ||
        (amount === best.amount && d.priority > best.d.priority) ||
        (amount === best.amount && d.priority === best.d.priority && d.id < best.d.id)
      ) {
        best = { d, amount };
      }
    }
    if (!best) {
      return {
        product_id: item.product_id,
        baseKzt, baseUsd: lineUsds[i],
        discountKzt: 0, finalKzt: baseKzt,
        appliedDiscountId: null,
      };
    }
    return {
      product_id: item.product_id,
      baseKzt, baseUsd: lineUsds[i],
      discountKzt: best.amount,
      finalKzt: Math.max(0, baseKzt - best.amount),
      appliedDiscountId: best.d.id,
    };
  });

  // Per-rule aggregate snapshot.
  const byRule = new Map<string, AppliedDiscountLine>();
  for (const line of lines) {
    if (!line.appliedDiscountId) continue;
    const d = candidates.find((c) => c.id === line.appliedDiscountId);
    if (!d) continue;
    const existing = byRule.get(d.id);
    if (existing) {
      existing.amount_kzt += line.discountKzt;
    } else {
      byRule.set(d.id, {
        discount_id: d.id,
        name: d.name,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        amount_kzt: line.discountKzt,
        trigger_product_ids: d.trigger_type === "specific_products" ? d.trigger_product_ids : null,
      });
    }
  }
  for (const snap of byRule.values()) snap.amount_kzt = Math.round(snap.amount_kzt);

  const discountKzt = lines.reduce((s, l) => s + l.discountKzt, 0);
  return {
    lines,
    subtotalKzt,
    discountKzt,
    totalKzt: Math.max(0, subtotalKzt - discountKzt),
    applied: [...byRule.values()],
  };
}

// ─── Display helpers (admin list) ──────────────────────────────────────────

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  oil: "Масла", perfume: "Парфюм", accessory: "Аксессуары",
};

export function describeDiscountValue(d: Pick<Discount, "discount_type" | "discount_value">): string {
  return d.discount_type === "percentage"
    ? `${d.discount_value}%`
    : `${Math.round(d.discount_value).toLocaleString("ru-RU")} ₸`;
}

export function describeDiscountTrigger(
  d: Pick<Discount,
    "trigger_type" | "trigger_category_ids" | "trigger_product_ids"
    | "trigger_threshold_amount" | "trigger_min_quantity"
  >,
): string {
  const usd = (n: number | null | undefined) =>
    n != null ? `$${Math.round(n).toLocaleString("ru-RU")}` : null;

  switch (d.trigger_type) {
    case "all_cart": {
      const t = usd(d.trigger_threshold_amount);
      return t ? `Корзина ≥ ${t}` : "Любая корзина";
    }
    case "category_total": {
      const cats = (d.trigger_category_ids ?? []).map((c) => CATEGORY_LABEL[c]).join(", ") || "—";
      const t = usd(d.trigger_threshold_amount);
      return t ? `${cats} ≥ ${t}` : cats;
    }
    case "category_per_product": {
      const cats = (d.trigger_category_ids ?? []).map((c) => CATEGORY_LABEL[c]).join(", ") || "—";
      const parts: string[] = [];
      if (d.trigger_min_quantity != null) parts.push(`≥ ${d.trigger_min_quantity} шт.`);
      const t = usd(d.trigger_threshold_amount);
      if (t) parts.push(`сумма ≥ ${t}`);
      return parts.length === 0
        ? `Каждый товар в ${cats}`
        : `Каждый товар в ${cats}: ${parts.join(", ")}`;
    }
    case "specific_products": {
      const n = (d.trigger_product_ids ?? []).length;
      const parts: string[] = [`${n} товар(ов)`];
      if (d.trigger_min_quantity != null) parts.push(`≥ ${d.trigger_min_quantity} шт. каждого`);
      const t = usd(d.trigger_threshold_amount);
      if (t) parts.push(`сумма ≥ ${t}`);
      return parts.join(", ");
    }
  }
}

export function describeDiscountApply(
  d: Pick<
    Discount,
    "apply_to" | "apply_category_ids" | "apply_product_ids" | "trigger_product_ids" | "trigger_type"
  >,
): string {
  switch (d.apply_to) {
    case "all_cart":          return "Вся корзина";
    case "category":          return (d.apply_category_ids ?? []).map((c) => CATEGORY_LABEL[c]).join(", ") || "Категории";
    case "trigger_product":
      if (d.trigger_type === "category_per_product") return "Товары, прошедшие порог в категории";
      return `Триггерные товары (${(d.trigger_product_ids ?? []).length})`;
    case "specific_products": return `Выбранные товары (${(d.apply_product_ids ?? []).length})`;
  }
}

export function isDiscountExpired(
  d: Pick<Discount, "valid_until">, now: Date = new Date(),
): boolean {
  return d.valid_until != null && new Date(d.valid_until) < now;
}

export function isDiscountPending(
  d: Pick<Discount, "valid_from">, now: Date = new Date(),
): boolean {
  return d.valid_from != null && new Date(d.valid_from) > now;
}
