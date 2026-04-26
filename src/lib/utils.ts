export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price);
}

export function buildWhatsAppMessage(
  items: {
    name: string;
    brand: string;
    quantity: number;
    price: number;
    volume_ml: number | null;
  }[],
  form: {
    name: string;
    phone: string;
    city: string;
    address: string;
    comment?: string;
  },
  total: number
): string {
  const lines = [
    "🌸 *Новый заказ — Aura Parfum*",
    "",
    "*Товары:*",
    ...items.map(
      (item) =>
        `• ${item.brand} ${item.name}${item.volume_ml ? ` ${item.volume_ml}мл` : ""} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`
    ),
    "",
    `*Итого:* ${formatPrice(total)}`,
    "",
    "*Данные клиента:*",
    `👤 Имя: ${form.name}`,
    `📞 Телефон: ${form.phone}`,
    `🏙 Город: ${form.city}`,
    `📍 Адрес: ${form.address}`,
  ];

  if (form.comment) {
    lines.push(`💬 Комментарий: ${form.comment}`);
  }

  return encodeURIComponent(lines.join("\n"));
}
