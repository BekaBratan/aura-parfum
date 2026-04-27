"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Send, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

type ProductStockRow = {
  id: string;
  name: string;
  count: number | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart = useCartStore((s) => s.clearCart);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_city: "",
    customer_address: "",
    comment: "",
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customer_name || !form.customer_phone || !form.customer_city || !form.customer_address) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const productIds = items.map((item) => item.product_id);
      const { data: stockRows, error: stockError } = await supabase
        .from("products")
        .select("id, name, count")
        .in("id", productIds);

      if (stockError || !stockRows) {
        toast.error("Не удалось проверить наличие товаров");
        setSubmitting(false);
        return;
      }

      const stockById = new Map(
        (stockRows as ProductStockRow[]).map((product) => [product.id, product])
      );

      for (const item of items) {
        const product = stockById.get(item.product_id);
        const availableCount = Number(product?.count ?? 0);

        if (!product || item.quantity > availableCount) {
          toast.error(
            `Недостаточно товара в наличии: ${item.name}. Доступно: ${availableCount} шт.`
          );
          setSubmitting(false);
          return;
        }
      }

      const orderItems = items.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        brand: item.brand,
        price: item.price,
        quantity: item.quantity,
        volume_ml: item.volume_ml,
        image_url: item.image_url,
      }));

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_city: form.customer_city,
          customer_address: form.customer_address,
          comment: form.comment || null,
          items: orderItems,
          total_price: totalPrice(),
          payment_status: "pending_payment",
          order_status: "new",
        })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Could not save order");
        setSubmitting(false);
        return;
      }

      for (const item of items) {
        const { error: decrementError } = await supabase.rpc(
          "decrement_product_count",
          {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
          }
        );

        if (decrementError) {
          const product = stockById.get(item.product_id);
          const availableCount = Number(product?.count ?? 0);
          toast.error(
            `Недостаточно товара в наличии: ${item.name}. Доступно: ${availableCount} шт.`
          );
          setSubmitting(false);
          return;
        }
      }

      clearCart();
      toast.success("Order created");
      router.push(`/invoice/${data.id}`);
    } catch {
      toast.error("Something went wrong");
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
              { name: "customer_phone", label: "Телефон *", placeholder: "+7 (___) ___-__-__", type: "tel" },
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

            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {submitting ? "Создаем заказ..." : "Создать счет"}
            </button>
          </form>

          <aside className="card order-summary">
            <h2 className="filter-title">Ваш заказ</h2>
            <div className="order-items">
              {items.map((item) => (
                <div key={item.product_id} className="order-item">
                  <span>
                    {item.brand} {item.name} {item.volume_ml ? `${item.volume_ml} мл` : ""} × {item.quantity}
                  </span>
                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-row order-total-row">
              <span>Итого</span>
              <span className="summary-total">{formatPrice(totalPrice())}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
