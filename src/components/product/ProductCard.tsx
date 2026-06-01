"use client";

import Link from "next/link";
import { Check, ShoppingBag, Trash2 } from "lucide-react";
import { formatPriceUsd, formatPricePerUnit, getProductPrice, isKztPriced } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { Product } from "@/types";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { COUNTRY_CODES } from "@/lib/countries";
import QuantityControls from "@/components/ui/QuantityControls";

type ProductCardVariant = "grid" | "list";

const LIMIT_TOAST_ID = "stock-limit";

function notifyLimit(productName: string) {
  toast.error(`Превышен лимит запаса: ${productName}`, { id: LIMIT_TOAST_ID });
}

export default function ProductCard({
  product,
  variant = "grid",
}: {
  product: Product;
  variant?: ProductCardVariant;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const [imageError, setImageError] = useState(false);

  const cartItem = cartItems.find((i) => i.product_id === product.id);
  const isInCart = !!cartItem;
  const productCount = Number(product.count ?? 0);
  const isAvailable = productCount > 0;
  const isList = variant === "list";
  const isMl = product.unit === "ml";
  const minVolume = product.min_volume ?? 1;
  const priceUsd = getProductPrice(product);

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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAdd = (e: React.MouseEvent) => {
    stop(e);
    if (!isAvailable) return;
    const qty = isMl ? Math.min(minVolume, productCount) : 1;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: priceUsd,
      volume_ml: isMl ? qty : product.volume_ml,
      image_url: product.image_url,
      image_thumb_url: product.image_thumb_url ?? null,
      count: productCount,
      unit: product.unit ?? "pcs",
      category: product.category ?? "accessory",
      quantity: qty,
      attributes: product.attributes ?? null,
      gender: product.gender ?? null,
      country_of_origin: product.country_of_origin ?? null,
      code: product.code ?? null,
    });
    toast.success(`${product.name} добавлен в корзину`);
  };

  const priceDisplay = isMl
    ? formatPricePerUnit(priceUsd, "ml", kztRate)
    : isKztPriced(product.category)
    ? formatKzt(priceUsd)
    : formatPriceUsd(priceUsd, kztRate);

  const countryCode = product.country_of_origin
    ? COUNTRY_CODES[product.country_of_origin] ?? null
    : null;

  const categoryLabel =
    product.category === "oil" ? "Масло"
    : product.category === "perfume" ? "Парфюм"
    : null;

  const availabilityText = isAvailable ? "В наличии" : "Нет в наличии";

  const renderCartControls = () => {
    if (!isAvailable) {
      return (
        <button
          type="button"
          disabled
          className="btn btn-secondary product-card-action-button"
        >
          Нет в наличии
        </button>
      );
    }

    if (!isInCart) {
      return (
        <button
          type="button"
          onClick={handleAdd}
          className="btn btn-primary product-card-action-button"
        >
          <ShoppingBag size={16} />
          В корзину
        </button>
      );
    }

    return (
      <div className="card-cart-controls-wrap" onClick={stop}>
        <QuantityControls
          value={cartItem.quantity}
          min={1}
          max={productCount}
          unit={product.unit ?? "pcs"}
          onChange={(v) => updateQuantity(product.id, v)}
          onDecrementBelowMin={() => removeItem(product.id)}
          onLimitExceeded={() => notifyLimit(product.name)}
          size="sm"
          className="card-cart-controls"
        />
        <button
          type="button"
          onClick={(e) => { stop(e); removeItem(product.id); }}
          className="icon-button card-cart-remove"
          aria-label="Удалить из корзины"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_thumb_url ?? product.image_url ?? ""}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="product-card-img"
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
          </div>

          {countryCode && !isList && (
            <div className="product-card-country" title={product.country_of_origin ?? ""}>
              {countryCode}
            </div>
          )}

          {isInCart && (
            <div className="product-card-incart-pill" aria-label="В корзине">
              <Check size={14} />
            </div>
          )}
        </div>

        {isList ? (
          <>
            <div className="product-list-content">
              <div className="product-list-main">
                <div className="product-list-brand-row">
                  {product.category !== "accessory" && <p className="product-brand">{product.brand}</p>}
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
              {renderCartControls()}
            </div>
          </>
        ) : (
          <div className="product-card-body">
            {product.category !== "accessory" && <p className="product-brand">{product.brand}</p>}
            <h3 className="product-title">{product.name}</h3>
            {categoryLabel && (
              <p className="product-category-label">{categoryLabel}</p>
            )}
            <p className={`product-availability ${isAvailable ? "" : "is-empty"}`}>
              {availabilityText}
            </p>
            <p className="price">{priceDisplay}</p>
            <div className="product-card-cart-row">
              {renderCartControls()}
            </div>
          </div>
        )}
      </article>
    </Link>
  );
}
