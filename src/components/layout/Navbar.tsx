"use client";

import Link from "next/link";
import { ShoppingBag, Search, Menu, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (isAdmin) return null;

  return (
    <header className="site-header">
      <div className="site-container">
        <div className="site-header-inner">
          <Link href="/" className="site-logo" aria-label="Aura Parfum">
            <span className="site-logo-mark">AZ-ZAHRA</span>
            <span className="site-logo-text">Parfume</span>
          </Link>

          <nav className="site-nav" aria-label="Основная навигация">
            <Link href="/" className="site-nav-link">
              Главная
            </Link>
            <Link href="/catalog" className="site-nav-link">
              Каталог
            </Link>
          </nav>

          <div className="site-actions">
            <Link href="/catalog" className="icon-button" aria-label="Поиск">
              <Search size={20} />
            </Link>

            <Link href="/cart" className="icon-button" aria-label="Корзина">
              <ShoppingBag size={20} />
              {mounted && totalItems() > 0 && (
                <span className="cart-count">{totalItems()}</span>
              )}
            </Link>

            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="icon-button md:hidden"
              aria-label="Меню"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      <div className={`mobile-menu-panel ${menuOpen ? "is-open" : ""}`}>
        <Link href="/" className="site-nav-link">
          Главная
        </Link>
        <Link href="/catalog" className="site-nav-link">
          Каталог
        </Link>
      </div>
    </header>
  );
}
