"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types";
import { formatKzt } from "@/lib/currency";

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function OrderSuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("id, invoice_number, items, total_display_currency, discount_kzt, customer_phone, created_at")
        .eq("id", orderId)
        .single();
      if (!cancelled) {
        setOrder((data as Order) ?? null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="empty-state">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <h1 className="section-title">Заказ не найден</h1>
          <p className="section-subtitle">Возможно, ссылка устарела или заказ был удалён.</p>
          <Link href="/catalog" className="btn btn-primary">
            Вернуться в каталог <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
  const totalKzt = Number(order.total_display_currency ?? 0);
  const itemsLabel = `${itemsCount} ${plural(itemsCount, "товар", "товара", "товаров")}`;

  const shopWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const whatsappHref = shopWhatsApp
    ? `https://wa.me/${shopWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Здравствуйте! Я оформил(а) заказ № ${order.invoice_number}, хочу уточнить детали.`,
      )}`
    : "";

  return (
    <div className="order-success-layout">
      <div className="site-narrow">
        <div className="card order-success-card">
          <div className="order-success-icon">
            <CheckCircle2 size={56} strokeWidth={1.5} />
          </div>
          <p className="eyebrow">Спасибо за заказ</p>
          <h1 className="section-title">Заказ принят!</h1>
          <p className="section-subtitle">
            Номер счёта: <strong>{order.invoice_number}</strong>
          </p>

          <div className="order-success-summary">
            <div className="summary-row">
              <span>В заказе</span>
              <strong>{itemsLabel}</strong>
            </div>
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">{formatKzt(totalKzt)}</span>
            </div>
          </div>

          <p className="order-success-note">
            Свяжитесь с нами через WhatsApp для подтверждения заказа и оплаты.
          </p>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp order-success-whatsapp"
            >
              <Send size={17} /> Написать в WhatsApp
            </a>
          )}

          <div className="order-success-actions">
            <Link href={`/invoice/${order.id}`} className="btn btn-primary">
              <FileText size={17} /> Подробнее о заказе
            </Link>
            <Link href="/catalog" className="btn btn-secondary">
              В каталог <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense>
      <OrderSuccessContent />
    </Suspense>
  );
}
