"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { AlertTriangle, Download, Loader2, MessageCircle, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { buildInvoiceWhatsAppText, itemKzt, getQtyLabel, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { getOrderItemDetails } from "@/lib/orderItemDetails";
import { useCurrencyStore } from "@/store/currencyStore";
import { buildInvoicePdfDefinition, INVOICE_PDF_BUCKET, getInvoicePdfFileName, getInvoicePdfPath } from "@/lib/pdf";

pdfMake.addVirtualFileSystem(pdfFonts);

async function createInvoicePdfBlob(order: Order, kztRate: number) {
  return pdfMake.createPdf(buildInvoicePdfDefinition(order, kztRate)).getBlob();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}



export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const effectiveRate = order?.kzt_rate ?? kztRate;

  useEffect(() => {
    async function loadOrder() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", params.id)
        .single();

      const loaded = (data as Order) || null;
      setOrder(loaded);
      setPdfUrl("");
      setLoading(false);
      if (loaded && loaded.payment_status === "pending_payment" && loaded.order_status !== "cancelled") {
        setShowWhatsAppPrompt(true);
      }
    }

    loadOrder();
  }, [params.id]);

  const generateAndUploadPdf = useCallback(
    async ({ showUploadError = true } = {}) => {
      if (!order) return null;

      setPdfGenerating(true);

      try {
        const blob = await createInvoicePdfBlob(order, order.kzt_rate ?? kztRate);
        const supabase = createClient();
        const path = getInvoicePdfPath(order);
        const { error: uploadError } = await supabase.storage
          .from(INVOICE_PDF_BUCKET)
          .upload(path, blob, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error(uploadError);
          if (showUploadError) {
            toast.error("Не удалось загрузить PDF-накладную. Проверьте bucket invoice-pdfs.");
          }

          return { blob, publicUrl: "" };
        }

        const { data } = supabase.storage.from(INVOICE_PDF_BUCKET).getPublicUrl(path);
        setPdfUrl(data.publicUrl);

        return { blob, publicUrl: data.publicUrl };
      } catch (error) {
        console.error(error);
        toast.error("Не удалось создать PDF-накладную");
        return null;
      } finally {
        setPdfGenerating(false);
      }
    },
    [order]
  );

  useEffect(() => {
    if (!order || pdfUrl) return;

    void generateAndUploadPdf({ showUploadError: false });
  }, [generateAndUploadPdf, order, pdfUrl]);

  const downloadPdf = async () => {
    if (!order) return;

    const result = await generateAndUploadPdf();
    if (!result?.blob) return;

    downloadBlob(result.blob, getInvoicePdfFileName(order));
  };

  const cancelOrder = () => {
    if (!order) return;
    if (order.order_status === "cancelled") {
      toast.error("Заказ уже отменён");
      return;
    }
    if (!window.confirm("Вы уверены, что хотите сообщить об отмене заказа?")) return;

    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const message = encodeURIComponent(
      [
        "❌ Отмена заказа",
        "",
        `Накладная № ${order.invoice_number}`,
        `Клиент: ${order.customer_name}`,
        `Телефон: ${order.customer_phone}`,
        `Адрес: ${order.customer_city}, ${order.customer_address}`,
        `Сумма: ${formatKzt(Number(order.total_display_currency ?? 0))}`,
      ].join("\n")
    );
    window.open(`https://wa.me/${number.replace(/\D/g, "")}?text=${message}`, "_blank");
  };

  const sendToWhatsApp = () => {
    if (!order) return;

    const siteUrl = window.location.origin;
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const message = buildInvoiceWhatsAppText(order, siteUrl, order.kzt_rate ?? kztRate);
    window.open(`https://wa.me/${number}?text=${message}`, "_blank", "noopener,noreferrer");
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
    <><div className="invoice-layout">
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

        {order.payment_status === "pending_payment" && order.order_status !== "cancelled" && (
          <div className="whatsapp-required-banner">
            <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>Заказ будет обработан <strong>только после отправки</strong> в WhatsApp. Без отправки заказ не поступит в обработку.</span>
          </div>
        )}

        <div className="invoice-grid">
          <div className="card invoice-card">
            <h2 className="filter-title">Товары</h2>
            <div className="invoice-items">
              {order.items.map((item, index) => {
                const priceKzt = itemKzt(item.price_usd, item.category, effectiveRate);
                const details = getOrderItemDetails(item);
                const baseKzt = priceKzt * item.quantity;
                const discountKzt = Number(item.discount_kzt ?? 0);
                const hasDiscount = discountKzt > 0;
                const finalKzt = Math.max(0, baseKzt - discountKzt);
                return (
                  <div key={`${item.product_id}-${index}`} className="invoice-item">
                    <div>
                      {item.category !== "accessory" && item.brand && (
                        <p className="product-brand">{item.brand}</p>
                      )}
                      <p className="product-title">{item.name}</p>
                      <div className="cart-item-badges">
                        {details.map((d) => (
                          <span
                            key={d.key}
                            className={
                              d.tone === "deluxe"
                                ? "badge badge-deluxe"
                                : d.tone === "premium"
                                ? "badge badge-premium"
                                : "badge badge-muted"
                            }
                          >
                            {d.label}
                          </span>
                        ))}
                      </div>
                      <p className="product-meta">{getQtyLabel(item.quantity, item.volume_ml, item.unit)} × {formatKzt(priceKzt)}</p>
                      {hasDiscount && (
                        <p className="line-discount-note">
                          {item.applied_discount_name ? `«${item.applied_discount_name}» ` : ""}
                          −{formatKzt(discountKzt)}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {hasDiscount && <p className="price-old">{formatKzt(baseKzt)}</p>}
                      <strong>{formatKzt(finalKzt)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const subtotal = order.items.reduce((s, i) => s + itemKzt(i.price_usd, i.category, effectiveRate) * i.quantity, 0);
              const discountKzt = Number(order.discount_kzt ?? 0);
              const discountSum = Number(order.discount_sum ?? 0);
              const total = Math.max(0, subtotal - discountKzt - discountSum);
              const hasRule = discountKzt > 0;
              const hasPersonal = discountSum > 0;
              if (!hasRule && !hasPersonal) {
                return (
                  <div className="summary-row order-total-row">
                    <span>Итого</span>
                    <span className="summary-total">{formatKzt(total)}</span>
                  </div>
                );
              }
              return (
                <>
                  <div className="summary-row" style={{ color: "var(--color-muted)" }}>
                    <span>Сумма</span>
                    <span>{formatKzt(subtotal)}</span>
                  </div>
                  {hasRule && (order.applied_discounts ?? []).map((a) => (
                    <div key={a.discount_id} className="summary-row" style={{ color: "var(--color-success)" }}>
                      <span>{a.name}</span>
                      <span>−{formatKzt(a.amount_kzt)}</span>
                    </div>
                  ))}
                  {hasPersonal && (
                    <div className="summary-row" style={{ color: "var(--color-success)" }}>
                      <span>Персональная скидка ({order.discount_percent}%)</span>
                      <span>−{formatKzt(discountSum)}</span>
                    </div>
                  )}
                  <div className="summary-row order-total-row">
                    <span>Итого</span>
                    <span className="summary-total">{formatKzt(total)}</span>
                  </div>
                </>
              );
            })()}
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
              <button
                onClick={sendToWhatsApp}
                className="btn btn-whatsapp"
              >
                <MessageCircle size={17} />
                Отправить в WhatsApp
              </button>

              <button onClick={downloadPdf} disabled={pdfGenerating} className="btn btn-primary">
                {pdfGenerating ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                {pdfGenerating ? "Готовим PDF..." : "Скачать PDF"}
              </button>

              {order.order_status !== "cancelled" && (
                <button
                  onClick={cancelOrder}
                  className="btn btn-danger-soft"
                >
                  <XCircle size={17} />
                  Отменить заказ
                </button>
              )}

              {order.order_status === "cancelled" && (
                <div className="btn btn-danger-soft is-cancelled">
                  <XCircle size={17} />
                  Заказ отменён
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
    {showWhatsAppPrompt && (
      <div onClick={() => setShowWhatsAppPrompt(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          padding: 20
        }}
      >
        <div onClick={(e) => e.stopPropagation()}
          className="card"
          style={{ maxWidth: 400, width: "100%", padding: "32px 28px 24px", textAlign: "center", position: "relative" }}
        >
          <button onClick={() => setShowWhatsAppPrompt(false)}
            style={{
              position: "absolute", top: 12, right: 12,
              background: "none", border: "none", color: "var(--color-muted)",
              cursor: "pointer", padding: 4, lineHeight: 0
            }}
          >
            <X size={20} />
          </button>
          <div style={{ color: "var(--gold)", marginBottom: 16, display: "flex", justifyContent: "center" }}>
            <AlertTriangle size={40} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>Внимание!</h2>
          <p style={{ fontSize: 15, color: "var(--color-text)", lineHeight: 1.5, marginBottom: 24 }}>
            Заказ будет обработан <strong>только после отправки</strong> в WhatsApp.
            Без отправки заказ <strong>не поступит в обработку</strong>.
          </p>
          <button
            onClick={() => { sendToWhatsApp(); setShowWhatsAppPrompt(false); }}
            className="btn btn-whatsapp"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <MessageCircle size={18} />
            Отправить в WhatsApp
          </button>
          <button
            onClick={() => setShowWhatsAppPrompt(false)}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            Отправить позже
          </button>
        </div>
      </div>
    )}
  </>);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
