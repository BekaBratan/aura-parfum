import type { Order } from "@/types";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatKzt } from "@/lib/currency";
import { formatOrderItemDetails } from "@/lib/orderItemDetails";
import { itemKzt, getQtyLabel, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/utils";

export const INVOICE_PDF_BUCKET = "invoice-pdfs";

export function formatInvoiceDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInvoicePdfFileName(order: Order) {
  return `invoice-${order.invoice_number}.pdf`;
}

export function getInvoicePdfPath(order: Order) {
  return `invoices/${order.invoice_number}.pdf`;
}

function buildProductCell(item: Order["items"][number]) {
  const brand = item.category !== "accessory" && item.brand ? `${item.brand} ` : "";
  const details = formatOrderItemDetails(item);
  const discountKzt = Number(item.discount_kzt ?? 0);
  const stack: Content[] = [
    { text: `${brand}${item.name}`, bold: true },
  ];
  if (details) {
    stack.push({ text: details, style: "muted", fontSize: 8.5, margin: [0, 2, 0, 0] });
  }
  if (discountKzt > 0) {
    const ruleName = item.applied_discount_name ? `«${item.applied_discount_name}»: ` : "";
    stack.push({
      text: `Скидка ${ruleName}−${formatKzt(discountKzt)}`,
      fontSize: 8.5,
      color: "#2a9d6e",
      margin: [0, 2, 0, 0],
    });
  }
  return { stack };
}

function buildPdfTotalsBlock(order: Order, kztRate: number) {
  const subtotal = order.items.reduce((s, i) => s + itemKzt(i.price_usd, i.category, kztRate) * i.quantity, 0);
  const discountKzt = Number(order.discount_kzt ?? 0);
  const total = Math.max(0, subtotal - discountKzt);
  if (discountKzt <= 0) {
    return [{ text: `Итого: ${formatKzt(total)}`, style: "total" }];
  }
  const discountLines = (order.applied_discounts ?? []).map((a) => ({
    text: `${a.name}: −${formatKzt(a.amount_kzt)}`,
    alignment: "right" as const,
    color: "#2a9d6e",
    margin: [0, 2, 0, 0] as [number, number, number, number],
  }));
  return [
    { text: `Сумма: ${formatKzt(subtotal)}`, alignment: "right" as const, margin: [0, 10, 0, 0] as [number, number, number, number], color: "#6f6a62" },
    ...discountLines,
    { text: `Итого: ${formatKzt(total)}`, style: "total" },
  ];
}

export function buildInvoicePdfDefinition(order: Order, kztRate: number): TDocumentDefinitions {
  const productRows: TableCell[][] = order.items.map((item) => {
    const priceKzt = itemKzt(item.price_usd, item.category, kztRate);
    const baseKzt = priceKzt * item.quantity;
    const discountKzt = Number(item.discount_kzt ?? 0);
    const hasDiscount = discountKzt > 0;
    const finalKzt = Math.max(0, baseKzt - discountKzt);
    const sumCell: TableCell = hasDiscount
      ? {
          stack: [
            { text: formatKzt(baseKzt), decoration: "lineThrough", color: "#6f6a62", fontSize: 9 },
            { text: formatKzt(finalKzt), color: "#2a9d6e", bold: true, margin: [0, 1, 0, 0] },
          ],
          alignment: "right",
        }
      : { text: formatKzt(baseKzt), alignment: "right" };
    return [
      buildProductCell(item) as TableCell,
      { text: getQtyLabel(item.quantity, item.volume_ml, item.unit), alignment: "center" },
      { text: formatKzt(priceKzt), alignment: "right" },
      sumCell,
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
              { text: `Статус оплаты: ${PAYMENT_STATUS_LABELS[order.payment_status]}` },
              { text: `Статус заказа: ${ORDER_STATUS_LABELS[order.order_status]}` },
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
      ...buildPdfTotalsBlock(order, kztRate),
    ],
  };
}
