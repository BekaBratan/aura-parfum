"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { ShoppingBag, ArrowLeft, Check, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const productCount = Number(product?.count ?? 0);
  const isAvailable = productCount > 0;

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
    if (!product || !isAvailable) return;
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

  return (
    <div className="product-detail">
      <div className="site-container">
        <Link href="/catalog" className="back-link">
          <ArrowLeft size={16} />
          Назад в каталог
        </Link>

        <div className="product-detail-grid">
          <div className="product-detail-image">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="product-detail-img"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
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
              <span className="badge badge-success product-detail-badge">Хит продаж</span>
            )}
          </div>

          <div className="detail-panel">
            <div>
              <p className="product-brand">{product.brand}</p>
              <h1 className="detail-title">{product.name}</h1>
              {product.volume_ml && <p className="product-meta">{product.volume_ml} мл</p>}
            </div>

            <p className="price detail-price">{formatPrice(product.price)}</p>

            {product.description && (
              <p className="detail-description">{product.description}</p>
            )}

            <div className="card detail-list">
              <div className="detail-row">
                <span>Пол</span>
                <strong>
                  {product.gender === "men"
                    ? "Мужской"
                    : product.gender === "women"
                    ? "Женский"
                    : "Унисекс"}
                </strong>
              </div>
              <div className="detail-row">
                <span>Наличие</span>
                {isAvailable ? (
                  <strong className="product-availability">
                    <Check size={14} /> В наличии: {productCount} шт.
                  </strong>
                ) : (
                  <strong className="product-availability is-empty">
                    <XIcon size={14} /> Нет в наличии
                  </strong>
                )}
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!isAvailable}
              className={`btn ${isAvailable ? "btn-primary" : "btn-secondary"}`}
            >
              <ShoppingBag size={18} />
              {isAvailable ? "Добавить в корзину" : "Нет в наличии"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
