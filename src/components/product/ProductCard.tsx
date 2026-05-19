"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { formatPriceUsd, formatPricePerUnit, getProductPrice, UNIT_LABELS } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { Product } from "@/types";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { COUNTRY_CODES } from "@/lib/countries";
import { useRouter } from "next/navigation";

type ProductCardVariant = "grid" | "list";

export default function ProductCard({
  product,
  variant = "grid",
}: {
  product: Product;
  variant?: ProductCardVariant;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const isInCart = cartItems.some((i) => i.product_id === product.id);
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
    if (isInCart) {
      router.push("/cart");
      return;
    }
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: priceUsd,
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

  const priceUsd = getProductPrice(product);
  const priceDisplay = isMl
    ? formatPricePerUnit(priceUsd, "ml", kztRate)
    : formatPriceUsd(priceUsd, kztRate);

  const countryCode = product.country_of_origin
    ? COUNTRY_CODES[product.country_of_origin] ?? null
    : null;

  const categoryLabel =
    product.category === "oil" ? "Масло"
    : product.category === "perfume" ? "Парфюм"
    : null;

  return (
    <Link
      href={`/product/${product.id}`}
      className={`product-card-link product-card-link--${variant}`}
    >
      <article className={cardClassName}>
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
                <span>AZ-ZAHRA</span>
              </div>
            </div>
          )}

          <div className="product-card-badges">
            {product.is_featured && <span className="badge">Хит</span>}
            {!isList && product.category !== "accessory" && product.attributes?.quality === "De Luxe" && (
              <span className="badge badge-deluxe">De Luxe</span>
            )}
            {!isList && product.category !== "accessory" && product.attributes?.quality === "Premium" && (
              <span className="badge badge-premium">Premium</span>
            )}
            {!isList && product.category === "accessory" && product.attributes?.type && (
              <span className="badge badge-muted">{String(product.attributes.type)}</span>
            )}
            {!isAvailable && (
              <span className="badge badge-danger">Нет в наличии</span>
            )}
          </div>

          {countryCode && !isList && (
            <div className="product-card-country" title={product.country_of_origin ?? ""}>
              {countryCode}
            </div>
          )}

          {isAvailable && !isList && !isMl && (
            <button
              onClick={handleAddAccessory}
              className={`product-quick-add${isInCart ? " is-in-cart" : ""}`}
              aria-label={isInCart ? "Перейти в корзину" : "В корзину"}
            >
              {isInCart ? <Check size={18} /> : <ShoppingBag size={18} />}
            </button>
          )}
        </div>

        {isList ? (
          <>
            <div className="product-list-content">
              <div className="product-list-main">
                <div className="product-list-brand-row">
                  <p className="product-brand">{product.brand}</p>
                  <div className="product-list-inline-badges">
                    {product.category !== "accessory" && product.attributes?.quality === "De Luxe" && (
                      <span className="badge badge-deluxe">De Luxe</span>
                    )}
                    {product.category !== "accessory" && product.attributes?.quality === "Premium" && (
                      <span className="badge badge-premium">Premium</span>
                    )}
                    {product.category === "accessory" && product.attributes?.type && (
                      <span className="badge badge-muted">{String(product.attributes.type)}</span>
                    )}
                    {countryCode && (
                      <span className="badge-country-round" title={product.country_of_origin ?? ""}>{countryCode}</span>
                    )}
                  </div>
                </div>
                <h3 className="product-title">{product.name}</h3>
                {categoryLabel && (
                  <p className="product-category-label">{categoryLabel}</p>
                )}
              </div>
              <div className="product-list-meta">
                <span className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
                  {availabilityText}
                </span>
              </div>
            </div>

            <div className="product-list-actions">
              <div>
                <p className="price">{priceDisplay}</p>
              </div>
              {isMl && isInCart ? (
                <Link
                  href="/cart"
                  onClick={(e) => e.stopPropagation()}
                  className="btn product-card-action-button product-card-in-cart-btn"
                >
                  <Check size={16} />
                  В корзине
                </Link>
              ) : isMl ? (
                <Link
                  href={`/product/${product.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`btn btn-primary product-card-action-button ${!isAvailable ? "is-disabled" : ""}`}
                  aria-disabled={!isAvailable}
                >
                  Выбрать объём
                </Link>
              ) : isInCart ? (
                <Link
                  href="/cart"
                  onClick={(e) => e.stopPropagation()}
                  className="btn product-card-action-button product-card-in-cart-btn"
                >
                  <Check size={16} />
                  В корзине
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
            {categoryLabel && (
              <p className="product-category-label">{categoryLabel}</p>
            )}
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
