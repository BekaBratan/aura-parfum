"use client";

import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart = useCartStore((s) => s.clearCart);
  const [mounted, setMounted] = useState(false);
  const hasInvalidStock = Array.from(
    items.reduce((acc, item) => {
      const current = acc.get(item.product_id) || { quantity: 0, count: Number(item.count ?? 0) };
      current.quantity += Number(item.quantity);
      current.count = Number(item.count ?? current.count);
      acc.set(item.product_id, current);
      return acc;
    }, new Map<string, { quantity: number; count: number }>()).values()
  ).some((item) => item.count <= 0 || item.quantity > item.count);

  useEffect(() => {
    setMounted(true);
  }, []);

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
                  {item.volume_ml && <p className="product-meta">{item.volume_ml} мл</p>}
                  <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
                    {isAvailable ? `В наличии: ${availableCount} шт.` : "Нет в наличии"}
                  </p>
                </div>

                <div className="quantity-control">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="icon-button"
                    aria-label="Уменьшить количество"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="quantity-value">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    disabled={!canIncrement}
                    className="icon-button"
                    aria-label="Увеличить количество"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="cart-line-total">
                  <p className="price">{formatPrice(item.price * item.quantity)}</p>
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
            <span className="summary-total">{formatPrice(totalPrice())}</span>
          </div>

          {hasInvalidStock ? (
            <button type="button" disabled className="btn btn-secondary cart-checkout">
              Нет в наличии
            </button>
          ) : (
            <Link href="/checkout" className="btn btn-primary cart-checkout">
              Оформить заказ <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
