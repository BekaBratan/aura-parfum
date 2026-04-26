"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Package, ShoppingCart, DollarSign } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [prodRes, ordRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total"),
      ]);
      const orders = ordRes.data || [];
      const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
      setStats({
        products: prodRes.count || 0,
        orders: orders.length,
        revenue,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Товары", value: stats.products, icon: Package, color: "text-blue-400" },
    { label: "Заказы", value: stats.orders, icon: ShoppingCart, color: "text-green-400" },
    { label: "Выручка", value: formatPrice(stats.revenue), icon: DollarSign, color: "text-[var(--gold)]" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Дашборд</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${c.color}`}>
                <c.icon size={20} />
              </div>
              <span className="text-sm text-[var(--text-secondary)]">{c.label}</span>
            </div>
            {loading ? (
              <div className="h-7 skeleton w-24" />
            ) : (
              <p className="text-2xl font-bold text-[var(--text-primary)]">{c.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
