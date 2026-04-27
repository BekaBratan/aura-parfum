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
      <div className="pt-24 pb-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[var(--dark-3)] flex items-center justify-center mx-auto mb-6">
            <ShoppingBag size={36} className="text-[var(--text-secondary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Cart is empty</h1>
          <Link href="/catalog" className="btn-gold px-8 py-3 rounded-full text-sm inline-block">
            <span>Continue shopping</span>
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
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
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors mb-8">
          <ArrowLeft size={16} /> Back to cart
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-1">Final step</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Checkout</h1>
        </div>

        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-[var(--gold)] mb-3 uppercase tracking-wider">Your order</h3>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between gap-4 text-sm">
                <span className="text-[var(--text-secondary)] truncate max-w-[60%]">
                  {item.brand} {item.name} {item.volume_ml ? `${item.volume_ml}ml` : ""} x {item.quantity}
                </span>
                <span className="text-[var(--text-primary)] font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] pt-3 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-gold-gradient">{formatPrice(totalPrice())}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { name: "customer_name", label: "Name *", placeholder: "Your name", type: "text" },
            { name: "customer_phone", label: "Phone *", placeholder: "+7 (___) ___-__-__", type: "tel" },
            { name: "customer_city", label: "City *", placeholder: "Almaty", type: "text" },
            { name: "customer_address", label: "Delivery address *", placeholder: "Street, house, apartment", type: "text" },
          ].map((field) => (
            <div key={field.name}>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">{field.label}</label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name as keyof typeof form]}
                onChange={handleChange}
                placeholder={field.placeholder}
                className="input-dark"
                required
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Comment</label>
            <textarea
              name="comment"
              value={form.comment}
              onChange={handleChange}
              placeholder="Additional details..."
              rows={3}
              className="input-dark resize-none"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 rounded-full text-sm font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {submitting ? <Loader2 size={18} className="animate-spin relative z-10" /> : <Send size={18} className="relative z-10" />}
            <span>{submitting ? "Creating order..." : "Create invoice"}</span>
          </button>
          <p className="text-xs text-center text-[var(--text-secondary)]">After checkout, the invoice will open on the website.</p>
        </form>
      </div>
    </div>
  );
}
