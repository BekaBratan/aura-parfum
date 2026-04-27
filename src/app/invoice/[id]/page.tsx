"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";
import { Download, Loader2, Send, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { buildWhatsAppMessage, formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/utils";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", params.id)
        .single();

      setOrder((data as Order) || null);
      setLoading(false);
    }

    loadOrder();
  }, [params.id]);

  const customerForm = useMemo(
    () => ({
      customer_name: order?.customer_name || "",
      customer_phone: order?.customer_phone || "",
      customer_city: order?.customer_city || "",
      customer_address: order?.customer_address || "",
      comment: order?.comment || "",
    }),
    [order]
  );

  const whatsappUrl = useMemo(() => {
    if (!order) return "";
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const message = buildWhatsAppMessage(
      order.invoice_number,
      order.items,
      customerForm,
      order.total_price,
      order.payment_status
    );

    return `https://wa.me/${number}?text=${message}`;
  }, [customerForm, order]);

  const downloadPdf = () => {
    if (!order) return;

    const doc = new jsPDF();
    const date = new Date(order.created_at).toLocaleDateString("en-GB");
    let y = 18;

    doc.setFontSize(20);
    doc.text("Aura Parfum", 14, y);
    y += 10;
    doc.setFontSize(12);
    doc.text(`Invoice: ${order.invoice_number}`, 14, y);
    y += 7;
    doc.text(`Date: ${date}`, 14, y);
    y += 7;
    doc.text(`Payment status: ${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}`, 14, y);
    y += 12;

    doc.setFontSize(14);
    doc.text("Customer", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Name: ${order.customer_name}`, 14, y);
    y += 6;
    doc.text(`Phone: ${order.customer_phone}`, 14, y);
    y += 6;
    doc.text(`City: ${order.customer_city}`, 14, y);
    y += 6;
    doc.text(`Address: ${order.customer_address}`, 14, y);
    y += 12;

    doc.setFontSize(14);
    doc.text("Items", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Product", 14, y);
    doc.text("Qty", 125, y);
    doc.text("Price", 145, y);
    doc.text("Line total", 170, y);
    y += 5;
    doc.line(14, y, 196, y);
    y += 7;

    order.items.forEach((item) => {
      const product = `${item.brand} ${item.name}${item.volume_ml ? ` ${item.volume_ml}ml` : ""}`;
      doc.text(product.slice(0, 58), 14, y);
      doc.text(String(item.quantity), 125, y);
      doc.text(formatPrice(item.price), 145, y);
      doc.text(formatPrice(item.price * item.quantity), 170, y);
      y += 7;
    });

    y += 3;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFontSize(13);
    doc.text(`Total: ${formatPrice(order.total_price)}`, 14, y);

    doc.save(`${order.invoice_number}.pdf`);
  };

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
          <h1 className="section-title">Счет не найден</h1>
          <Link href="/catalog" className="btn btn-secondary">
            Продолжить покупки
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-layout">
      <div className="site-container">
        <div className="invoice-header">
          <div>
            <p className="eyebrow">Счет</p>
            <h1 className="section-title">{order.invoice_number}</h1>
            <p className="section-subtitle">
              {new Date(order.created_at).toLocaleString("ru-RU")}
            </p>
          </div>
          <div className="filter-options">
            <span className="badge badge-muted">
              Оплата: {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
            </span>
            <span className="badge badge-muted">
              Заказ: {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
            </span>
          </div>
        </div>

        <div className="invoice-grid">
          <div className="card invoice-card">
            <h2 className="filter-title">Товары</h2>
            <div className="invoice-items">
              {order.items.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="invoice-item">
                  <div>
                    <p className="product-title">{item.brand} {item.name}</p>
                    <p className="product-meta">
                      {item.volume_ml ? `${item.volume_ml} мл · ` : ""}{item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">{formatPrice(order.total_price)}</span>
            </div>
          </div>

          <aside className="card invoice-sidebar">
            <h2 className="filter-title">Клиент</h2>
            <div className="info-list">
              <Info label="Имя" value={order.customer_name} />
              <Info label="Телефон" value={order.customer_phone} />
              <Info label="Город" value={order.customer_city} />
              <Info label="Адрес" value={order.customer_address} />
              {order.comment && <Info label="Комментарий" value={order.comment} />}
            </div>

            <div className="invoice-actions">
              <button onClick={downloadPdf} className="btn btn-primary">
                <Download size={17} />
                Скачать PDF
              </button>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <Send size={17} />
                Отправить в WhatsApp
              </a>
              <Link href="/catalog" className="btn btn-secondary">
                <ShoppingBag size={17} />
                Продолжить покупки
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
