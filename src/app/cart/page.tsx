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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="pt-24 pb-16 max-w-4xl mx-auto px-4">
        <div className="h-8 skeleton w-48 mb-8" />
        {[1, 2].map((i) => (
          <div key={i} className="h-28 skeleton rounded-2xl mb-4" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pt-24 pb-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[var(--dark-3)] flex items-center justify-center mx-auto mb-6">
            <ShoppingBag size={36} className="text-[var(--text-secondary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Корзина пуста
          </h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Добавьте ароматы из каталога
          </p>
          <Link
            href="/catalog"
            className="btn-gold px-8 py-3 rounded-full text-sm inline-flex items-center gap-2"
          >
            <span>Перейти в каталог</span>
            <ArrowRight size={16} className="relative z-10" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-1">
              Покупки
            </p>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              Корзина
            </h1>
          </div>
          <button
            onClick={clearCart}
            className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Trash2 size={14} />
            Очистить
          </button>
        </div>

        <div className="space-y-4 mb-8">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="glass-card p-4 flex gap-4 items-center animate-fade-in-up"
            >
              {/* Image */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[var(--dark-3)] flex-shrink-0">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
                    <ShoppingBag size={24} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[var(--gold)]">
                  {item.brand}
                </p>
                <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {item.name}
                </h3>
                {item.volume_ml && (
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {item.volume_ml} мл
                  </p>
                )}
                <p className="text-sm font-semibold text-[var(--gold)] mt-1">
                  {formatPrice(item.price)}
                </p>
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity - 1)
                  }
                  className="w-8 h-8 rounded-full bg-[var(--dark-3)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium text-[var(--text-primary)]">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(item.product_id, item.quantity + 1)
                  }
                  className="w-8 h-8 rounded-full bg-[var(--dark-3)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Subtotal + remove */}
              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatPrice(item.price * item.quantity)}
                </p>
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="text-xs text-red-400 hover:text-red-300 mt-1 cursor-pointer"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg text-[var(--text-secondary)]">Итого</span>
            <span className="text-2xl font-bold text-gold-gradient">
              {formatPrice(totalPrice())}
            </span>
          </div>

          <Link
            href="/checkout"
            className="btn-gold w-full py-3.5 rounded-full text-sm font-semibold tracking-wide flex items-center justify-center gap-2"
          >
            <span>Оформить заказ</span>
            <ArrowRight size={16} className="relative z-10" />
          </Link>
        </div>
      </div>
    </div>
  );
}
