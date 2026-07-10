"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Eye, Loader2, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { confirmPaymentAndSync } from "@/lib/actions/confirmPaymentAndSync";
import { Order } from "@/types";
import { formatPrice, isKztPriced } from "@/lib/utils";
import { getOrderItemDetails } from "@/lib/orderItemDetails";
import { useCurrencyStore } from "@/store/currencyStore";
import { OrderItem } from "@/types";

const STATUS_OPTIONS: Record<string, { label: string; className: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", className: "bg-yellow-500/10 text-yellow-400" },
  paid: { label: "Оплачено (выполнен)", className: "bg-green-500/10 text-green-400" },
  failed: { label: "Ошибка заказа", className: "bg-red-500/10 text-red-400" },
  cancelled: { label: "Отменён", className: "bg-red-500/10 text-red-400" },
};

function deriveStatus(order: Order): { key: string; label: string; className: string } {
  if (order.order_status === "cancelled" || order.payment_status === "refunded")
    return { key: "cancelled", ...STATUS_OPTIONS.cancelled };
  if (order.payment_status === "paid") return { key: "paid", ...STATUS_OPTIONS.paid };
  if (order.payment_status === "pending_payment") return { key: "awaiting_payment", ...STATUS_OPTIONS.awaiting_payment };
  if (order.payment_status === "failed") return { key: "failed", ...STATUS_OPTIONS.failed };
  return { key: "awaiting_payment", ...STATUS_OPTIONS.awaiting_payment };
}

const DROPDOWN_LABELS: Record<string, string> = {
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачено (выполнен)",
  cancelled: "Отменён",
  failed: "Ошибка заказа",
};

const FILTER_OPTIONS = [
  { key: "all", label: "Все" },
  { key: "awaiting_payment", label: "Ожидают" },
  { key: "paid", label: "Выполнен" },
  { key: "failed", label: "Ошибка" },
  { key: "cancelled", label: "Отменён" },
];

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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

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
      const st = deriveStatus(o);
      if (filterStatus !== "all" && st.key !== filterStatus) return false;
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        if (new Date(o.created_at) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(o.created_at) >= to) return false;
      }
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
  }, [orders, search, filterStatus, filterDateFrom, filterDateTo]);

  const handleStatusChange = async (order: Order, value: string) => {
    if (value === "paid") {
      if (!confirm(`Подтвердить оплату заказа ${order.invoice_number} и синхронизировать с AinurPOS?`)) return;
      const result = await confirmPaymentAndSync(order.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Оплата подтверждена и синхронизирована с AinurPOS");
      }
      await loadOrders();
      return;
    }
    if (value === "cancelled") {
      if (!confirm(`Отменить заказ ${order.invoice_number}? Запас товаров будет восстановлен.`)) return;
      const supabase = createClient();
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
      const { error } = await supabase
        .from("orders")
        .update({ order_status: "cancelled", payment_status: "refunded" })
        .eq("id", order.id);
      if (error) {
        toast.error("Не удалось отменить заказ");
      } else {
        toast.success("Заказ отменён. Запас товаров восстановлен.");
      }
      await loadOrders();
      return;
    }
    if (value === order.payment_status || value === order.order_status) return;
    const lookup: Record<string, { payment?: string; order?: string }> = {
      awaiting_payment: { payment: "pending_payment", order: "new" },
      failed: { payment: "failed" },
    };
    const mapping = lookup[value];
    if (!mapping) return;
    let updatePayload: Record<string, string> = {};
    if (mapping.payment) updatePayload.payment_status = mapping.payment;
    if (mapping.order) updatePayload.order_status = mapping.order;
    const supabase = createClient();
    const { error } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
    if (error) {
      toast.error("Не удалось обновить статус");
      return;
    }
    toast.success("Статус обновлён");
    setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, ...updatePayload } : o)));
    if (detail?.id === order.id) {
      setDetail((current) => (current ? { ...current, ...updatePayload } : null));
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
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setFilterStatus(key)}
                  className={`admin-filter-pill${filterStatus === key ? " is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-filter-divider" />

          <div className="admin-filter-group">
            <span className="admin-filter-label">Дата</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="input-dark text-xs py-1.5 px-2"
                title="От"
              />
              <span className="text-xs text-[var(--text-secondary)]">—</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="input-dark text-xs py-1.5 px-2"
                title="До"
              />
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                  className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
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
                <th className="pb-1.5 pr-3 whitespace-nowrap">Счёт</th>
                <th className="pb-1.5 pr-3 whitespace-nowrap hidden sm:table-cell">Телефон</th>
                <th className="pb-1.5 pr-3 whitespace-nowrap hidden md:table-cell">Сумма</th>
                <th className="pb-1.5 pr-3 whitespace-nowrap">Статус</th>
                <th className="pb-1.5 pr-3 whitespace-nowrap hidden lg:table-cell">Дата</th>
                <th className="pb-1.5 whitespace-nowrap text-right">Подробнее</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const status = deriveStatus(order);
                return (
                  <tr key={order.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 pr-3">
                      <p className="text-[var(--text-primary)] font-medium">{order.invoice_number}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{order.customer_name}</p>
                    </td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)] hidden sm:table-cell">{order.customer_phone}</td>
                    <td className="py-2 pr-3 text-[var(--gold)] hidden md:table-cell whitespace-nowrap">{formatPrice(orderTotalKzt(order.items, order.kzt_rate ?? kztRate))}</td>
                    <td className="py-2 pr-3">
                      <StatusSelect
                        value={status.key}
                        labels={DROPDOWN_LABELS}
                        className={status.className}
                        disabled={syncingId === order.id}
                        onChange={(value) => handleStatusChange(order, value)}
                      />
                    </td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)] hidden lg:table-cell whitespace-nowrap text-xs">
                      {new Date(order.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => setDetail(order)} className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-white/[0.03]">
                        <Eye size={14} />
                        <span>Детали</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{detail.invoice_number}</h2>
                <a href={`/invoice/${detail.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:text-[var(--gold-light)] transition-colors" title="Открыть страницу счёта">
                  <ExternalLink size={16} />
                </a>
              </div>
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
              <Row label="Статус" value={deriveStatus(detail).label} />
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
                      <span className="text-[var(--text-primary)] whitespace-nowrap font-semibold">{formatPrice(itemKzt(item, detail.kzt_rate ?? kztRate) * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const subtotal = orderTotalKzt(detail.items, detail.kzt_rate ?? kztRate);
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

function StatusSelect({ value, labels, className, disabled, onChange }: {
  value: string;
  labels: Record<string, string>;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`appearance-none text-xs px-3 py-1 pr-7 rounded-full border-0 outline-none ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className || ""}`}
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
