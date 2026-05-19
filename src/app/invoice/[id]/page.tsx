"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { Download, Loader2, Send, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currencyStore";

pdfMake.addVirtualFileSystem(pdfFonts);

const INVOICE_PDF_BUCKET = "invoice-pdfs";

const PDF_PAYMENT_STATUS_LABELS: Record<Order["payment_status"], string> = {
  pending_payment: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
};

const PDF_ORDER_STATUS_LABELS: Record<Order["order_status"], string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  shipped: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменен",
};

function formatKzt(price: number) {
  const amount = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);

  return `${amount.replace(/\s/g, " ")} тг`;
}

function formatInvoiceDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInvoicePdfFileName(order: Order) {
  return `invoice-${order.invoice_number}.pdf`;
}

function getInvoicePdfPath(order: Order) {
  return `invoices/${order.invoice_number}.pdf`;
}

function getCategoryLabel(item: Order["items"][number]): string {
  if (item.category === "oil")       return "Масло";
  if (item.category === "perfume")   return "Парфюм";
  if (item.category === "accessory") return "Аксессуар";
  return "";
}

function getProductLine(item: Order["items"][number]) {
  const cat = getCategoryLabel(item);
  return cat ? `[${cat}] ${item.name}` : item.name;
}

function getQtyLabel(item: Order["items"][number]) {
  const unit = item.unit ?? (item.volume_ml ? "ml" : "pcs");
  return unit === "ml" ? `${item.quantity} мл` : `${item.quantity} шт.`;
}

// price_usd in order items: accessories = raw KZT, oils/perfumes = USD per ml
// (the RPC stores prices from products table directly)
function itemKzt(item: Order["items"][number], kztRate: number): number {
  return item.category === "accessory"
    ? item.price_usd
    : item.price_usd * kztRate;
}

function buildInvoicePdfDefinition(order: Order, kztRate: number): TDocumentDefinitions {
  const productRows: TableCell[][] = order.items.map((item) => {
    const priceKzt = itemKzt(item, kztRate);
    return [
      { text: getProductLine(item) },
      { text: getQtyLabel(item), alignment: "center" },
      { text: formatKzt(priceKzt), alignment: "right" },
      { text: formatKzt(priceKzt * item.quantity), alignment: "right" },
    ];
  });

  const customerRows: [string, string][] = [
    ["Имя", order.customer_name],
    ["Телефон", order.customer_phone],
    ["Город", order.customer_city],
    ["Адрес", order.customer_address],
  ];

  if (order.comment) {
    customerRows.push(["Комментарий", order.comment]);
  }

  return {
    pageSize: "A4",
    pageMargins: [40, 42, 40, 42],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.25,
    },
    styles: {
      brand: { fontSize: 22, bold: true, color: "#8a6a35" },
      title: { fontSize: 15, bold: true, margin: [0, 8, 0, 4] },
      sectionTitle: { fontSize: 13, bold: true, color: "#8a6a35", margin: [0, 18, 0, 8] },
      tableHeader: { bold: true, fillColor: "#f1eadf" },
      total: { fontSize: 14, bold: true, alignment: "right", margin: [0, 12, 0, 0] },
      muted: { color: "#6f6a62" },
    },
    content: [
      { text: "AZ-ZAHRA", style: "brand" },
      { text: `Накладная № ${order.invoice_number}`, style: "title" },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: `Дата: ${formatInvoiceDate(order.created_at)}` },
              { text: `Статус оплаты: ${PDF_PAYMENT_STATUS_LABELS[order.payment_status]}` },
              { text: `Статус заказа: ${PDF_ORDER_STATUS_LABELS[order.order_status]}` },
            ],
          },
        ],
      },
      { text: "Клиент", style: "sectionTitle" },
      {
        table: {
          widths: [92, "*"],
          body: customerRows.map(([label, value]) => [
            { text: label, bold: true, fillColor: "#fbf8f1" },
            { text: value || "-" },
          ]),
        },
        layout: "lightHorizontalLines",
      },
      { text: "Товары", style: "sectionTitle" },
      {
        table: {
          headerRows: 1,
          widths: ["*", 54, 78, 84],
          body: [
            [
              { text: "Товар", style: "tableHeader" },
              { text: "Кол-во", style: "tableHeader", alignment: "center" },
              { text: "Цена", style: "tableHeader", alignment: "right" },
              { text: "Сумма", style: "tableHeader", alignment: "right" },
            ],
            ...productRows,
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: `Итого: ${formatKzt(order.items.reduce((s, i) => s + itemKzt(i, kztRate) * i.quantity, 0))}`, style: "total" },
    ],
  };
}

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

