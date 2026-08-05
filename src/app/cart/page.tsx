"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { CartProductSnapshot, useCartStore } from "@/store/cartStore";
import { Product, CartItem } from "@/types";
import { applyStockOverlay, fetchAinurStockMap } from "@/lib/ainur/stockOverlay";
import { itemPriceKzt } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useActiveDiscounts } from "@/lib/useDiscounts";
import { calculateDiscounts } from "@/lib/discounts";
import { useClientDiscount } from "@/lib/useClientDiscount";
import Link from "next/link";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import QuantityControls from "@/components/ui/QuantityControls";
import { useCountryStore, getCountryCode } from "@/store/countryStore";
import { GENDER_LABELS } from "@/lib/utils";

const CATEGORY_NAMES: Record<string, string> = {
  oil: "Масло",
  perfume: "Парфюм",
  original: "Оригинал",
  analog: "Аналог",
  accessory: "Аксессуар",
};

type CartStockWarning = {
  productId: string;
  message: string;
};

function getCartStockWarnings(items: CartItem[]): CartStockWarning[] {
  return items.flatMap((item) => {
    const availableCount = Number(item.count ?? 0);
    const quantity = Number(item.quantity);
    const lowerBound = item.min_volume ?? 1;

    if (availableCount <= 0) {
      return [{ productId: item.product_id, message: `Товар закончился: ${item.name}` }];
    }

    if (quantity > availableCount) {
      return [
        {
          productId: item.product_id,
          message: `Превышен лимит запаса: ${item.name}. Уменьшите количество в корзине.`,
        },
      ];
    }

    if (item.unit === "ml" && availableCount < lowerBound) {
      return [
        {
          productId: item.product_id,
          message: `Недостаточно запаса для минимального объёма ${lowerBound} мл: ${item.name}`,
        },
      ];
    }

    return [];
  });
}

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const totalUsd = useCartStore((s) => s.totalUsd);
  const totalKzt = useCartStore((s) => s.totalKzt);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const countryCodes = useCountryStore((s) => s.codes);
  const clearCart = useCartStore((s) => s.clearCart);
  const syncItemsWithProducts = useCartStore((s) => s.syncItemsWithProducts);
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [priceUpdatedIds, setPriceUpdatedIds] = useState<Set<string>>(new Set());
  const productIdsKey = useMemo(
    () => [...new Set(items.map((item) => item.product_id))].sort().join(","),
    [items]
  );
  const stockWarnings = useMemo(() => getCartStockWarnings(items), [items]);
  const stockWarningsById = useMemo(
    () => new Map(stockWarnings.map((warning) => [warning.productId, warning.message])),
    [stockWarnings]
  );
  const hasInvalidStock = stockWarnings.length > 0;

  const activeDiscounts = useActiveDiscounts();
  const discountResult = useMemo(
    () => calculateDiscounts(items, activeDiscounts, kztRate),
    [items, activeDiscounts, kztRate],
  );
  const lineByProductId = useMemo(
    () => new Map(discountResult.lines.map((l) => [l.product_id, l])),
    [discountResult.lines],
  );
  const ruleNameById = useMemo(
    () => new Map(discountResult.applied.map((a) => [a.discount_id, a.name])),
    [discountResult.applied],
  );

  // Personal client discount — display only. Mirrors the server's GREATEST
  // logic: only the more advantageous of the rule discount and the personal
  // discount is applied; the server is the source of truth for the totals.
  const clientDiscount = useClientDiscount();
  const personalDiscountKzt = useMemo(() => {
    if (clientDiscount.discountPercent <= 0) return 0;
    return Math.round(discountResult.totalKzt * clientDiscount.discountPercent / 100 * 100) / 100;
  }, [clientDiscount.discountPercent, discountResult.totalKzt]);
  const personalWins = personalDiscountKzt > discountResult.discountKzt;
  const summaryTotalKzt = personalWins
    ? Math.max(0, discountResult.totalKzt - personalDiscountKzt)
    : discountResult.totalKzt;

  const MIN_ORDER_KZT = 30000;
  const refreshCartProducts = useCallback(
    async ({ showToast = false } = {}) => {
      const currentItems = useCartStore.getState().items;
      const productIds = [...new Set(currentItems.map((item) => item.product_id))];
      if (productIds.length === 0) return;

      setRefreshing(true);

      const supabase = createClient();
      const [{ data, error }, stockMap] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, price_usd, volume_ml, image_url, image_thumb_url, count, unit, category, attributes, gender, country_of_origin, code, ainur_id, min_volume")
          .in("id", productIds),
        fetchAinurStockMap().catch(() => null),
      ]);

      setRefreshing(false);

      if (error || !data) {
        console.error("Cart stock refresh failed:", error);
        if (showToast) toast.error("Не удалось обновить остатки товаров");
        return;
      }

      const fresh = data as Product[];
      const overlaid = stockMap ? applyStockOverlay(fresh, stockMap) : fresh;

      const priceById = new Map(
        currentItems.map((item) => [item.product_id, Number(item.price_usd)]),
      );
      const changedPriceIds = overlaid
        .filter(
          (product) =>
            priceById.has(product.id) && priceById.get(product.id) !== Number(product.price_usd),
        )
        .map((product) => product.id);

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
      setPriceUpdatedIds(new Set(changedPriceIds));

      if (showToast) toast.success("Остатки обновлены");
    },
    [syncItemsWithProducts],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !productIdsKey) return;
    void refreshCartProducts();
  }, [mounted, productIdsKey, refreshCartProducts]);

  // Realtime: react to admin price/stock updates in Supabase as before.
  useEffect(() => {
    if (!mounted || !productIdsKey) return;

    const supabase = createClient();
    const channel = supabase
      .channel("cart-product-stock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const product = payload.new as CartProductSnapshot;
          const currentItems = useCartStore.getState().items;
          const currentItem = currentItems.find((item) => item.product_id === product.id);
          if (!currentItem) return;
          if (Number(currentItem.price_usd) !== Number(product.price_usd)) {
            setPriceUpdatedIds((current) => new Set(current).add(product.id));
          }
          useCartStore.getState().syncItemsWithProducts([product]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mounted, productIdsKey]);

  if (!mounted) {
    return (
      <div className="cart-layout">
        <div className="site-narrow">
          <div className="skeleton skeleton-line is-medium" />
          <div className="cart-list catalog-results">
            {[1, 2].map((item) => (
              <div key={item} className="card cart-item skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <div className="empty-icon">
            <ShoppingBag size={34} />
          </div>
          <h1 className="section-title">Корзина пуста</h1>
          <p className="section-subtitle">Добавьте ароматы из каталога.</p>
          <Link href="/catalog" className="btn btn-primary">
            Перейти в каталог <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <div className="site-narrow">
        <div className="cart-header">
          <div>
            <p className="eyebrow">Покупки</p>
            <h1 className="section-title">Корзина</h1>
          </div>
          <button
            onClick={() => {
              if (window.confirm("Очистить корзину? Это действие нельзя отменить")) {
                clearCart();
              }
            }}
            className="btn btn-ghost"
          >
            <Trash2 size={15} />
            Очистить
          </button>
        </div>

        <div className="cart-list">
          {items.map((item) => {
            const availableCount = Number(item.count ?? 0);
            const isAvailable = availableCount > 0;
            const stockWarning = stockWarningsById.get(item.product_id);
            const priceWasUpdated = priceUpdatedIds.has(item.product_id);
            const countryCode = getCountryCode(countryCodes, item.country_of_origin);
            const gender = item.gender ?? (item.attributes?.gender as string | undefined);
            const quality = item.attributes?.quality as string | undefined;
            const accessoryType = item.attributes?.type as string | undefined;
            const categoryName = CATEGORY_NAMES[item.category];

            return (
              <article key={item.product_id} className="card cart-item">
                <div className="cart-image">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_thumb_url ?? item.image_url ?? ""}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="product-card-img"
                    />
                  ) : (
                    <div className="image-placeholder">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>

                <div className="cart-item-info">
                  {item.category !== "accessory" && <p className="product-brand">{item.brand}</p>}
                  <h3 className="product-title">{item.name}</h3>
                  <div className="cart-item-badges">
                    {categoryName && (
                      <span className="badge badge-muted">{categoryName}</span>
                    )}
                    {quality === "De Luxe" && (
                      <span className="badge badge-deluxe">De Luxe</span>
                    )}
                    {quality === "Premium" && (
                      <span className="badge badge-premium">Premium</span>
                    )}
                    {accessoryType && (
                      <span className="badge badge-muted">{accessoryType}</span>
                    )}
                    {gender && GENDER_LABELS[gender] && (
                      <span className="badge badge-muted">{GENDER_LABELS[gender]}</span>
                    )}
                    {countryCode && (
                      <span className="badge-country-round" title={item.country_of_origin ?? ""}>
                        {countryCode}
                      </span>
                    )}
                  </div>
                  <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
                    {isAvailable ? "В наличии" : "Нет в наличии"}
                  </p>
                  {stockWarning && (
                    <p className="product-availability is-empty">{stockWarning}</p>
                  )}
                  {priceWasUpdated && (
                    <p className="product-availability">Цена была обновлена</p>
                  )}
                </div>

                <div className="cart-item-qty">
                  <QuantityControls
                    value={item.quantity}
                    min={item.unit === "ml" ? (item.min_volume ?? 1) : 1}
                    max={availableCount || 1}
                    unit={item.unit ?? "pcs"}
                    step={item.unit === "ml" && (item.min_volume ?? 1) >= 1000 ? (item.min_volume ?? 1) : 1}
                    onChange={(v) => updateQuantity(item.product_id, v)}
                    onLimitExceeded={() =>
                      toast.error(`Превышен лимит запаса: ${item.name}`, { id: "stock-limit" })
                    }
                    size="md"
                  />
                </div>

                <div className="cart-line-total">
                  {(() => {
                    const line = lineByProductId.get(item.product_id);
                    const baseKzt = itemPriceKzt(item.price_usd, item.category, kztRate) * item.quantity;
                    if (line && line.discountKzt > 0 && !personalWins) {
                      const ruleName = line.appliedDiscountId
                        ? ruleNameById.get(line.appliedDiscountId)
                        : null;
                      return (
                        <>
                          <p className="price price-old">{formatKzt(baseKzt)}</p>
                          <p className="price">{formatKzt(line.finalKzt)}</p>
                          <p className="line-discount-note">
                            {ruleName ? `«${ruleName}» ` : ""}−{formatKzt(line.discountKzt)}
                          </p>
                        </>
                      );
                    }
                    return <p className="price">{formatKzt(baseKzt)}</p>;
                  })()}
                  <button onClick={() => removeItem(item.product_id)} className="btn btn-ghost">
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="card summary-card">
          {discountResult.discountKzt > 0 && !personalWins ? (
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
              <div className="summary-row">
                <span>Итого</span>
                <span className="summary-total">{formatKzt(discountResult.totalKzt)}</span>
              </div>
            </>
          ) : personalWins ? (
            <>
              <div className="summary-row text-[var(--color-muted)]">
                <span>Сумма</span>
                <span>{formatKzt(discountResult.subtotalKzt)}</span>
              </div>
              <div className="summary-row" style={{ color: "var(--color-success)" }}>
                <span>Скидка клиента ({clientDiscount.discountPercent}%)</span>
                <span>−{formatKzt(personalDiscountKzt)}</span>
              </div>
              <div className="summary-row">
                <span>Итого</span>
                <span className="summary-total">{formatKzt(summaryTotalKzt)}</span>
              </div>
            </>
          ) : (
            <div className="summary-row">
              <span>Итого</span>
              <span className="summary-total">{formatKzt(totalKzt(kztRate))}</span>
            </div>
          )}

          {hasInvalidStock ? (
            <>
              <div className="catalog-results">
                {stockWarnings.map((warning) => (
                  <p key={warning.productId} className="product-availability is-empty">
                    {warning.message}
                  </p>
                ))}
              </div>
              <button type="button" disabled className="btn btn-secondary cart-checkout">
                Проверьте корзину перед оформлением
              </button>
            </>
          ) : (
            <>
              <Link href="/checkout" className="btn btn-primary cart-checkout">
                Оформить заказ <ArrowRight size={16} />
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => refreshCartProducts({ showToast: true })}
            disabled={refreshing}
            className="btn btn-secondary cart-checkout"
          >
            {refreshing ? "Проверяем..." : "Проверить наличие"}
          </button>
        </div>
      </div>
    </div>
  );
}
