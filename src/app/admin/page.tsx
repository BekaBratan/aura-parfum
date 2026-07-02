"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Package, ShoppingCart, DollarSign, CreditCard, AlertTriangle, Clock, XCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Order, Product } from "@/types";
import Link from "next/link";

type MergedStatus = "awaiting_payment" | "paid" | "failed" | "cancelled";

function deriveStatus(order: Order): MergedStatus {
  if (order.order_status === "cancelled" || order.payment_status === "refunded") return "cancelled";
  if (order.payment_status === "paid") return "paid";
  if (order.payment_status === "pending_payment") return "awaiting_payment";
  if (order.payment_status === "failed") return "failed";
  return "awaiting_payment";
}

const STATUS_CONFIG: Record<MergedStatus, { label: string; color: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", color: "text-yellow-400 bg-yellow-500/10" },
  paid: { label: "Выполнен", color: "text-green-400 bg-green-500/10" },
  failed: { label: "Ошибка заказа", color: "text-red-400 bg-red-500/10" },
  cancelled: { label: "Отменён", color: "text-red-400 bg-red-500/10" },
};

const STATUS_ORDER: MergedStatus[] = ["awaiting_payment", "paid", "failed", "cancelled"];

interface DashStats {
  totalProducts: number;
  lowStockProducts: number;
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: Order[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [prodRes, ordRes] = await Promise.all([
        supabase.from("products").select("id, count"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
      ]);

      const products = (prodRes.data as Pick<Product, "id" | "count">[]) || [];
      const orders = (ordRes.data as Order[]) || [];

      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_usd), 0);
      const lowStock = products.filter((p) => Number(p.count ?? 0) === 0).length;

      const ordersByStatus: Record<string, number> = {};
      for (const o of orders) {
        const st = deriveStatus(o);
        ordersByStatus[st] = (ordersByStatus[st] ?? 0) + 1;
      }

      setStats({
        totalProducts: products.length,
        lowStockProducts: lowStock,
        totalOrders: orders.length,
        totalRevenue,
        ordersByStatus,
        recentOrders: orders.slice(0, 6),
      });
      setLoading(false);
    }
    load();
  }, []);

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`skeleton rounded-lg ${className}`} />
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Панель</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Товаров", value: stats?.totalProducts, icon: Package, color: "text-blue-400", sub: stats?.lowStockProducts ? `${stats.lowStockProducts} нет в наличии` : "Все в наличии", subColor: stats?.lowStockProducts ? "text-red-400" : "text-green-400" },
          { label: "Заказов", value: stats?.totalOrders, icon: ShoppingCart, color: "text-purple-400", sub: `${stats?.ordersByStatus?.awaiting_payment ?? 0} ожидают`, subColor: "text-yellow-400" },
          { label: "Выручка", value: stats ? formatPrice(stats.totalRevenue) : null, icon: DollarSign, color: "text-[var(--gold)]", sub: `${stats?.ordersByStatus?.paid ?? 0} выполнено`, subColor: "text-green-400" },
          { label: "Ожидают оплаты", value: stats?.ordersByStatus?.awaiting_payment ?? 0, icon: CreditCard, color: "text-yellow-400", sub: `${stats?.ordersByStatus?.failed ?? 0} ошибок`, subColor: "text-red-400" },
        ].map((card) => (
          <div key={card.label} className="glass-card p-5 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${card.color}`}>
                <card.icon size={18} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{card.label}</span>
            </div>
            {loading ? <Skeleton className="h-7 w-20 mb-1" /> : (
              <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{card.value}</p>
            )}
            {loading ? <Skeleton className="h-3.5 w-28" /> : (
              <p className={`text-xs font-medium ${card.subColor}`}>{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Merged order statuses */}
      <div className="glass-card p-5 rounded-xl border border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Статусы</h2>
        <div className="space-y-2.5">
          {STATUS_ORDER.map((status) => {
            const count = stats?.ordersByStatus[status] ?? 0;
            const total = stats?.totalOrders || 1;
            const pct = Math.round((count / total) * 100);
            const { label, color } = STATUS_CONFIG[status];
            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                    {status === "awaiting_payment" && <Clock size={11} />}
                    {status === "cancelled" && <XCircle size={11} />}
                    {label}
                  </span>
                  {loading ? <Skeleton className="h-4 w-8" /> : (
                    <span className="text-sm font-bold text-[var(--text-primary)]">{count}</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  {!loading && <div className="h-full rounded-full bg-[var(--gold)] transition-all" style={{ width: `${pct}%`, opacity: 0.7 }} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Low stock alert */}
        {!loading && (stats?.lowStockProducts ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-2 text-[var(--gold)] text-xs">
            <AlertTriangle size={14} />
            <span>{stats!.lowStockProducts} товаров нет в наличии</span>
            <Link href="/admin/products" className="ml-auto underline hover:text-yellow-300">Открыть</Link>
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="glass-card rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Последние заказы</h2>
          <Link href="/admin/orders" className="text-xs text-[var(--gold)] hover:underline">Все заказы →</Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : stats?.recentOrders.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-secondary)]">Заказов пока нет</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {stats!.recentOrders.map((order) => {
              const st = deriveStatus(order);
              const { label, color } = STATUS_CONFIG[st];
              return (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{order.invoice_number}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{order.customer_name} · {order.customer_phone}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${color}`}>
                    {label}
                  </span>
                  <span className="text-sm font-bold text-[var(--gold)] shrink-0">{formatPrice(order.total_usd)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
