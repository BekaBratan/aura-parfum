import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product/ProductCard";
import { Product } from "@/types";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";

export const revalidate = 60;

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
  const [featured, newest] = await Promise.all([
    getFeaturedProducts(),
    getNewProducts(),
  ]);

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative min-h-[470px] lg:min-h-[500px] 2xl:min-h-[600px] flex items-center justify-center overflow-hidden pt-[72px]">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d0d] via-[#1a1510] to-[#0d0d0d]" />
        {/* Decorative lines */}
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-transparent to-[var(--gold)]/30" />

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto -mt-8 lg:-mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--border)] bg-white/5 mb-5 animate-fade-in-up">
            <Sparkles size={14} className="text-[var(--gold)]" />
            <span className="text-xs tracking-widest uppercase text-[var(--text-secondary)]">
              Оригинальная парфюмерия
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[60px] font-bold mb-4 leading-[1.08] animate-fade-in-up"
            style={{ animationDelay: "0.1s", fontFamily: "'Playfair Display', serif" }}
          >
            <span className="text-gold-gradient">Аромат</span>
            <br />
            <span className="text-[var(--text-primary)]">который запоминается</span>
          </h1>

          <p
            className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-6 leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            Откройте коллекцию изысканных ароматов от ведущих мировых брендов.
            Доставка по всему Казахстану.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/catalog"
              className="btn-gold px-8 py-3.5 rounded-full text-sm tracking-wide inline-flex items-center justify-center gap-2"
            >
              <span>Перейти в каталог</span>
              <ArrowRight size={16} className="relative z-10" />
            </Link>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--dark)] to-transparent" />
      </section>

      {/* ── ADVANTAGES ── */}
      <section className="py-8 lg:py-10 border-y border-[var(--border)]">
        <div className="page-container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, title: "100% Оригинал", text: "Только подлинная парфюмерия от официальных дистрибьюторов" },
              { icon: Truck, title: "Доставка по КЗ", text: "Быстрая и надёжная доставка по всему Казахстану" },
              { icon: Sparkles, title: "Лучшие бренды", text: "Коллекция ароматов от мировых парфюмерных домов" },
            ].map((item) => (
              <div key={item.title} className="text-center group">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center group-hover:bg-[var(--gold)]/20 transition-colors duration-300">
                    <item.icon size={22} className="text-[var(--gold)]" />
                  </div>
                </div>
                <h3 className="text-base font-semibold mb-1 text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED ── */}
      {featured.length > 0 && (
        <section className="home-section">
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-2">
                  Рекомендуем
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                  Хиты продаж
                </h2>
              </div>
              <Link
                href="/catalog"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-[var(--gold)] hover:underline"
              >
                Все ароматы <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWEST ── */}
      {newest.length > 0 && (
        <section className="home-section bg-[var(--dark-2)]">
          <div className="page-container">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-2">
                  Новинки
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
                  Новые поступления
                </h2>
              </div>
              <Link
                href="/catalog"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-[var(--gold)] hover:underline"
              >
                Смотреть все <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {newest.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20">
        <div className="page-container">
          <div className="cta-inner">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[var(--text-primary)]">
            Найдите <span className="text-gold-gradient">свой</span> аромат
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
            Просмотрите наш каталог и выберите парфюм, который подчеркнёт вашу индивидуальность.
          </p>
          <Link
            href="/catalog"
            className="btn-gold px-10 py-4 rounded-full text-sm tracking-wide inline-flex items-center gap-2"
          >
            <span>Смотреть каталог</span>
            <ArrowRight size={16} className="relative z-10" />
          </Link>
          </div>
        </div>
      </section>
    </>
  );
}
