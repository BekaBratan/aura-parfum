"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Eye, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/utils";

const ORDER_STATUS_CLASSES: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400",
  confirmed: "bg-yellow-500/10 text-yellow-400",
  shipped: "bg-purple-500/10 text-purple-400",
  delivered: "bg-green-500/10 text-green-400",
  cancelled: "bg-red-500/10 text-red-400",
};

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  pending_payment: "bg-yellow-500/10 text-yellow-400",
  paid: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
  refunded: "bg-purple-500/10 text-purple-400",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    setOrders((data as Order[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadOrders]);

  const updateOrder = async (id: string, field: "payment_status" | "order_status", value: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error("Не удалось обновить статус");
      return;
    }

    toast.success("Статус обновлен");
    setOrders((current) => current.map((order) => (order.id === id ? { ...order, [field]: value } : order)));
    if (detail?.id === id) {
      setDetail((current) => (current ? { ...current, [field]: value } : null));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Заказы</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">Заказов пока нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Счет</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">Телефон</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Сумма</th>
                <th className="pb-3 pr-4">Статус оплаты</th>
                <th className="pb-3 pr-4">Статус заказа</th>
                <th className="pb-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-[var(--text-primary)] font-medium">{order.invoice_number}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{order.customer_name}</p>
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)] hidden sm:table-cell">{order.customer_phone}</td>
                  <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">{formatPrice(order.total_display_currency ?? order.total_usd)}</td>
                  <td className="py-3 pr-4">
                    <StatusSelect
                      value={order.payment_status}
                      labels={PAYMENT_STATUS_LABELS}
                      className={PAYMENT_STATUS_CLASSES[order.payment_status]}
                      onChange={(value) => updateOrder(order.id, "payment_status", value)}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusSelect
                      value={order.order_status}
                      labels={ORDER_STATUS_LABELS}
                      className={ORDER_STATUS_CLASSES[order.order_status]}
                      onChange={(value) => updateOrder(order.id, "order_status", value)}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => setDetail(order)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{detail.invoice_number}</h2>
              <button onClick={() => setDetail(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Дата" value={new Date(detail.created_at).toLocaleString("ru-RU")} />
              <Row label="Клиент" value={detail.customer_name} />
              <Row label="Телефон" value={detail.customer_phone} />
              <Row label="Город" value={detail.customer_city} />
              <Row label="Адрес" value={detail.customer_address} />
              <Row label="Статус оплаты" value={PAYMENT_STATUS_LABELS[detail.payment_status] || detail.payment_status} />
              <Row label="Статус заказа" value={ORDER_STATUS_LABELS[detail.order_status] || detail.order_status} />
              {detail.comment && <Row label="Комментарий" value={detail.comment} />}

              <div className="border-t border-[var(--border)] pt-3 mt-3">
                <h4 className="text-xs uppercase tracking-wider text-[var(--gold)] mb-2">Товары</h4>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-4 py-1">
                    <span className="text-[var(--text-secondary)]">
                      {item.brand} {item.name} {item.volume_ml ? `${item.volume_ml}ml` : ""} x {item.quantity}
                    </span>
                    <span className="text-[var(--text-primary)] whitespace-nowrap">{formatPrice((item.price_usd ?? (item as unknown as {price:number}).price) * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--border)] pt-3 flex justify-between">
                <span className="font-semibold text-[var(--text-primary)]">Итого</span>
                <span className="font-bold text-lg text-gold-gradient">{formatPrice(detail.total_display_currency ?? detail.total_usd)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusSelect({
  value,
  labels,
  className,
  onChange,
}: {
  value: string;
  labels: Record<string, string>;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none text-xs px-3 py-1 pr-7 rounded-full cursor-pointer border-0 outline-none ${className || ""}`}
      >
        {Object.entries(labels).map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--text-primary)] text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}
