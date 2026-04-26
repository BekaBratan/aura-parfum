"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { Product } from "@/types";
import toast from "react-hot-toast";

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.in_stock) return;
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

  return (
    <Link href={`/product/${product.id}`} className="group block">
      <div className="glass-card overflow-hidden transition-all duration-500 hover:border-[var(--gold)]/40 hover:shadow-xl hover:shadow-[var(--gold)]/5 hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[3/4] bg-[var(--dark-3)] overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
              <ShoppingBag size={48} strokeWidth={1} />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.is_featured && <span className="badge-gold">Хит</span>}
            {!product.in_stock && (
              <span className="text-[10px] font-bold uppercase bg-red-600/90 text-white px-2 py-0.5 rounded-full">
                Нет в наличии
              </span>
            )}
          </div>

          {/* Quick add */}
          {product.in_stock && (
            <button
              onClick={handleAdd}
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[var(--gold)] text-[var(--dark)] flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-110 cursor-pointer"
              aria-label="В корзину"
            >
              <ShoppingBag size={18} />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--gold)] mb-1">
            {product.brand}
          </p>
          <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight mb-1 group-hover:text-[var(--gold-light)] transition-colors">
            {product.name}
          </h3>
          {product.volume_ml && (
            <p className="text-[11px] text-[var(--text-secondary)] mb-2">
              {product.volume_ml} мл
            </p>
          )}
          <p className="text-base font-semibold text-[var(--gold)]">
            {formatPrice(product.price)}
          </p>
        </div>
      </div>
    </Link>
  );
}
