"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { formatKzt } from "@/lib/currency";

function pluralItems(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

export default function FloatingCartBar() {
  const items = useCartStore((s) => s.items);
  const totalKzt = useCartStore((s) => s.totalKzt);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) return null;

  const total = totalKzt(kztRate);

  return (
    <>
      <style>{`
        .floating-cart-pill {
          position: fixed !important;
          bottom: 32px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 999 !important;
          display: none !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 14px 20px !important;
          background: rgba(33, 31, 28, 0.92) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 999px !important;
          text-decoration: none !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3) !important;
          transition: background 0.2s ease, transform 0.2s ease !important;
        }
        @media (hover: hover) {
          .floating-cart-pill:hover {
            background: rgba(53, 51, 48, 0.95) !important;
            transform: translateX(-50%) translateY(-2px) !important;
          }
        }
        .floating-cart-pill-line1 {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          color: #f8f4ec !important;
          font-size: 0.92rem !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }
        .floating-cart-pill-line2 {
          color: #d8bd89 !important;
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
          letter-spacing: 0.03em !important;
        }
        @media (max-width: 768px) {
          .floating-cart-pill {
            display: flex !important;
          }
        }
        @media (max-width: 640px) {
          .floating-cart-pill {
            left: 12px !important;
            right: 12px !important;
            transform: none !important;
            width: auto !important;
          }
          @media (hover: hover) {
            .floating-cart-pill:hover {
              transform: translateY(-2px) !important;
            }
          }
        }
      `}</style>
      <Link href="/cart" className="floating-cart-pill">
        <span className="floating-cart-pill-line1">
          <ShoppingBag size={16} />
          <span>Выбрано <strong>{pluralItems(items.length)}</strong> ({formatKzt(total)})</span>
        </span>
        <span className="floating-cart-pill-line2">ПЕРЕЙТИ В КОРЗИНУ</span>
      </Link>
    </>
  );
}
