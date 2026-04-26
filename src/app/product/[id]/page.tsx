"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import {
  ShoppingBag,
  ArrowLeft,
  Check,
  X as XIcon,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(data as Product | null);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleAdd = () => {
    if (!product || !product.in_stock) return;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      volume_ml: product.volume_ml,
      image_url: product.image_url,
    });
    toast.success(`${product.name} добавлен в корзину`);
  };

  if (loading) {
    return (
      <div className="pt-24 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="aspect-square skeleton rounded-2xl" />
          <div className="space-y-4 pt-4">
            <div className="h-4 skeleton w-24" />
            <div className="h-8 skeleton w-3/4" />
            <div className="h-6 skeleton w-32" />
            <div className="h-20 skeleton w-full" />
            <div className="h-12 skeleton w-48 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-24 pb-16 text-center">
        <h1 className="text-2xl text-[var(--text-primary)] mb-4">
          Товар не найден
        </h1>
        <Link href="/catalog" className="text-[var(--gold)] hover:underline">
          ← Вернуться в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Назад в каталог
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-[var(--dark-3)] glass-card">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
                <ShoppingBag size={80} strokeWidth={0.8} />
              </div>
            )}
            {product.is_featured && (
              <span className="absolute top-4 left-4 badge-gold text-xs px-3 py-1">
                Хит продаж
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center">
            <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-2">
              {product.brand}
            </p>

            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-2">
              {product.name}
            </h1>

            {product.volume_ml && (
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                {product.volume_ml} мл
              </p>
            )}

            <p className="text-3xl font-bold text-gold-gradient mb-6">
              {formatPrice(product.price)}
            </p>

            {product.description && (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 max-w-md">
                {product.description}
              </p>
            )}

            {/* Details */}
            <div className="glass-card p-4 space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Пол</span>
                <span className="text-[var(--text-primary)] capitalize">
                  {product.gender === "men"
                    ? "Мужской"
                    : product.gender === "women"
                    ? "Женский"
                    : "Унисекс"}
                </span>
              </div>
              <div className="border-t border-[var(--border)]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Наличие</span>
                {product.in_stock ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <Check size={14} /> В наличии
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400">
                    <XIcon size={14} /> Нет в наличии
                  </span>
                )}
              </div>
            </div>

            {/* Add to cart */}
            <button
              onClick={handleAdd}
              disabled={!product.in_stock}
              className={`flex items-center justify-center gap-2 py-3.5 px-8 rounded-full text-sm font-semibold tracking-wide transition-all cursor-pointer ${
                product.in_stock
                  ? "btn-gold"
                  : "bg-[var(--dark-4)] text-[var(--text-secondary)] cursor-not-allowed"
              }`}
            >
              <ShoppingBag size={18} className="relative z-10" />
              <span>
                {product.in_stock ? "Добавить в корзину" : "Нет в наличии"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