function buildInvoiceWhatsAppText(order: Order, publicPdfUrl: string, kztRate: number) {
  const productLines = order.items.map((item, index) => {
    const product = getProductLine(item);
    const qty = getQtyLabel(item);
    const priceKzt = itemKzt(item, kztRate);
    return `${index + 1}. ${product} - ${qty} × ${formatKzt(priceKzt)} = ${formatKzt(priceKzt * item.quantity)}`;
  });

  return [
    "Здравствуйте! Новый заказ AZ-ZAHRA Parfume.",
    "",
    `Накладная № ${order.invoice_number}`,
    `Клиент: ${order.customer_name}`,
    `Телефон: ${order.customer_phone}`,
    `Адрес: ${order.customer_city}, ${order.customer_address}`,
    "",
    "Товары:",
    ...productLines,
    "",
    `Итого: ${formatKzt(order.items.reduce((s, i) => s + itemKzt(i, kztRate) * i.quantity, 0))}`,
    `Статус оплаты: ${PDF_PAYMENT_STATUS_LABELS[order.payment_status]}`,
    "",
    "PDF-накладная:",
    publicPdfUrl,
  ].join("\n");
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const kztRate = useCurrencyStore((s) => s.kztRate);

  useEffect(() => {
    async function loadOrder() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", params.id)
        .single();

      setOrder((data as Order) || null);
      setPdfUrl("");
      setLoading(false);
    }

    loadOrder();
  }, [params.id]);

  const generateAndUploadPdf = useCallback(
    async ({ showUploadError = true } = {}) => {
      if (!order) return null;

      setPdfGenerating(true);

      try {
        const blob = await createInvoicePdfBlob(order, kztRate);
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

  const cancelOrder = async () => {
    if (!order) return;
    if (order.order_status === "cancelled") {
      toast.error("Заказ уже отменён");
      return;
    }
    if (!window.confirm("Вы уверены, что хотите отменить заказ? Запас товаров будет восстановлен.")) return;

    setCancelling(true);
    const supabase = createClient();

    try {
      // Restore stock for each item
      for (const item of order.items) {
        const { data: product } = await supabase
          .from("products")
          .select("count")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ count: Number(product.count) + item.quantity })
            .eq("id", item.product_id);
        }
      }

      // Mark order as cancelled
      const { error } = await supabase
        .from("orders")
        .update({ order_status: "cancelled" })
        .eq("id", order.id);

      if (error) throw error;

      setOrder((prev) => prev ? { ...prev, order_status: "cancelled" } : prev);
      toast.success("Заказ отменён. Запас товаров восстановлен.");
    } catch {
      toast.error("Не удалось отменить заказ");
    } finally {
      setCancelling(false);
    }
  };

  const sendToWhatsApp = async () => {
    if (!order) return;

    const result = pdfUrl ? null : await generateAndUploadPdf();
    const publicPdfUrl = pdfUrl || result?.publicUrl || "";

    if (!publicPdfUrl) {
      toast.error("Сначала создайте публичную ссылку на PDF-накладную");
      return;
    }

    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const message = encodeURIComponent(buildInvoiceWhatsAppText(order, publicPdfUrl, kztRate));
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
              {order.items.map((item, index) => {
                const priceKzt = itemKzt(item, kztRate);
                return (
                  <div key={`${item.product_id}-${index}`} className="invoice-item">
                    <div>
                      <p className="product-title">{item.name}</p>
                      <p className="product-meta">
                        {getCategoryLabel(item)} · {getQtyLabel(item)} × {formatKzt(priceKzt)}
                      </p>
                    </div>
                    <strong>{formatKzt(priceKzt * item.quantity)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">
                {formatKzt(order.items.reduce((s, i) => s + itemKzt(i, kztRate) * i.quantity, 0))}
              </span>
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
              <button
                onClick={sendToWhatsApp}
                disabled={pdfGenerating}
                className="btn"
                style={{ background: "#25D366", color: "#fff", borderColor: "#25D366" }}
              >
                <Send size={17} />
                Отправить в WhatsApp
              </button>

              <button onClick={downloadPdf} disabled={pdfGenerating} className="btn btn-primary">
                {pdfGenerating ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                {pdfGenerating ? "Готовим PDF..." : "Скачать PDF"}
              </button>

              {order.order_status !== "cancelled" && (
                <button
                  onClick={cancelOrder}
                  disabled={cancelling}
                  className="btn"
                  style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}
                >
                  {cancelling ? <Loader2 size={17} className="animate-spin" /> : <XCircle size={17} />}
                  {cancelling ? "Отмена..." : "Отменить заказ"}
                </button>
              )}

              {order.order_status === "cancelled" && (
                <div className="btn" style={{ background: "rgba(220,38,38,0.08)", color: "#f87171", border: "1px solid rgba(220,38,38,0.2)", cursor: "default", opacity: 0.7 }}>
                  <XCircle size={17} />
                  Заказ отменён
                </div>
              )}
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
