"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Send, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPriceUsd, UNIT_LABELS, itemPriceKzt } from "@/lib/utils";
import { formatKzt } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { CartProductSnapshot, useCartStore } from "@/store/cartStore";
import { CartItem } from "@/types";

type StockIssue = {
  item: CartItem;
  availableCount: number;
};

function getFirstStockIssue(items: CartItem[]): StockIssue | null {
  for (const item of items) {
    const quantity = Number(item.quantity);
    const availableCount = Number(item.count ?? 0);

    if (Number.isNaN(quantity) || quantity <= 0 || availableCount <= 0 || quantity > availableCount) {
      return { item, availableCount };
    }
  }

  return null;
}

function getStockIssueMessage(issue: StockIssue) {
  if (issue.availableCount <= 0) {
    return `Товар закончился: ${issue.item.name}. Удалите его из корзины.`;
  }

  return `Превышен лимит запаса: ${issue.item.name}. Уменьшите количество в корзине.`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalUsd = useCartStore((s) => s.totalUsd);
  const totalKzt = useCartStore((s) => s.totalKzt);
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const clearCart = useCartStore((s) => s.clearCart);
  const syncItemsWithProducts = useCartStore((s) => s.syncItemsWithProducts);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingStock, setRefreshingStock] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_city: "",
    customer_address: "",
    comment: "",
  });
  const productIdsKey = useMemo(
    () => [...new Set(items.map((item) => item.product_id))].sort().join(","),
    [items]
  );
  const stockIssue = useMemo(() => getFirstStockIssue(items), [items]);

  const refreshCartProducts = useCallback(async ({ showToast = false } = {}) => {
    const currentItems = useCartStore.getState().items;
    const productIds = [...new Set(currentItems.map((item) => item.product_id))];
    if (productIds.length === 0) return currentItems;

    setRefreshingStock(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, brand, price_usd, volume_ml, image_url, count, unit, category")
        .in("id", productIds);

      if (error || !data) {
        toast.error("Не удалось обновить остатки товаров");
        return currentItems;
      }

      syncItemsWithProducts(data as CartProductSnapshot[]);

      if (showToast) {
        toast.success("Остатки обновлены");
      }

      return useCartStore.getState().items;
    } finally {
      setRefreshingStock(false);
    }
  }, [syncItemsWithProducts]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted || !productIdsKey) return;

    void refreshCartProducts();
  }, [mounted, productIdsKey, refreshCartProducts]);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-inner">
          <div className="empty-icon">
            <ShoppingBag size={34} />
          </div>
          <h1 className="section-title">Корзина пуста</h1>
          <Link href="/catalog" className="btn btn-primary">
            Продолжить покупки
          </Link>
        </div>
      </div>
    );
  }

  const formatPhone = (raw: string): string => {
    // Keep only digits, strip leading 7/8
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let result = "+7";
    if (digits.length > 0) result += " (" + digits.slice(0, 3);
    if (digits.length >= 3) result += ") " + digits.slice(3, 6);
    if (digits.length >= 6) result += " " + digits.slice(6, 10);
    return result;
  };

  const isPhoneValid = (phone: string) => phone.replace(/\D/g, "").length === 11;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "customer_phone") {
      setForm((current) => ({ ...current, customer_phone: formatPhone(value) }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customer_name || !form.customer_phone || !form.customer_city || !form.customer_address) {
      toast.error("Заполните обязательные поля");
      return;
    }
    if (!isPhoneValid(form.customer_phone)) {
      toast.error("Введите корректный номер телефона: +7 (XXX) XXX XXXX");
      return;
    }

    setSubmitting(true);

    try {
      const refreshedItems = await refreshCartProducts();
      const currentItems = refreshedItems ?? useCartStore.getState().items;
      const currentStockIssue = getFirstStockIssue(currentItems);

      if (currentStockIssue) {
        toast.error(getStockIssueMessage(currentStockIssue));
        setSubmitting(false);
        return;
      }

      const orderItems = currentItems.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        brand: item.brand,
        price_usd: item.category === "accessory"
          ? Number(item.price_usd) / kztRate
          : Number(item.price_usd),
        quantity: Number(item.quantity),
        volume_ml: item.volume_ml,
        image_url: item.image_url,
      }));
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_order_with_stock_check", {
        p_customer_name: form.customer_name,
        p_customer_phone: form.customer_phone,
        p_customer_city: form.customer_city,
        p_customer_address: form.customer_address,
        p_comment: form.comment || null,
        p_items: orderItems,
        p_currency_code: "KZT",
        p_rate_to_usd: kztRate,
      });

      if (error) {
        console.error(error);
        await refreshCartProducts();
        toast.error(error.message || "Не удалось создать заказ");
        setSubmitting(false);
        return;
      }

      const createdOrder = Array.isArray(data) ? data[0] : data;

      if (!createdOrder?.order_id) {
        toast.error("Не удалось создать заказ");
        setSubmitting(false);
        return;
      }

      clearCart();
      toast.success("Заказ создан");
      router.push(`/invoice/${createdOrder.order_id}`);
    } catch {
      toast.error("Что-то пошло не так");
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout-layout">
      <div className="site-container">
        <Link href="/cart" className="back-link">
          <ArrowLeft size={16} /> Назад в корзину
        </Link>

        <div className="checkout-header">
          <div>
            <p className="eyebrow">Финальный шаг</p>
            <h1 className="section-title">Оформление заказа</h1>
          </div>
        </div>

        <div className="checkout-grid">
          <form onSubmit={handleSubmit} className="card checkout-form">
            {[
              { name: "customer_name", label: "Имя *", placeholder: "Ваше имя", type: "text" },
              { name: "customer_city", label: "Город *", placeholder: "Алматы", type: "text" },
              { name: "customer_address", label: "Адрес доставки *", placeholder: "Улица, дом, квартира", type: "text" },
            ].map((field) => (
              <label key={field.name} className="form-field">
                <span className="form-label">{field.label}</span>
                <input
                  type={field.type}
                  name={field.name}
                  value={form[field.name as keyof typeof form]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="input"
                  required
                />
              </label>
            ))}

            <label className="form-field">
              <span className="form-label">Телефон *</span>
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="+7 (777) 777 7777"
                className={`input ${form.customer_phone && !isPhoneValid(form.customer_phone) ? "border-[var(--color-danger)]" : ""}`}
                required
              />
              {form.customer_phone && !isPhoneValid(form.customer_phone) && (
                <span style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 4, display: "block" }}>
                  Введите номер полностью: +7 (XXX) XXX XXXX
                </span>
              )}
            </label>

            <label className="form-field">
              <span className="form-label">Комментарий</span>
              <textarea
                name="comment"
                value={form.comment}
                onChange={handleChange}
                placeholder="Дополнительные детали..."
                rows={3}
                className="textarea"
              />
            </label>

            {stockIssue && (
              <p className="product-availability is-empty">{getStockIssueMessage(stockIssue)}</p>
            )}

            <button
              type="submit"
              disabled={submitting || refreshingStock || Boolean(stockIssue)}
              className="btn btn-primary"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {stockIssue
                ? "Проверьте корзину перед оформлением"
                : refreshingStock
                  ? "Обновляем остатки..."
                  : submitting
                    ? "Создаем заказ..."
                    : "Создать счет"}
            </button>
          </form>

          <aside className="card order-summary">
            <h2 className="filter-title">Ваш заказ</h2>
            <div className="order-items">
              {items.map((item) => {
                const unitLabel = UNIT_LABELS[item.unit ?? "pcs"];
                const catLabel = item.category === "oil" ? "Масло" : item.category === "perfume" ? "Парфюм" : "Аксессуар";
                return (
                  <div key={item.product_id} className="order-item">
                    <span>
                      {catLabel}: {item.name} — {item.quantity} {unitLabel}
                    </span>
                    <strong>{formatKzt(itemPriceKzt(item.price_usd, item.category, kztRate) * item.quantity)}</strong>

                  </div>
                );
              })}
            </div>
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">{formatKzt(totalKzt(kztRate))}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
