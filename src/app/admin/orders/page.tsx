"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, isKztPriced } from "@/lib/utils";
import { getOrderItemDetails } from "@/lib/orderItemDetails";
import { useCurrencyStore } from "@/store/currencyStore";
import { OrderItem } from "@/types";

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

// For KZT-priced categories (accessory, original, analog) price_usd already holds KZT.
// Oil/perfume store real USD and need conversion.
function itemKzt(item: OrderItem, kztRate: number): number {
  return isKztPriced(item.category) ? item.price_usd : item.price_usd * kztRate;
}

function orderTotalKzt(items: OrderItem[], kztRate: number): number {
  return items.reduce((sum, i) => sum + itemKzt(i, kztRate) * i.quantity, 0);
}

export default function AdminOrders() {
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);

  const [search, setSearch] = useState("");
  const [filterOrderStatus, setFilterOrderStatus] = useState("all");
  const [filterPayStatus, setFilterPayStatus] = useState("all");

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
    const timeout = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterOrderStatus !== "all" && o.order_status !== filterOrderStatus) return false;
      if (filterPayStatus !== "all" && o.payment_status !== filterPayStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !o.invoice_number.toLowerCase().includes(q) &&
          !o.customer_name.toLowerCase().includes(q) &&
          !o.customer_phone.includes(q)
        ) return false;
      }
      return true;
    });
  }, [orders, search, filterOrderStatus, filterPayStatus]);

  const updateOrder = async (id: string, field: "payment_status" | "order_status", value: string) => {
    const supabase = createClient();

    // Restore stock when cancelling an order
    if (field === "order_status" && value === "cancelled") {
      const order = orders.find((o) => o.id === id);
      if (order && order.order_status !== "cancelled") {
        for (const item of order.items) {
          const { data: product } = await supabase
            .from("products")
            .select("count")
            .eq("id", item.product_id)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({ count: Number(product.count) + item.quantity })
              .eq("id", item.product_id);
          }
        }
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error("Не удалось обновить статус");
      return;
    }

    toast.success(
      field === "order_status" && value === "cancelled"
        ? "Заказ отменён. Запас товаров восстановлен."
        : "Статус обновлён"
    );
    setOrders((current) => current.map((order) => (order.id === id ? { ...order, [field]: value } : order)));
    if (detail?.id === id) {
      setDetail((current) => (current ? { ...current, [field]: value } : null));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Заказы</h1>

      {/* Search + filters */}
      <div className="admin-filter-bar">
        <div className="admin-filter-search-row">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по счёту, имени или телефону..."
              className="input-dark w-full"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer" aria-label="Очистить">
                <X size={14} />
              </button>
            )}
          </div>
          <span className="admin-filter-count">
            {filteredOrders.length === orders.length
              ? `${orders.length} заказов`
              : `${filteredOrders.length} из ${orders.length}`}
          </span>
        </div>

        <div className="admin-filter-groups">
          <div className="admin-filter-group">
            <span className="admin-filter-label">Статус</span>
            <div className="admin-filter-pills">
              <button onClick={() => setFilterOrderStatus("all")}
                className={`admin-filter-pill${filterOrderStatus === "all" ? " is-active" : ""}`}>
                Все
              </button>
              {Object.entries(ORDER_STATUS_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => setFilterOrderStatus(val)}
                  className={`admin-filter-pill${filterOrderStatus === val ? " is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-filter-divider" />

          <div className="admin-filter-group">
            <span className="admin-filter-label">Оплата</span>
            <div className="admin-filter-pills">
              <button onClick={() => setFilterPayStatus("all")}
                className={`admin-filter-pill${filterPayStatus === "all" ? " is-active" : ""}`}>
                Все
              </button>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => setFilterPayStatus(val)}
                  className={`admin-filter-pill${filterPayStatus === val ? " is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">
          {orders.length === 0 ? "Заказов пока нет" : "Ничего не найдено"}
        </p>
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
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-[var(--text-primary)] font-medium">{order.invoice_number}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{order.customer_name}</p>
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)] hidden sm:table-cell">{order.customer_phone}</td>
                  <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">{formatPrice(orderTotalKzt(order.items, kztRate))}</td>
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
                {detail.items.map((item, i) => {
                  const unitLabel = item.unit === "ml" ? `${item.quantity} мл` : `${item.quantity} шт.`;
                  const details = getOrderItemDetails(item, { includeCode: true });
                  return (
                    <div key={i} className="flex justify-between gap-4 py-2 border-b border-[var(--border)]/30 last:border-0">
                      <div className="min-w-0">
                        {item.category !== "accessory" && item.brand && (
                          <p className="text-[10px] uppercase tracking-wider text-[var(--gold)] font-bold mb-0.5">{item.brand}</p>
                        )}
                        <p className="text-[var(--text-primary)] text-sm">{item.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {details.map((d) => (
                            <span
                              key={d.key}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                d.tone === "deluxe"
                                  ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                                  : d.tone === "premium"
                                  ? "bg-purple-500/10 text-purple-300"
                                  : d.tone === "code"
                                  ? "bg-[var(--gold)]/15 text-[var(--gold)] font-mono"
                                  : "bg-white/5 text-[var(--text-secondary)]"
                              }`}
                            >
                              {d.tone === "code" ? `Код: ${d.label}` : d.label}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{unitLabel}</p>
                      </div>
                      <span className="text-[var(--text-primary)] whitespace-nowrap font-semibold">{formatPrice(itemKzt(item, kztRate) * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const subtotal = orderTotalKzt(detail.items, kztRate);
                const discountKzt = Number(detail.discount_kzt ?? 0);
                const total = Math.max(0, subtotal - discountKzt);
                return (
                  <div className="border-t border-[var(--border)] pt-3 space-y-1">
                    {discountKzt > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
                          <span>Сумма</span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        {(detail.applied_discounts ?? []).map((a) => (
                          <div key={a.discount_id} className="flex justify-between text-sm" style={{ color: "#4ade80" }}>
                            <span>{a.name}</span>
                            <span>−{formatPrice(a.amount_kzt)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="font-semibold text-[var(--text-primary)]">Итого</span>
                      <span className="font-bold text-lg text-gold-gradient">{formatPrice(total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusSelect({ value, labels, className, onChange }: {
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
          <option key={optionValue} value={optionValue}>{label}</option>
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
