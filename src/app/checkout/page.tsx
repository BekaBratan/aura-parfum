"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPriceUsd, UNIT_LABELS, itemPriceKzt, isKztPriced } from "@/lib/utils";
import { getOrderItemDetails } from "@/lib/orderItemDetails";
import { useStoreDiscounts } from "@/lib/useDiscounts";
import { calculateDiscounts } from "@/lib/discounts";
import { formatKzt } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { CartProductSnapshot, useCartStore } from "@/store/cartStore";
import { CartItem, Order, Product } from "@/types";
import { applyStockOverlay, fetchAinurStockMap } from "@/lib/ainur/stockOverlay";
import { validateAinurStock } from "@/lib/actions/validateAinurStock";
import { createOrderCheckout } from "@/lib/actions/createOrderCheckout";

type StockIssue = {
  item: CartItem;
  availableCount: number;
  reason: "out_of_stock" | "over_limit" | "below_min";
};

function getFirstStockIssue(items: CartItem[]): StockIssue | null {
  for (const item of items) {
    const quantity = Number(item.quantity);
    const availableCount = Number(item.count ?? 0);
    const lowerBound = item.min_volume ?? 1;

    if (Number.isNaN(quantity) || quantity <= 0 || availableCount <= 0) {
      return { item, availableCount, reason: "out_of_stock" };
    }
    if (quantity > availableCount) {
      return { item, availableCount, reason: "over_limit" };
    }
    if (item.unit === "ml" && quantity < lowerBound) {
      return { item, availableCount, reason: "below_min" };
    }
  }

  return null;
}

