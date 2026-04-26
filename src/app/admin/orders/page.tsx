"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order } from "@/types";
import { formatPrice } from "@/lib/utils";
import { ChevronDown, Eye, X } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  new: { label: "Новый", cls: "bg-blue-500/10 text-blue-400" },
  confirmed: { label: "Подтверждён", cls: "bg-yellow-500/10 text-yellow-400" },
  shipped: { label: "Отправлен", cls: "bg-purple-500/10 text-purple-400" },
  delivered: { label: "Доставлен", cls: "bg-green-500/10 text-green-400" },
  cancelled: { label: "Отменён", cls: "bg-red-500/10 text-red-400" },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);
  const supabase = createClient();

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Ошибка обновления статуса");
      return;
    }
    toast.success("Статус обновлён");
    loadOrders();
    if (detail?.id === id) {
      setDetail((d) => (d ? { ...d, status: status as Order["status"] } : null));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        Заказы
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">
          Нет заказов
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Дата</th>
                <th className="pb-3 pr-4">Клиент</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">Телефон</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Сумма</th>
                <th className="pb-3 pr-4">Статус</th>
                <th className="pb-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.new;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">
                      {new Date(o.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-primary)]">
                      {o.name}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)] hidden sm:table-cell">
                      {o.phone}
                    </td>
                    <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">
                      {formatPrice(o.total)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="relative inline-block">
                        <select
                          value={o.status}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          className={`appearance-none text-xs px-3 py-1 pr-7 rounded-full cursor-pointer border-0 outline-none ${st.cls}`}
                        >
                          {Object.entries(STATUS_MAP).map(([val, { label }]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                        />
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setDetail(o)}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Заказ
              </h2>
              <button
                onClick={() => setDetail(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Дата</span>
                <span className="text-[var(--text-primary)]">
                  {new Date(detail.created_at).toLocaleString("ru-RU")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Клиент</span>
                <span className="text-[var(--text-primary)]">{detail.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Телефон</span>
                <span className="text-[var(--text-primary)]">{detail.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Город</span>
                <span className="text-[var(--text-primary)]">{detail.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Адрес</span>
                <span className="text-[var(--text-primary)] text-right max-w-[60%]">
                  {detail.address}
                </span>
              </div>
              {detail.comment && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Комментарий</span>
                  <span className="text-[var(--text-primary)] text-right max-w-[60%]">
                    {detail.comment}
                  </span>
                </div>
              )}

              <div className="border-t border-[var(--border)] pt-3 mt-3">
                <h4 className="text-xs uppercase tracking-wider text-[var(--gold)] mb-2">
                  Товары
                </h4>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">
                      {item.brand} {item.name}{" "}
                      {item.volume_ml ? `${item.volume_ml}мл` : ""} ×{" "}
                      {item.quantity}
                    </span>
                    <span className="text-[var(--text-primary)]">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--border)] pt-3 flex justify-between">
                <span className="font-semibold text-[var(--text-primary)]">
                  Итого
                </span>
                <span className="font-bold text-lg text-gold-gradient">
                  {formatPrice(detail.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
