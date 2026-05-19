"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { CartProductSnapshot, useCartStore } from "@/store/cartStore";
import { formatPriceUsd, UNIT_LABELS, itemPriceKzt } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import MlInput from "@/components/ui/MlInput";
import { CartItem } from "@/types";

type CartStockWarning = {
  productId: string;
  message: string;
};

function getCartStockWarnings(items: CartItem[]): CartStockWarning[] {
  return items.flatMap((item) => {
    const availableCount = Number(item.count ?? 0);
    const quantity = Number(item.quantity);

    const unitLabel = UNIT_LABELS[item.unit ?? "pcs"];

    if (availableCount <= 0) {
      return [{ productId: item.product_id, message: `Товар закончился: ${item.name}` }];
    }

    if (quantity > availableCount) {
      return [
        {
          productId: item.product_id,
          message: `Недостаточно товара: ${item.name}. В корзине: ${quantity} ${unitLabel}, доступно: ${availableCount} ${unitLabel}.`,
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

  const refreshCartProducts = useCallback(
    async ({ showToast = false } = {}) => {
      const currentItems = useCartStore.getState().items;
      const productIds = [...new Set(currentItems.map((item) => item.product_id))];
      if (productIds.length === 0) return;

      setRefreshing(true);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, brand, price_usd, volume_ml, image_url, count, unit, category")
        .in("id", productIds);

      setRefreshing(false);

      if (error || !data) {
        toast.error("Не удалось обновить остатки товаров");
        return;
      }

      const priceById = new Map(currentItems.map((item) => [item.product_id, Number(item.price_usd)]));
      const changedPriceIds = (data as CartProductSnapshot[])
        .filter((product) => priceById.has(product.id) && priceById.get(product.id) !== Number(product.price_usd))
        .map((product) => product.id);

      syncItemsWithProducts(data as CartProductSnapshot[]);
      setPriceUpdatedIds(new Set(changedPriceIds));

      if (showToast) {
        toast.success("Остатки обновлены");
      }
    },
    [syncItemsWithProducts]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !productIdsKey) return;

    void refreshCartProducts();
  }, [mounted, productIdsKey, refreshCartProducts]);

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
        }
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
          <button onClick={clearCart} className="btn btn-ghost">
            <Trash2 size={15} />
            Очистить
          </button>
        </div>

        <div className="cart-list">
          {items.map((item) => {
            const availableCount = Number(item.count ?? 0);
            const isAvailable = availableCount > 0;
            const canIncrement = isAvailable && item.quantity < availableCount;
            const stockWarning = stockWarningsById.get(item.product_id);
            const priceWasUpdated = priceUpdatedIds.has(item.product_id);

            return (
              <article key={item.product_id} className="card cart-item">
                <div className="cart-image">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className="product-card-img"
                      sizes="96px"
                    />
                  ) : (
                    <div className="image-placeholder">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="product-brand">{item.brand}</p>
                  <h3 className="product-title">{item.name}</h3>
                  <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
                    {isAvailable
                      ? `В наличии: ${availableCount} ${UNIT_LABELS[item.unit ?? "pcs"]}`
                      : "Нет в наличии"}
                  </p>
                  {stockWarning && (
                    <p className="product-availability is-empty">{stockWarning}</p>
                  )}
                  {priceWasUpdated && (
                    <p className="product-availability">Цена была обновлена</p>
                  )}
                  {isAvailable && item.quantity > availableCount && (
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product_id, availableCount)}
                      className="btn btn-secondary mt-3 min-h-9 px-3 text-xs"
                    >
                      Уменьшить до доступного количества
                    </button>
                  )}
                </div>

                {item.unit === "ml" ? (
                  <div className="cart-ml-input">
                    <MlInput
                      value={item.quantity}
                      min={1}
                      max={availableCount || undefined}
                      onChange={(v) => updateQuantity(item.product_id, v)}
                      className="input volume-input"
                      aria-label="Объём, мл"
                    />
                    <span className="volume-unit">мл</span>
                  </div>
                ) : (
                  <div className="quantity-control">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="icon-button"
                      aria-label="Уменьшить"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      disabled={!canIncrement}
                      className="icon-button"
                      aria-label="Увеличить"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}

                <div className="cart-line-total">
                  <p className="price">{formatKzt(itemPriceKzt(item.price_usd, item.category, kztRate) * item.quantity)}</p>
                  <button onClick={() => removeItem(item.product_id)} className="btn btn-ghost">
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="card summary-card">
          <div className="summary-row">
            <span>Итого</span>
            <span className="summary-total">{formatKzt(totalKzt(kztRate))}</span>
          </div>

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
            <Link href="/checkout" className="btn btn-primary cart-checkout">
              Оформить заказ <ArrowRight size={16} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => refreshCartProducts({ showToast: true })}
            disabled={refreshing}
            className="btn btn-secondary cart-checkout"
          >
            {refreshing ? "Обновляем..." : "Обновить остатки"}
          </button>
        </div>
      </div>
    </div>
  );
}
