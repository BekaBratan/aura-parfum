"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Search, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { confirmPaymentAndSync } from "@/lib/actions/confirmPaymentAndSync";
import type { Order } from "@/types";
import { formatPrice, isKztPriced } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currencyStore";
import type { OrderItem } from "@/types";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", className: "bg-yellow-500/10 text-yellow-400" },
  paid: { label: "Оплачено (выполнен)", className: "bg-green-500/10 text-green-400" },
  failed: { label: "Ошибка заказа", className: "bg-red-500/10 text-red-400" },
  cancelled: { label: "Отменён", className: "bg-red-500/10 text-red-400" },
};

function deriveStatus(order: Order): string {
  if (order.order_status === "cancelled" || order.payment_status === "refunded") return "cancelled";
  if (order.payment_status === "paid") return "paid";
  if (order.payment_status === "pending_payment") return "awaiting_payment";
  if (order.payment_status === "failed") return "failed";
  return "awaiting_payment";
}

function itemKzt(item: OrderItem, kztRate: number): number {
  return isKztPriced(item.category) ? item.price_usd : item.price_usd * kztRate;
}

function orderTotalKzt(items: OrderItem[], kztRate: number): number {
  return items.reduce((sum, i) => sum + itemKzt(i, kztRate) * i.quantity, 0);
}

export default function QuickOrderActions() {
  const kztRate = useCurrencyStore((s) => s.kztRate);
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) { toast.error("Введите номер счёта"); return; }
    setSearching(true);
    setSelected(null);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .ilike("invoice_number", `%${q}%`)
        .order("created_at", { ascending: false });

      const found = (data as Order[]) || [];
      setOrders(found);
      if (found.length === 0) toast.error("Заказ не найден");
      else if (found.length === 1) setSelected(found[0]);
    } catch {
      toast.error("Ошибка поиска");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const refetchOrder = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("orders").select("*").eq("id", id).single();
    if (data) setSelected(data as Order);
  };

  const handleConfirm = async (order: Order) => {
    if (!confirm(`Подтвердить оплату заказа ${order.invoice_number}?`)) return;
    setSyncingId(order.id);
    const result = await confirmPaymentAndSync(order.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Оплата подтверждена");
    }
    await refetchOrder(order.id);
    setSyncingId(null);
  };

  const handleError = async (order: Order) => {
    if (!confirm(`Отметить заказ ${order.invoice_number} как ошибку заказа?`)) return;
    setSyncingId(order.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);
    if (error) {
      toast.error("Не удалось обновить статус");
    } else {
      toast.success("Заказ отмечен как ошибка");
    }
    await refetchOrder(order.id);
    setSyncingId(null);
  };

  const handleCancel = async (order: Order) => {
    if (!confirm(`Отменить заказ ${order.invoice_number}?`)) return;
    setSyncingId(order.id);
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
      toast.success("Заказ отменён");
    }
    await refetchOrder(order.id);
    setSyncingId(null);
  };

  const isSyncing = syncingId !== null;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">Быстрые действия</h1>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Номер счёта"
          className="input-dark flex-1 text-base"
          autoFocus
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="btn-gold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Найти
        </button>
      </div>

      {/* Order list (multiple results) */}
      {orders && orders.length > 1 && !selected && (
        <div className="space-y-2 mb-6">
          <p className="text-xs text-[var(--text-secondary)] mb-2">Найдено {orders.length} заказов:</p>
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o)}
              className="w-full text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--dark-2)] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">{o.invoice_number}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{o.customer_name} · {o.customer_phone}</p>
            </button>
          ))}
        </div>
      )}

      {/* Selected order detail */}
      {selected && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">{selected.invoice_number}</h2>
                <a href={`/invoice/${selected.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:text-[var(--gold-light)] transition-colors" title="Открыть страницу счёта">
                  <ExternalLink size={15} />
                </a>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${STATUS_LABELS[deriveStatus(selected)].className}`}>
                {STATUS_LABELS[deriveStatus(selected)].label}
              </span>
            </div>
          </div>

          {/* Customer info */}
          <div className="px-4 py-3 border-b border-[var(--border)] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Клиент</span>
              <span className="text-sm text-[var(--text-primary)] font-medium">{selected.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Телефон</span>
              <span className="text-sm text-[var(--text-primary)]">{selected.customer_phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Город</span>
              <span className="text-sm text-[var(--text-primary)]">{selected.customer_city}</span>
            </div>
            {selected.customer_address && (
              <div className="flex justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Адрес</span>
                <span className="text-sm text-[var(--text-primary)] text-right max-w-[60%]">{selected.customer_address}</span>
              </div>
            )}
            {selected.comment && (
              <div className="flex justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Комментарий</span>
                <span className="text-sm text-[var(--text-primary)] text-right max-w-[60%]">{selected.comment}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] mb-2">Товары</p>
            <div className="space-y-2">
              {selected.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] truncate">{item.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.brand} · {item.unit === "ml" ? `${item.volume_ml ?? item.quantity} мл` : `${item.quantity} шт.`}
                    </p>
                  </div>
                  <span className="text-sm text-[var(--gold)] font-medium ml-3 shrink-0">
                    {formatPrice(itemKzt(item, kztRate) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Итого</span>
              <span className="text-lg font-bold text-gold-gradient">{formatPrice(orderTotalKzt(selected.items, kztRate))}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-3">
            {selected.payment_status === "pending_payment" && (
              <button
                onClick={() => handleConfirm(selected)}
                disabled={isSyncing}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : null}
                {isSyncing ? "Синхронизация..." : "Подтвердить оплату"}
              </button>
            )}

            {selected.payment_status === "pending_payment" && (
              <button
                onClick={() => handleError(selected)}
                disabled={isSyncing}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : null}
                <AlertTriangle size={16} />
                Ошибка заказа
              </button>
            )}

            {selected.payment_status === "pending_payment" && (
              <button
                onClick={() => handleCancel(selected)}
                disabled={isSyncing}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : null}
                <XCircle size={16} />
                Отменить заказ
              </button>
            )}

            {selected.payment_status === "paid" && (
              <div className="text-center text-xs text-[var(--text-secondary)] py-2">
                Заказ оплачен и выполнен
              </div>
            )}
            {(selected.payment_status === "failed" || selected.order_status === "cancelled") && (
              <div className="text-center text-xs text-[var(--text-secondary)] py-2">
                Заказ {selected.order_status === "cancelled" ? "отменён" : "отмечен как ошибка"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orders && orders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-secondary)]">Заказ с таким номером не найден</p>
        </div>
      )}
    </div>
  );
}
