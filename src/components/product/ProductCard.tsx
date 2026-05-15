"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatPrice, formatPricePerUnit, UNIT_LABELS } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { Product } from "@/types";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

type ProductCardVariant = "grid" | "list";

export default function ProductCard({
  product,
  variant = "grid",
}: {
  product: Product;
  variant?: ProductCardVariant;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [imageError, setImageError] = useState(false);
  const productCount = Number(product.count ?? 0);
  const isAvailable = productCount > 0;
  const isList = variant === "list";
  const isMl = product.unit === "ml";

  const cardClassName = [
    "product-card",
    `product-card--${variant}`,
    variant === "grid" ? "product-card--compact" : "product-list-item",
    !isAvailable ? "is-unavailable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setImageError(false);
  }, [product.image_url]);

  const handleAddAccessory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable || isMl) return;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      volume_ml: product.volume_ml,
      image_url: product.image_url,
      count: productCount,
      unit: product.unit ?? "pcs",
      category: product.category ?? "accessory",
    });
    toast.success(`${product.name} добавлен в корзину`);
  };

  const availabilityText = isAvailable
    ? `В наличии: ${productCount} ${UNIT_LABELS[product.unit ?? "pcs"]}`
    : "Нет в наличии";

  const priceDisplay = isMl
    ? formatPricePerUnit(product.price, "ml")
    : formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id}`}
      className={`product-card-link product-card-link--${variant}`}
    >
      <article className={cardClassName}>
        {/* Image block */}
        <div
          className={
            isList
              ? "product-list-media product-card-media product-card-image"
              : "product-card-media product-card-image"
          }
        >
          {product.image_url && !imageError ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="product-card-img"
              sizes={
                isList
                  ? "(max-width: 767px) 104px, 170px"
                  : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
              }
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
            {!isAvailable && (
              <span className="badge badge-danger">Нет в наличии</span>
            )}
          </div>

          {/* Quick-add only for accessories in grid view */}
          {isAvailable && !isList && !isMl && (
            <button
              onClick={handleAddAccessory}
              className="product-quick-add"
              aria-label="В корзину"
            >
              <ShoppingBag size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        {isList ? (
          <>
            <div className="product-list-content">
              <div className="product-list-main">
                <p className="product-brand">{product.brand}</p>
                <h3 className="product-title">{product.name}</h3>
              </div>
              <div className="product-list-meta">
                <span className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
                  {availabilityText}
                </span>
              </div>
            </div>

            <div className="product-list-actions">
              <p className="price">{priceDisplay}</p>
              {isMl ? (
                <Link
                  href={`/product/${product.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`btn btn-primary product-card-action-button ${!isAvailable ? "is-disabled" : ""}`}
                  aria-disabled={!isAvailable}
                >
                  Выбрать объём
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleAddAccessory}
                  disabled={!isAvailable}
                  className="btn btn-primary product-card-action-button"
                >
                  <ShoppingBag size={16} />
                  {isAvailable ? "В корзину" : "Нет в наличии"}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="product-card-body">
            <p className="product-brand">{product.brand}</p>
            <h3 className="product-title">{product.name}</h3>
            <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
              {availabilityText}
            </p>
            <p className="price">{priceDisplay}</p>
          </div>
        )}
      </article>
    </Link>
  );
}
