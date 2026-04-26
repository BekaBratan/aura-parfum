"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cartStore";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, buildWhatsAppMessage } from "@/lib/utils";
import { Send, Loader2, ShoppingBag, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const clearCart = useCartStore((s) => s.clearCart);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successWhatsAppUrl, setSuccessWhatsAppUrl] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", city: "", address: "", comment: "",
  });

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  if (successWhatsAppUrl) {
    return (
      <div className="pt-24 pb-16 text-center">
        <div className="max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-[var(--dark-3)] flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[var(--gold)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Заказ оформлен</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">Нажмите кнопку, если WhatsApp не открылся автоматически.</p>
          <a href={successWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="btn-gold px-8 py-3 rounded-full text-sm inline-flex items-center justify-center gap-2">
            <Send size={18} className="relative z-10" />
            <span>Open WhatsApp</span>
          </a>
          <div className="mt-4">
            <Link href="/catalog" className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors">В каталог</Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pt-24 pb-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[var(--dark-3)] flex items-center justify-center mx-auto mb-6">
            <ShoppingBag size={36} className="text-[var(--text-secondary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Корзина пуста</h1>
          <Link href="/catalog" className="btn-gold px-8 py-3 rounded-full text-sm inline-block"><span>В каталог</span></Link>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.city || !form.address) {
      toast.error("Заполните все обязательные поля"); return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const orderItems = items.map((i) => ({
        product_id: i.product_id, name: i.name, brand: i.brand,
        price: i.price, quantity: i.quantity, volume_ml: i.volume_ml,
      }));
      const { error } = await supabase.from("orders").insert({
        name: form.name, phone: form.phone, city: form.city,
        address: form.address, comment: form.comment || null,
        items: orderItems, total: totalPrice(),
      });
      if (error) { toast.error("Ошибка сохранения заказа"); setSubmitting(false); return; }

      const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
      const message = buildWhatsAppMessage(items, form, totalPrice());
      const waUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
      clearCart();
      setSuccessWhatsAppUrl(waUrl);
      setSubmitting(false);
      toast.success("Заказ оформлен!");
      window.open(waUrl, "_blank");
    } catch { toast.error("Произошла ошибка"); setSubmitting(false); }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors mb-8">
          <ArrowLeft size={16} /> Назад в корзину
        </Link>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-1">Финальный шаг</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Оформление заказа</h1>
        </div>

        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-[var(--gold)] mb-3 uppercase tracking-wider">Ваш заказ</h3>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)] truncate max-w-[60%]">
                  {item.brand} {item.name} {item.volume_ml ? `${item.volume_ml}мл` : ""} × {item.quantity}
                </span>
                <span className="text-[var(--text-primary)] font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] pt-3 flex justify-between">
            <span className="font-semibold">Итого</span>
            <span className="text-lg font-bold text-gold-gradient">{formatPrice(totalPrice())}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: "name", label: "Имя *", placeholder: "Ваше имя", type: "text" },
            { name: "phone", label: "Телефон *", placeholder: "+7 (___) ___-__-__", type: "tel" },
            { name: "city", label: "Город *", placeholder: "Алматы", type: "text" },
            { name: "address", label: "Адрес доставки *", placeholder: "Улица, дом, квартира", type: "text" },
          ].map((f) => (
            <div key={f.name}>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">{f.label}</label>
              <input type={f.type} name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange} placeholder={f.placeholder} className="input-dark" required />
            </div>
          ))}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Комментарий</label>
            <textarea name="comment" value={form.comment} onChange={handleChange} placeholder="Дополнительные пожелания..." rows={3} className="input-dark resize-none" />
          </div>
          <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 rounded-full text-sm font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {submitting ? <Loader2 size={18} className="animate-spin relative z-10" /> : <Send size={18} className="relative z-10" />}
            <span>{submitting ? "Отправка..." : "Отправить заказ в WhatsApp"}</span>
          </button>
          <p className="text-xs text-center text-[var(--text-secondary)]">После оформления вы будете перенаправлены в WhatsApp</p>
        </form>
      </div>
    </div>
  );
}
