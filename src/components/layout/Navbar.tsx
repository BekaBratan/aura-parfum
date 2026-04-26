"use client";

import Link from "next/link";
import { ShoppingBag, Search, Menu, X, User } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems);
  const pathname = usePathname();

  // Hide navbar on admin pages
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (isAdmin) return null;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0d0d0d]/90 backdrop-blur-xl shadow-lg shadow-black/30"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl sm:text-3xl font-bold tracking-wide text-gold-gradient"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              AURA
            </span>
            <span className="text-xs sm:text-sm font-light tracking-[0.3em] text-[var(--text-secondary)] uppercase mt-1">
              Parfum
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm tracking-wide text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors duration-300"
            >
              Главная
            </Link>
            <Link
              href="/catalog"
              className="text-sm tracking-wide text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors duration-300"
            >
              Каталог
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/catalog"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
              aria-label="Поиск"
            >
              <Search size={20} />
            </Link>

            <Link
              href="/cart"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors relative"
              aria-label="Корзина"
            >
              <ShoppingBag size={20} />
              {mounted && totalItems() > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center badge-gold">
                  {totalItems()}
                </span>
              )}
            </Link>

            <Link
              href="/auth"
              className="hidden sm:block p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
              aria-label="Аккаунт"
            >
              <User size={20} />
            </Link>

            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
              aria-label="Меню"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          menuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[var(--dark-2)]/95 backdrop-blur-xl border-t border-[var(--border)] px-6 py-4 space-y-3">
          <Link
            href="/"
            className="block text-sm py-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
          >
            Главная
          </Link>
          <Link
            href="/catalog"
            className="block text-sm py-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
          >
            Каталог
          </Link>
          <Link
            href="/auth"
            className="block text-sm py-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
          >
            Войти
          </Link>
        </div>
      </div>
    </nav>
  );
}