function getStockIssueMessage(issue: StockIssue) {
  if (issue.reason === "out_of_stock") {
    return `Товар закончился: ${issue.item.name}. Удалите его из корзины.`;
  }
  if (issue.reason === "below_min") {
    return `Минимальный объём заказа — ${issue.item.min_volume ?? 1} мл: ${issue.item.name}. Увеличьте количество в корзине.`;
  }
  return `Превышен лимит запаса: ${issue.item.name}. Уменьшите количество в корзине.`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalUsd = useCartStore((s) => s.totalUsd);
  const totalKzt = useCartStore((s) => s.totalKzt);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const clearCart = useCartStore((s) => s.clearCart);
  const syncItemsWithProducts = useCartStore((s) => s.syncItemsWithProducts);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingStock, setRefreshingStock] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_city: "",
    customer_address: "",
    comment: "",
  });
  const productIdsKey = useMemo(
    () => [...new Set(items.map((item) => item.product_id))].sort().join(","),
    [items]
  );
  const stockIssue = useMemo(() => getFirstStockIssue(items), [items]);

  const refreshCartProducts = useCallback(async ({ showToast = false } = {}) => {
    const currentItems = useCartStore.getState().items;
    const productIds = [...new Set(currentItems.map((item) => item.product_id))];
    if (productIds.length === 0) return currentItems;

    setRefreshingStock(true);

    try {
      const supabase = createClient();
      const [{ data, error }, stockMap] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, price_usd, volume_ml, image_url, image_thumb_url, count, unit, category, attributes, gender, country_of_origin, code, ainur_id, min_volume")
          .in("id", productIds),
        fetchAinurStockMap().catch(() => null),
      ]);

      if (error || !data) {
        console.error("Checkout stock refresh failed:", error);
        return currentItems;
      }

      const fresh = data as Product[];
      const overlaid = stockMap ? applyStockOverlay(fresh, stockMap) : fresh;

      const snapshots: CartProductSnapshot[] = overlaid.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price_usd: Number(p.price_usd),
        volume_ml: p.volume_ml,
        image_url: p.image_url,
        image_thumb_url: p.image_thumb_url ?? null,
        count: Number(p.count ?? 0),
        unit: p.unit,
        category: p.category,
        attributes: p.attributes ?? null,
        gender: p.gender ?? null,
        country_of_origin: p.country_of_origin ?? null,
        code: p.code ?? null,
        ainur_id: p.ainur_id ?? null,
        min_volume: p.min_volume ?? null,
      }));

      syncItemsWithProducts(snapshots);

      if (showToast) {
        toast.success("Остатки обновлены");
      }

      return useCartStore.getState().items;
    } finally {
      setRefreshingStock(false);
    }
  }, [syncItemsWithProducts]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted || !productIdsKey) return;

    void refreshCartProducts();
  }, [mounted, productIdsKey, refreshCartProducts]);

  const { discounts, isClient, discountPercent } = useStoreDiscounts();
  const discountResult = useMemo(
    () =>
      calculateDiscounts(items, discounts, kztRate, new Date(), {
        isClient,
        personalPercent: discountPercent,
      }),
    [items, discounts, kztRate, isClient, discountPercent],
  );
  const lineByProductId = useMemo(
    () => new Map(discountResult.lines.map((l) => [l.product_id, l])),
    [discountResult.lines],
  );
  const ruleNameById = useMemo(
    () => new Map(discountResult.applied.map((a) => [a.discount_id, a.name])),
    [discountResult.applied],
  );

  // Personal client discount is computed by the engine (hybrid): масло/парфюм
  // lines take only the personal discount, other lines take general rules.
  // Server stays the source of truth for the totals.

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <div className="empty-icon">
            <ShoppingBag size={34} />
          </div>
          <h1 className="section-title">Корзина пуста</h1>
          <Link href="/catalog" className="btn btn-primary">
            Продолжить покупки
          </Link>
        </div>
      </div>
    );
  }

  const formatPhone = (raw: string): string => {
    // Keep only digits, strip leading 7/8
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let result = "+7";
    if (digits.length > 0) result += " (" + digits.slice(0, 3);
    if (digits.length >= 3) result += ") " + digits.slice(3, 6);
    if (digits.length >= 6) result += " " + digits.slice(6, 10);
    return result;
  };

  const isPhoneValid = (phone: string) => phone.replace(/\D/g, "").length === 11;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "customer_phone") {
      setForm((current) => ({ ...current, customer_phone: formatPhone(value) }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customer_name || !form.customer_phone || !form.customer_city || !form.customer_address) {
      toast.error("Заполните обязательные поля");
      return;
    }
    if (!isPhoneValid(form.customer_phone)) {
      toast.error("Введите корректный номер телефона: +7 (XXX) XXX XXXX");
      return;
    }

    setSubmitting(true);

    try {
      const refreshedItems = await refreshCartProducts();
      const currentItems = refreshedItems ?? useCartStore.getState().items;
      const currentStockIssue = getFirstStockIssue(currentItems);

      if (currentStockIssue) {
        toast.error(getStockIssueMessage(currentStockIssue));
        setSubmitting(false);
        return;
      }

      // JIT stock validation: live-check against AinurPOS API before committing the order.
      const jitItems = currentItems.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: Number(item.quantity),
        ainur_id: item.ainur_id ?? null,
      }));
      const jitResult = await validateAinurStock(jitItems);

      if (!jitResult.valid) {
        toast.error(
          `Недостаточно товара: ${jitResult.itemName}. Запрошено: ${jitResult.requested}, доступно: ${jitResult.available}.`,
        );
        await refreshCartProducts();
        setSubmitting(false);
        return;
      }

      // Recompute the discount against the freshest cart (after stock refresh).
      const freshDiscount = calculateDiscounts(
        currentItems,
        discounts,
        kztRate,
        new Date(),
        { isClient, personalPercent: discountPercent },
      );
      const lineById = new Map(freshDiscount.lines.map((l) => [l.product_id, l]));
      const ruleNameById = new Map(freshDiscount.applied.map((a) => [a.discount_id, a.name]));

      const orderItems = currentItems.map((item) => {
        const line = lineById.get(item.product_id);
        // Per-line discount is sent only for general rule lines — the client's
        // personal discount is re-derived server-side from the session.
        const ruleId = line && !line.personalApplied ? line.appliedDiscountId ?? null : null;
        const ruleName = ruleId ? ruleNameById.get(ruleId) ?? null : null;
        const ruleDiscountKzt =
          line && !line.personalApplied && line.discountKzt > 0
            ? Math.round(line.discountKzt * 100) / 100
            : null;
        return {
          product_id: item.product_id,
          name: item.name,
          brand: item.brand,
          price_usd: isKztPriced(item.category)
            ? Number(item.price_usd) / kztRate
            : Number(item.price_usd),
          quantity: Number(item.quantity),
          volume_ml: item.volume_ml,
          image_url: item.image_url,
          ainur_id: item.ainur_id ?? null,
          discount_kzt: ruleDiscountKzt,
          applied_discount_name: ruleDiscountKzt ? ruleName : null,
        };
      });

      const result = await createOrderCheckout({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_city: form.customer_city,
        customer_address: form.customer_address,
        comment: form.comment || null,
        kztRate,
        discountKzt: freshDiscount.discountKzt,
        appliedDiscounts: freshDiscount.applied,
        items: orderItems,
      });

      if (!result.ok) {
        toast.error(result.error || "Не удалось создать заказ");
        await refreshCartProducts();
        setSubmitting(false);
        return;
      }

      const createdOrderId = result.orderId;

      // Fetch full order for WhatsApp message
      const supabase = createClient();
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", createdOrderId)
        .single();

      const fullOrder = orderData as Order | null;

      toast.success("Заказ создан!");
      router.push(`/invoice/${createdOrderId}`);
      setTimeout(() => clearCart(), 50);
    } catch {
      toast.error("Что-то пошло не так");
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout-layout">
      <div className="site-container">
        <Link href="/cart" className="back-link">
          <ArrowLeft size={16} /> Назад в корзину
        </Link>

        <div className="checkout-header">
          <div>
            <p className="eyebrow">Финальный шаг</p>
            <h1 className="section-title">Оформление заказа</h1>
          </div>
        </div>

        <div className="checkout-grid">
          <form onSubmit={handleSubmit} className="card checkout-form">
            {[
              { name: "customer_name", label: "Имя *", placeholder: "Ваше имя", type: "text" },
              { name: "customer_city", label: "Город *", placeholder: "Алматы", type: "text" },
              { name: "customer_address", label: "Адрес доставки *", placeholder: "Улица, дом, квартира", type: "text" },
            ].map((field) => (
              <label key={field.name} className="form-field">
                <span className="form-label">{field.label}</span>
                <input
                  type={field.type}
                  name={field.name}
                  value={form[field.name as keyof typeof form]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="input"
                  required
                />
              </label>
            ))}

            <label className="form-field">
              <span className="form-label">Телефон *</span>
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="+7 (777) 777 7777"
                className={`input ${form.customer_phone && !isPhoneValid(form.customer_phone) ? "border-[var(--color-danger)]" : ""}`}
                required
              />
              {form.customer_phone && !isPhoneValid(form.customer_phone) && (
                <span style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 4, display: "block" }}>
                  Введите номер полностью: +7 (XXX) XXX XXXX
                </span>
              )}
            </label>

            <label className="form-field">
              <span className="form-label">Комментарий</span>
              <textarea
                name="comment"
                value={form.comment}
                onChange={handleChange}
                placeholder="Дополнительные детали..."
                rows={3}
                className="textarea"
              />
            </label>

            {stockIssue && (
              <p className="product-availability is-empty">{getStockIssueMessage(stockIssue)}</p>
            )}

            <button
              type="submit"
              disabled={submitting || refreshingStock || Boolean(stockIssue)}
              className="btn btn-primary"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {stockIssue
                ? "Проверьте корзину перед оформлением"
                : refreshingStock
                  ? "Обновляем остатки..."
                  : submitting
                    ? "Создаём заказ..."
                    : "Подтвердить данные"}
            </button>
          </form>

          <aside className="card order-summary">
            <h2 className="filter-title">Ваш заказ</h2>
            <div className="order-items">
              {items.map((item) => {
                const unitLabel = UNIT_LABELS[item.unit ?? "pcs"];
                const details = getOrderItemDetails(item);
                const line = lineByProductId.get(item.product_id);
                const baseKzt = itemPriceKzt(item.price_usd, item.category, kztRate) * item.quantity;
                const note = line?.personalApplied
                  ? discountPercent > 0 ? `Скидка клиента (${discountPercent}%)` : null
                  : line?.appliedDiscountId
                    ? `«${ruleNameById.get(line.appliedDiscountId)}»`
                    : null;
                const hasDiscount = line && line.discountKzt > 0;
                return (
                  <div key={item.product_id} className="order-item">
                    <div className="order-item-main">
                      {item.category !== "accessory" && item.brand && (
                        <p className="product-brand">{item.brand}</p>
                      )}
                      <p className="product-title">{item.name}</p>
                      <div className="cart-item-badges">
                        {details.map((d) => (
                          <span
                            key={d.key}
                            className={
                              d.tone === "deluxe"
                                ? "badge badge-deluxe"
                                : d.tone === "premium"
                                ? "badge badge-premium"
                                : "badge badge-muted"
                            }
                          >
                            {d.label}
                          </span>
                        ))}
                      </div>
                      <p className="product-meta">{item.quantity} {unitLabel}</p>
                      {hasDiscount && (
                        <p className="line-discount-note">
                          {note ? `${note} ` : ""}−{formatKzt(line.discountKzt)}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {hasDiscount && (
                        <p className="price-old">{formatKzt(baseKzt)}</p>
                      )}
                      <strong>{formatKzt(hasDiscount ? line.finalKzt : baseKzt)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
            {discountResult.discountKzt > 0 || discountResult.discountSumKzt > 0 ? (
              <>
                <div className="summary-row text-[var(--color-muted)]">
                  <span>Сумма</span>
                  <span>{formatKzt(discountResult.subtotalKzt)}</span>
                </div>
                {discountResult.applied.map((a) => (
                  <div key={a.discount_id} className="summary-row" style={{ color: "var(--color-success)" }}>
                    <span>{a.name}</span>
                    <span>−{formatKzt(a.amount_kzt)}</span>
                  </div>
                ))}
                {discountResult.discountSumKzt > 0 && discountPercent > 0 && (
                  <div className="summary-row" style={{ color: "var(--color-success)" }}>
                    <span>Скидка клиента ({discountPercent}%)</span>
                    <span>−{formatKzt(discountResult.discountSumKzt)}</span>
                  </div>
                )}
              </>
            ) : null}
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">
                {formatKzt(
                  discountResult.discountKzt > 0 || discountResult.discountSumKzt > 0
                    ? discountResult.totalKzt
                    : totalKzt(kztRate)
                )}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
