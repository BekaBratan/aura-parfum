"use client";

import Link from "next/link";
import { Check, ShoppingBag, Trash2 } from "lucide-react";
import { formatPriceUsd, formatPricePerUnit, getProductPrice, isKztPriced, itemPriceKzt } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { useActiveDiscounts } from "@/lib/useDiscounts";
import { calculateDiscounts } from "@/lib/discounts";
import { Product, CartItem } from "@/types";
import toast from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";
import { useCountryStore, getCountryCode } from "@/store/countryStore";
import { usePresets, getPresetType } from "@/lib/usePresets";
import QuantityControls from "@/components/ui/QuantityControls";

type ProductCardVariant = "grid" | "list";

const LIMIT_TOAST_ID = "stock-limit";

function notifyLimit(productName: string) {
  toast.error(`Превышен лимит запаса: ${productName}`, { id: LIMIT_TOAST_ID });
}

export default function ProductCard({
  product,
  variant = "grid",
  interactive = true,
}: {
  product: Product;
  variant?: ProductCardVariant;
  interactive?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const activeDiscounts = useActiveDiscounts();
  const [imageError, setImageError] = useState(false);

  const cartItem = cartItems.find((i) => i.product_id === product.id);
  const isInCart = !!cartItem;
  const productCount = Number(product.count ?? 0);
  const isAvailable = productCount > 0;
  const isList = variant === "list";
  const isMl = product.unit === "ml";
  const minVolume = product.min_volume ?? 1;
  const priceUsd = getProductPrice(product);
  const presetType = getPresetType(product.category, product.unit);
  const presets = usePresets(presetType ?? "");

  const volumePriceInfo = useMemo(() => {
    if (!isInCart || !cartItem) return null;

    const qty = cartItem.quantity;
    const category = product.category ?? "oil";
    const unitPrice = priceUsd;

    if (activeDiscounts.length === 0) return null;

    const virtualItem: CartItem = {
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: unitPrice,
      volume_ml: isMl ? qty : null,
      image_url: product.image_url,
      image_thumb_url: product.image_thumb_url ?? null,
      unit: product.unit ?? "ml",
      category,
      quantity: qty,
      count: productCount,
      attributes: product.attributes ?? null,
      gender: product.gender ?? null,
      country_of_origin: product.country_of_origin ?? null,
      code: product.code ?? null,
    };

    const result = calculateDiscounts([virtualItem], activeDiscounts, kztRate);
    const line = result.lines[0];

    if (line && line.discountKzt > 0) {
      return {
        baseKzt: line.baseKzt,
        finalKzt: line.finalKzt,
        discountKzt: line.discountKzt,
        percentage: Math.round((line.discountKzt / line.baseKzt) * 100),
        hasDiscount: true as const,
      };
    }

    const base = itemPriceKzt(unitPrice, category, kztRate) * qty;
    return { baseKzt: base, finalKzt: base, discountKzt: 0, percentage: 0, hasDiscount: false as const };
  }, [isInCart, cartItem, priceUsd, product.id, product.name, product.brand, product.image_url, product.image_thumb_url, product.unit, product.category, product.attributes, product.gender, product.country_of_origin, product.code, productCount, activeDiscounts, kztRate, isMl]);

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

  const handleVolumeClick = (e: React.MouseEvent, volume: number) => {
    stop(e);
    if (!isAvailable) return;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: priceUsd,
      volume_ml: volume,
      image_url: product.image_url,
      image_thumb_url: product.image_thumb_url ?? null,
      count: productCount,
      unit: product.unit ?? "pcs",
      category: product.category ?? "accessory",
      quantity: volume,
      attributes: product.attributes ?? null,
      gender: product.gender ?? null,
      country_of_origin: product.country_of_origin ?? null,
      code: product.code ?? null,
    });
    toast.success(`${product.name} (${volume} мл) добавлен в корзину`);
  };

  const handleQtyClick = (e: React.MouseEvent, qty: number) => {
    stop(e);
    if (!isAvailable) return;
    const safeQty = Math.min(qty, productCount);
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: priceUsd,
      volume_ml: null,
      image_url: product.image_url,
      image_thumb_url: product.image_thumb_url ?? null,
      count: productCount,
      unit: product.unit ?? "pcs",
      category: product.category ?? "accessory",
      quantity: safeQty,
      attributes: product.attributes ?? null,
      gender: product.gender ?? null,
      country_of_origin: product.country_of_origin ?? null,
      code: product.code ?? null,
    });
    toast.success(`${product.name} (${safeQty} шт) добавлен в корзину`);
  };

  const priceDisplay = isMl
    ? formatPricePerUnit(priceUsd, "ml", kztRate)
    : isKztPriced(product.category)
    ? formatKzt(priceUsd)
    : formatPriceUsd(priceUsd, kztRate);

  const countryCodes = useCountryStore((s) => s.codes);
  const countryCode = getCountryCode(countryCodes, product.country_of_origin);

  const categoryLabel =
    product.category === "oil" ? "Масло"
    : product.category === "perfume" ? "Парфюм"
    : null;

  const availabilityText = isAvailable ? "В наличии" : "Нет в наличии";

  const renderVolumePriceInfo = () => {
    if (!volumePriceInfo) return <p className="price">{priceDisplay}</p>;

    const oldDisplay = isMl
      ? formatPricePerUnit(priceUsd, "ml", kztRate)
      : isKztPriced(product.category)
        ? formatKzt(priceUsd)
        : formatPriceUsd(priceUsd, kztRate);

    if (!volumePriceInfo.hasDiscount) return <p className="price">{oldDisplay}</p>;

    const perUnit = volumePriceInfo.finalKzt / cartItem!.quantity;
    const newDisplay = isMl
      ? `${formatKzt(perUnit)} / мл`
      : formatKzt(perUnit);

    return (
      <div className="volume-price-info">
        <div className="volume-price-row">
          <span className="volume-price-old">{oldDisplay}</span>
          <span className="discount-badge">−{volumePriceInfo.percentage}%</span>
        </div>
        <p className="volume-price-new is-discounted">{newDisplay}</p>
      </div>
    );
  };

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

  const cardContent = (
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

        {isInCart && interactive && (
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
              {interactive && isAvailable && (
                <>
                  {isMl && presets.length > 0 && (
                    <div className="product-card-volumes" onClick={stop}>
                      {presets.map((v) => {
                        const isTaken = v > productCount;
                        const isSelected = isInCart && cartItem.quantity === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={isTaken}
                            onClick={(e) => handleVolumeClick(e, v)}
                            className={`volume-pill ${isSelected ? "is-selected" : ""} ${isTaken ? "is-disabled" : ""}`}
                          >
                            {v} мл
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {product.category === "accessory" && presets.length > 0 && (
                    <div className="product-card-volumes" onClick={stop}>
                      {presets.map((v) => {
                        const isTaken = v > productCount;
                        const isSelected = isInCart && cartItem.quantity === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={isTaken}
                            onClick={(e) => handleQtyClick(e, v)}
                            className={`volume-pill ${isSelected ? "is-selected" : ""} ${isTaken ? "is-disabled" : ""}`}
                          >
                            {v} шт
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
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
              {renderVolumePriceInfo()}
            </div>
            {interactive && renderCartControls()}
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
          {renderVolumePriceInfo()}
          {interactive && isAvailable && (
            <>
{isMl && presets.length > 0 && (
                  <div className="product-card-volumes" onClick={stop}>
                  {presets.map((v) => {
                    const isTaken = v > productCount;
                    const isSelected = isInCart && cartItem.quantity === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={isTaken}
                        onClick={(e) => handleVolumeClick(e, v)}
                        className={`volume-pill ${isSelected ? "is-selected" : ""} ${isTaken ? "is-disabled" : ""}`}
                      >
                        {v} мл
                      </button>
                    );
                  })}
                </div>
              )}
{product.category === "accessory" && presets.length > 0 && (
                  <div className="product-card-volumes" onClick={stop}>
                  {presets.map((v) => {
                    const isTaken = v > productCount;
                    const isSelected = isInCart && cartItem.quantity === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={isTaken}
                        onClick={(e) => handleQtyClick(e, v)}
                        className={`volume-pill ${isSelected ? "is-selected" : ""} ${isTaken ? "is-disabled" : ""}`}
                      >
                        {v} шт
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {interactive && (
            <div className="product-card-cart-row">
              {renderCartControls()}
            </div>
          )}
        </div>
      )}
    </article>
  );

  const catParam = product.category ?? "oil";
  const qParam = encodeURIComponent(product.name);

  if (!interactive) {
    return (
      <Link
        href={`/catalog?category=${catParam}&q=${qParam}`}
        className={`product-card-link product-card-link--${variant}`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={`product-card-link product-card-link--${variant}`}>
      {cardContent}
    </div>
  );
}
