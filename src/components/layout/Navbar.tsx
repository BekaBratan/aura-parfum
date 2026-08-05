"use client";

import Link from "next/link";
import { ShoppingBag, Menu, X, Home, Layers } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { useClientDiscount } from "@/lib/useClientDiscount";
import { formatKzt } from "@/lib/currency";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Layers },
];

function pluralItems(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((s) => s.items);
  const totalKzt = useCartStore((s) => s.totalKzt);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const clientDiscount = useClientDiscount();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("is-menu-open", menuOpen);
    return () => {
      document.documentElement.classList.remove("is-menu-open");
    };
  }, [menuOpen]);

  if (isAdmin) return null;

  const cartCount = mounted ? items.length : 0;
  const cartTotal = mounted && items.length > 0 ? totalKzt(kztRate) : 0;

  return (
    <>
      <header className="site-header">
        <div className="site-container">
          <div className="site-header-inner">
            <Link href="/" className="site-logo" aria-label="AZ-ZAHRA">
              <span className="site-logo-mark">AZ-ZAHRA</span>
              <span className="site-logo-text">Parfume</span>
            </Link>

            <nav className="site-nav" aria-label="Основная навигация">
              {NAV_LINKS.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`site-nav-link ${isActive ? "is-active" : ""}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="site-actions">
              {clientDiscount.isClient && clientDiscount.discountPercent > 0 && (
                <span
                  className="vip-badge"
                  title={`Ваша персональная скидка ${clientDiscount.discountPercent}%`}
                >
                  👑 −{clientDiscount.discountPercent}%
                </span>
              )}

              <Link
                href="/cart"
                className={`cart-header-button ${cartCount > 0 ? "has-items" : ""}`}
                aria-label="Корзина"
              >
                <ShoppingBag size={cartCount > 0 ? 18 : 20} />
                <span className="cart-header-text">
                  {pluralItems(cartCount)} ({formatKzt(cartTotal)})
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="icon-button site-menu-toggle"
                aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                aria-expanded={menuOpen}
                aria-controls="site-mobile-menu"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop and panel live OUTSIDE <header> so the header's backdrop-filter
          stacking context can't trap or clip them. */}
      <div
        className={`mobile-menu-backdrop ${menuOpen ? "is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      <aside
        id="site-mobile-menu"
        className={`mobile-menu-panel ${menuOpen ? "is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="mobile-menu-header">
          <span className="mobile-menu-title">Меню</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="icon-button"
            aria-label="Закрыть меню"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mobile-menu-nav" aria-label="Основная навигация">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`mobile-menu-link ${isActive ? "is-active" : ""}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <Link
            href="/cart"
            className={`mobile-menu-link ${pathname?.startsWith("/cart") ? "is-active" : ""}`}
          >
            <ShoppingBag size={18} />
            <span>Корзина</span>
            {cartCount > 0 && <span className="mobile-menu-count">{cartCount}</span>}
          </Link>
          {clientDiscount.isClient && clientDiscount.discountPercent > 0 && (
            <span className="vip-badge" style={{ margin: "12px 20px" }}>
              👑 Ваша скидка: {clientDiscount.discountPercent}%
            </span>
          )}
        </nav>
      </aside>
    </>
  );
}
