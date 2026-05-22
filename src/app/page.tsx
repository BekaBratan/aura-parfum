import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product/ProductCard";
import { Product } from "@/types";
import { applyStockOverlay, fetchAinurStockMapServer } from "@/lib/ainur/stockOverlay";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";

export const revalidate = 60;

async function getStockMapSafe() {
  try {
    return await fetchAinurStockMapServer();
  } catch {
    return null;
  }
}

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_featured", true)
      .gt("count", 0)
      .limit(4);
    return (data as Product[]) || [];
  } catch {
    return [];
  }
}

async function getNewProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    return (data as Product[]) || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [featuredRaw, newestRaw, stockMap] = await Promise.all([
    getFeaturedProducts(),
    getNewProducts(),
    getStockMapSafe(),
  ]);
  const featured = stockMap ? applyStockOverlay(featuredRaw, stockMap) : featuredRaw;
  const newest = stockMap ? applyStockOverlay(newestRaw, stockMap) : newestRaw;

  const benefits = [
    {
      icon: ShieldCheck,
      title: "100% оригинал",
      text: "Подлинная парфюмерия от официальных поставщиков.",
    },
    {
      icon: Truck,
      title: "Доставка по Казахстану",
      text: "Аккуратно упакуем и отправим заказ удобным способом.",
    },
    {
      icon: Sparkles,
      title: "Избранные бренды",
      text: "Коллекция ароматов для ежедневных и особенных образов.",
    },
  ];

  return (
    <>
      <section className="hero">
        <div className="site-container">
          <div className="hero-content">
            <p className="eyebrow">Оригинальная парфюмерия</p>
            <h1 className="hero-title">
              Ароматы для <span className="hero-title-accent">вашего</span> настроения
            </h1>
            <p className="hero-subtitle">
              Откройте коллекцию изысканных ароматов от ведущих мировых брендов.
              Светлая эстетика, понятный выбор и доставка по Казахстану.
            </p>
            <div className="hero-actions">
              <Link href="/catalog" className="btn btn-primary">
                <span>Перейти в каталог</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="site-container">
          <div className="benefits-grid">
            {benefits.map((item) => (
              <div key={item.title} className="benefit-item">
                <div className="benefit-icon">
                  <item.icon size={22} />
                </div>
                <div>
                  <h3 className="benefit-title">{item.title}</h3>
                  <p className="benefit-text">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="site-container">
            <div className="section-header">
              <div>
                <p className="eyebrow">Рекомендуем</p>
                <h2 className="section-title">Хиты продаж</h2>
              </div>
              <Link href="/catalog" className="btn btn-secondary">
                Все ароматы <ArrowRight size={14} />
              </Link>
            </div>

            <div className="product-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="section section-soft">
          <div className="site-container">
            <div className="section-header">
              <div>
                <p className="eyebrow">Новинки</p>
                <h2 className="section-title">Новые поступления</h2>
              </div>
              <Link href="/catalog" className="btn btn-secondary">
                Смотреть все <ArrowRight size={14} />
              </Link>
            </div>

            <div className="product-grid">
              {newest.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="site-container">
          <div className="cta-inner">
            <p className="eyebrow">AZ-ZAHRA</p>
            <h2 className="section-title">Найдите свой аромат</h2>
            <p className="section-subtitle">
              Выберите парфюм, который подчеркнет ваш стиль, сезон и настроение.
            </p>
            <div className="hero-actions is-centered">
              <Link href="/catalog" className="btn btn-primary">
                Смотреть каталог <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
