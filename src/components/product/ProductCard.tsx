"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { Product } from "@/types";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const [imageError, setImageError] = useState(false);
  const productCount = Number(product.count ?? 0);
  const isAvailable = productCount > 0;

  useEffect(() => {
    setImageError(false);
  }, [product.image_url]);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) return;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      volume_ml: product.volume_ml,
      image_url: product.image_url,
      count: productCount,
    });
    toast.success(`${product.name} добавлен в корзину`);
  };

  return (
    <Link href={`/product/${product.id}`} className="product-card-link">
      <article className="product-card">
        <div className="product-card-image">
          {product.image_url && !imageError ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="product-card-img"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="image-placeholder">
              <div>
                <ShoppingBag size={42} strokeWidth={1.2} />
                <span>Aura Parfum</span>
              </div>
            </div>
          )}

          <div className="product-card-badges">
            {product.is_featured && <span className="badge">Хит</span>}
            {!isAvailable && <span className="badge badge-danger">Нет в наличии</span>}
          </div>

          {isAvailable && (
            <button
              onClick={handleAdd}
              className="product-quick-add"
              aria-label="В корзину"
            >
              <ShoppingBag size={18} />
            </button>
          )}
        </div>

        <div className="product-card-body">
          <p className="product-brand">{product.brand}</p>
          <h3 className="product-title">{product.name}</h3>
          <p className="product-meta">{product.volume_ml ? `${product.volume_ml} мл` : ""}</p>
          <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
            {isAvailable ? `В наличии: ${productCount} шт.` : "Нет в наличии"}
          </p>
          <p className="price">{formatPrice(product.price)}</p>
        </div>
      </article>
    </Link>
  );
}
