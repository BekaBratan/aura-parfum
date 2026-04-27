export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price);
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  shipped: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменен",
};

export function buildWhatsAppMessage(
  invoiceNumber: string,
  items: {
    name: string;
    brand: string;
    quantity: number;
    price: number;
    volume_ml: number | null;
  }[],
  customer: {
    customer_name: string;
    customer_phone: string;
    customer_city: string;
    customer_address: string;
    comment?: string;
  },
  totalPrice: number,
  paymentStatus = "pending_payment"
): string {
  const lines = [
    "*Aura Parfum invoice*",
    `Invoice: ${invoiceNumber}`,
    `Payment status: ${PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}`,
    "",
    "*Customer:*",
    `Name: ${customer.customer_name}`,
    `Phone: ${customer.customer_phone}`,
    `City: ${customer.customer_city}`,
    `Address: ${customer.customer_address}`,
    "",
    "*Items:*",
    ...items.map(
      (item) =>
        `- ${item.brand} ${item.name}${item.volume_ml ? ` ${item.volume_ml}ml` : ""} x ${item.quantity} = ${formatPrice(item.price * item.quantity)}`
    ),
    "",
    `*Total:* ${formatPrice(totalPrice)}`,
  ];

  if (customer.comment) {
    lines.push(`Comment: ${customer.comment}`);
  }

  return encodeURIComponent(lines.join("\n"));
}
