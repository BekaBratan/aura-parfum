"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Product } from "@/types";
import { applyStockOverlay, fetchAinurStockMap } from "@/lib/ainur/stockOverlay";
import { formatPriceUsd, formatPricePerUnit, getProductPrice, GENDER_LABELS } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { formatUsd } from "@/lib/currency";
import { COUNTRY_CODES } from "@/lib/countries";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { ShoppingBag, ArrowLeft, Check, X as XIcon } from "lucide-react";
import QuantityControls from "@/components/ui/QuantityControls";
import toast from "react-hot-toast";

const ATTRIBUTE_LABELS: Record<string, string> = {
  gender:  "Пол",
  quality: "Качество",
  type:    "Тип",
};

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  perfume:   ["gender", "quality"],
  oil:       ["gender", "quality"],
  accessory: ["type"],
};

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [chosenVolume, setChosenVolume] = useState<number>(1);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const kztRate = useCurrencyStore((s) => s.kztRate);

  const productCount = Number(product?.count ?? 0);
  const isAvailable = productCount > 0;
  const isMl = product?.unit === "ml";
  const minVolume = product?.min_volume ?? 1;

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [{ data }, stockMap] = await Promise.all([
          supabase.from("products").select("*").eq("id", id).single(),
          fetchAinurStockMap().catch(() => null),
        ]);
        const p = data as Product | null;
        setProduct(p && stockMap ? applyStockOverlay([p], stockMap)[0] : p);
      } catch (err) {
        console.error("Не удалось загрузить товар:", err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const existing = cartItems.find((i) => i.product_id === product.id);
    if (existing) {
      setChosenVolume(existing.quantity);
    } else {
      setChosenVolume(product.min_volume ?? 1);
    }
  }, [product?.id, product?.min_volume, cartItems]);

  useEffect(() => {
    setImageError(false);
  }, [product?.image_url]);

  const handleAdd = () => {
    if (!product || !isAvailable) return;
    const qty = chosenVolume;
    addItem({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      price_usd: priceUsd,
      volume_ml: isMl ? qty : product.volume_ml,
      image_url: product.image_url,
      count: productCount,
      unit: product.unit ?? "pcs",
      category: product.category ?? "accessory",
      quantity: qty,
      attributes: product.attributes ?? null,
      gender: product.gender ?? null,
      country_of_origin: product.country_of_origin ?? null,
    });
    const totalKzt = formatPriceUsd(priceUsd * qty, kztRate);
    const label = isMl ? `${qty} мл → ${totalKzt}` : product.name;
    toast.success(`Добавлено: ${label}`);
  };

  const cartItem = product ? cartItems.find((i) => i.product_id === product.id) : null;
  const isInCart = !!cartItem;

  if (loading) {
    return (
      <div className="product-detail">
        <div className="site-container product-detail-grid">
          <div className="product-detail-image skeleton" />
          <div className="detail-panel">
            <div className="skeleton skeleton-line is-short" />
            <div className="skeleton skeleton-line is-full" />
            <div className="skeleton skeleton-line is-medium" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <h1 className="section-title">Товар не найден</h1>
          <Link href="/catalog" className="btn btn-secondary">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const priceUsd = getProductPrice(product);
  const totalKzt = formatPriceUsd(
    isMl ? priceUsd * chosenVolume : priceUsd,
    kztRate
  );
  const availabilityText = isAvailable ? "В наличии" : "Нет в наличии";

  const allowedKeys = ALLOWED_ATTRIBUTES[product.category ?? "perfume"] ?? [];

  // Build attribute entries; for gender fall back to top-level column for older products
  const rawEntries = Object.entries(product.attributes ?? {}).filter(
    ([k, v]) => allowedKeys.includes(k) && v !== "" && v !== null && v !== undefined
  );
  const hasGenderAttr = rawEntries.some(([k]) => k === "gender");
  const attributeEntries =
    allowedKeys.includes("gender") && !hasGenderAttr && product.gender
      ? [...rawEntries, ["gender", product.gender] as [string, string]]
      : rawEntries;

  const countryCode = product.country_of_origin
    ? COUNTRY_CODES[product.country_of_origin] ?? null
    : null;

  const categoryLabel =
    product.category === "oil" ? "Масло"
    : product.category === "perfume" ? "Парфюм"
    : null;

  return (
    <div className="product-detail">
      <div className="site-container">
        <Link href="/catalog" className="back-link">
          <ArrowLeft size={16} />
          Назад в каталог
        </Link>

        <div className="product-detail-grid">
          <div className="product-detail-image">
            {product.image_url && !imageError ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="product-detail-img"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="image-placeholder">
                <div>
                  <ShoppingBag size={74} strokeWidth={1} />
                  <span>AZ-ZAHRA</span>
                </div>
              </div>
            )}
            {product.is_featured && (
              <span className="badge badge-success product-detail-badge">
                Хит продаж
              </span>
            )}
            {countryCode && (
              <div className="product-detail-country" title={product.country_of_origin ?? ""}>
                {countryCode}
              </div>
            )}
          </div>

          <div className="detail-panel">
            {/* Brand, name, category */}
            <div>
              {product.category !== "accessory" && <p className="product-brand">{product.brand}</p>}
              <h1 className="detail-title">{product.name}</h1>
              {categoryLabel && (
                <p className="product-category-label" style={{ marginTop: 6 }}>{categoryLabel}</p>
              )}
            </div>

            {product.description && (
              <p className="detail-description">{product.description}</p>
            )}

            <div className="card detail-list">
              <div className="detail-row">
                <span>Наличие</span>
                {isAvailable ? (
                  <strong className="product-availability">
                    <Check size={14} /> {availabilityText}
                  </strong>
                ) : (
                  <strong className="product-availability is-empty">
                    <XIcon size={14} /> Нет в наличии
                  </strong>
                )}
              </div>

              {product.country_of_origin && (
                <div className="detail-row">
                  <span>Страна происхождения</span>
                  <strong>
                    {product.country_of_origin}
                    {countryCode && (
                      <span className="detail-country-code">{countryCode}</span>
                    )}
                  </strong>
                </div>
              )}

              {attributeEntries.map(([key, value]) => {
                const raw = Array.isArray(value) ? value.join(", ") : String(value);
                const display = key === "gender" ? (GENDER_LABELS[raw] ?? raw) : raw;
                return (
                  <div key={key} className="detail-row">
                    <span>{ATTRIBUTE_LABELS[key] ?? key}</span>
                    <strong>{display}</strong>
                  </div>
                );
              })}
            </div>

            {/* Price */}
            <div className="detail-price-block">
              <p className="price detail-price">
                {isMl
                  ? formatPricePerUnit(priceUsd, "ml", kztRate)
                  : product.category === "accessory"
                  ? formatKzt(priceUsd)
                  : formatPriceUsd(priceUsd, kztRate)}
              </p>
              {!isMl && product.category !== "accessory" && (
                <p className="detail-price-usd">{formatUsd(priceUsd)}</p>
              )}
              {isMl && (
                <p className="detail-price-usd">{formatUsd(priceUsd)} / мл</p>
              )}
            </div>

            {/* Volume / quantity selector */}
            {isAvailable && (
              <div className="volume-selector">
                <label className="volume-selector-label">
                  {isMl ? "Объём, мл" : "Количество"}
                </label>
                <div className="volume-selector-row">
                  <QuantityControls
                    value={chosenVolume}
                    min={isMl ? minVolume : 1}
                    max={productCount}
                    unit={product.unit ?? "pcs"}
                    onChange={setChosenVolume}
                    onLimitExceeded={() =>
                      toast.error(`Превышен лимит запаса: ${product.name}`, { id: "stock-limit" })
                    }
                    size="md"
                  />
                  <span className="volume-total">= {totalKzt}</span>
                </div>
              </div>
            )}

            {isInCart && (
              <div className="detail-in-cart-notice">
                <Check size={14} />
                <span>В корзине: {cartItem!.quantity} {isMl ? "мл" : "шт"}</span>
                <Link href="/cart" className="detail-cart-link">Перейти в корзину →</Link>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={
                !isAvailable ||
                chosenVolume < (isMl ? minVolume : 1) ||
                chosenVolume > productCount
              }
              className={`btn ${isAvailable ? "btn-primary" : "btn-secondary"}`}
            >
              <ShoppingBag size={18} />
              {!isAvailable
                ? "Нет в наличии"
                : isInCart
                ? `Обновить — ${chosenVolume} ${isMl ? "мл" : "шт"}`
                : isMl
                ? `В корзину — ${chosenVolume} мл`
                : `В корзину — ${chosenVolume} шт`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
