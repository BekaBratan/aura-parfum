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
      <div className="pt-24 pb-16 flex justify-center">
        <Loader2 className="animate-spin text-[var(--gold)]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="pt-24 pb-16 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Invoice not found</h1>
        <Link href="/catalog" className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-1">Invoice</p>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{order.invoice_number}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              {new Date(order.created_at).toLocaleString("ru-RU")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Payment: {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Order: {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">Products</h2>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="flex justify-between gap-4 border-b border-[var(--border)]/60 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">
                      {item.brand} {item.name}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {item.volume_ml ? `${item.volume_ml}ml · ` : ""}{item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="text-[var(--text-primary)] font-semibold whitespace-nowrap">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--border)] mt-5 pt-4 flex justify-between">
              <span className="text-[var(--text-primary)] font-semibold">Total</span>
              <span className="text-xl font-bold text-gold-gradient">{formatPrice(order.total_price)}</span>
            </div>
          </div>

          <aside className="glass-card p-5 h-fit">
            <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">Customer</h2>
            <div className="space-y-3 text-sm">
              <Info label="Name" value={order.customer_name} />
              <Info label="Phone" value={order.customer_phone} />
              <Info label="City" value={order.customer_city} />
              <Info label="Address" value={order.customer_address} />
              {order.comment && <Info label="Comment" value={order.comment} />}
            </div>

            <div className="mt-6 space-y-3">
              <button onClick={downloadPdf} className="btn-gold w-full py-3 rounded-full text-sm flex items-center justify-center gap-2 cursor-pointer">
                <Download size={17} className="relative z-10" />
                <span>Download PDF</span>
              </button>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-full text-sm flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--gold)] transition-colors">
                <Send size={17} />
                <span>Send to WhatsApp</span>
              </a>
              <Link href="/catalog" className="w-full py-3 rounded-full text-sm flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-colors">
                <ShoppingBag size={17} />
                <span>Continue shopping</span>
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
    <div>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="text-[var(--text-primary)] break-words">{value}</p>
    </div>
  );
}
