"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Product } from "@/types";
import { formatPriceUsd, formatPricePerUnit, getProductPrice, UNIT_LABELS } from "@/lib/utils";
import { formatUsd } from "@/lib/currency";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { ShoppingBag, ArrowLeft, Check, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";

const ATTRIBUTE_LABELS: Record<string, string> = {
  gender: "Пол",
  family: "Семейство",
  oil_type: "Тип масла",
  aroma_note: "Нота",
  type: "Тип",
  material: "Материал",
  color: "Цвет",
  top_notes: "Верхние ноты",
  middle_notes: "Средние ноты",
  base_notes: "Базовые ноты",
};

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [chosenVolume, setChosenVolume] = useState<number>(1);
  const addItem = useCartStore((s) => s.addItem);
  const kztRate = useCurrencyStore((s) => s.kztRate);

  const productCount = Number(product?.count ?? 0);
  const isAvailable = productCount > 0;
  const isMl = product?.unit === "ml";
  const minVolume = product?.min_volume ?? 1;

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

  useEffect(() => {
    if (product) setChosenVolume(product.min_volume ?? 1);
  }, [product?.id, product?.min_volume]);

  useEffect(() => {
    setImageError(false);
  }, [product?.image_url]);

  const handleVolumeChange = (raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    setChosenVolume(Math.min(Math.max(val, minVolume), productCount));
  };

  const handleAdd = () => {
    if (!product || !isAvailable) return;
    const qty = isMl ? chosenVolume : 1;
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
    });
    const totalKzt = formatPriceUsd(priceUsd * qty, kztRate);
    const label = isMl ? `${qty} мл → ${totalKzt}` : product.name;
    toast.success(`Добавлено: ${label}`);
  };

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
  const availabilityText = isAvailable
    ? `В наличии: ${productCount} ${UNIT_LABELS[product.unit ?? "pcs"]}`
    : "Нет в наличии";

  const attributeEntries = Object.entries(product.attributes ?? {}).filter(
    ([, v]) => v !== "" && v !== null && v !== undefined
  );

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
                  <span>Aura Parfum</span>
                </div>
              </div>
            )}
            {product.is_featured && (
              <span className="badge badge-success product-detail-badge">
                Хит продаж
              </span>
            )}
          </div>

          <div className="detail-panel">
            <div>
              <p className="product-brand">{product.brand}</p>
              <h1 className="detail-title">{product.name}</h1>
            </div>

            {/* Price */}
            <div className="detail-price-block">
              <p className="price detail-price">
                {isMl
                  ? formatPricePerUnit(priceUsd, "ml", kztRate)
                  : formatPriceUsd(priceUsd, kztRate)}
              </p>
              <p className="detail-price-usd">
                {isMl
                  ? `${formatUsd(priceUsd)} / мл`
                  : formatUsd(priceUsd)}
              </p>
            </div>

            {/* Volume selector for ml products */}
            {isMl && (
              <div className="volume-selector">
                <label className="volume-selector-label">
                  Объём, мл
                  <span className="volume-selector-hint">
                    доступно: {productCount} мл
                  </span>
                </label>
                <div className="volume-selector-row">
                  <input
                    type="number"
                    min={minVolume}
                    max={productCount}
                    step={1}
                    value={chosenVolume}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    disabled={!isAvailable}
                    className="input volume-input"
                    aria-label="Объём в мл"
                  />
                  <span className="volume-unit">мл</span>
                  {isAvailable && (
                    <span className="volume-total">= {totalKzt}</span>
                  )}
                </div>
              </div>
            )}

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
                  <strong>{product.country_of_origin}</strong>
                </div>
              )}

              {attributeEntries.map(([key, value]) => (
                <div key={key} className="detail-row">
                  <span>{ATTRIBUTE_LABELS[key] ?? key}</span>
                  <strong>
                    {Array.isArray(value) ? value.join(", ") : String(value)}
                  </strong>
                </div>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={
                !isAvailable ||
                (isMl && (chosenVolume < minVolume || chosenVolume > productCount))
              }
              className={`btn ${isAvailable ? "btn-primary" : "btn-secondary"}`}
            >
              <ShoppingBag size={18} />
              {!isAvailable
                ? "Нет в наличии"
                : isMl
                ? `В корзину — ${chosenVolume} мл`
                : "Добавить в корзину"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
