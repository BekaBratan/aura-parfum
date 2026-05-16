"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, AlertTriangle, Zap, PenLine } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useCurrencyStore } from "@/store/currencyStore";
import { formatKzt, isRateStale } from "@/lib/currency";
import { CurrencyRate } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  return `${Math.floor(hrs / 24)} д. назад`;
}

export default function AdminCurrencies() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualKzt, setManualKzt] = useState("");
  const [saving, setSaving] = useState(false);
  const fetchStoreRates = useCurrencyStore((s) => s.fetchRates);

  async function loadRates() {
    const supabase = createClient();
    const { data } = await supabase.from("currency_rates").select("*");
    setRates((data as CurrencyRate[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadRates(); }, []);

  const kztRate = rates.find((r) => r.currency_code === "KZT");
  const isManual = kztRate?.is_manual ?? false;
  const isStale = kztRate ? isRateStale(kztRate.updated_at) : false;

  // Auto-refresh from NBK (clears manual lock)
  const handleAutoRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/currencies/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Ошибка: ${data.error ?? "неизвестная ошибка"}`);
      } else {
        toast.success(`Курс обновлён: 1 USD = ${data.kzt} ₸`);
        await loadRates();
        await fetchStoreRates();
      }
    } catch {
      toast.error("Не удалось получить курс");
    } finally {
      setRefreshing(false);
    }
  };

  // Manual save — sets is_manual = true, cron won't overwrite
  const handleManualSave = async () => {
    const rate = Number(manualKzt);
    if (!rate || rate <= 0) { toast.error("Введите корректный курс"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/currencies/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate, is_manual: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Ошибка: ${data.error ?? "неизвестная ошибка"}`);
      } else {
        toast.success("Ручной курс сохранён. Авто-обновление приостановлено.");
        setManualKzt("");
        await loadRates();
        await fetchStoreRates();
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Курсы валют</h1>
      </div>

      {isStale && !isManual && (
        <div className="mb-4 flex items-center gap-2 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} />
          Курс не обновлялся более 24 часов. Обновите автоматически или введите вручную.
        </div>
      )}

      {loading ? (
        <div className="space-y-3"><div className="h-24 skeleton rounded-xl" /></div>
      ) : (
        <div className="glass-card p-5 rounded-xl border border-[var(--border)] max-w-md space-y-5">

          {/* Current rate */}
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-3">USD → KZT</p>
            {kztRate ? (
              <div className="space-y-1.5">
                <p className="text-3xl font-bold text-gold-gradient">
                  1 $ = {kztRate.rate_to_usd} ₸
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Пример: $2.50 = {formatKzt(2.5 * Number(kztRate.rate_to_usd))}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Обновлено: {timeAgo(kztRate.updated_at)}
                  {isStale && !isManual && <span className="ml-2 text-yellow-400">⚠ устарело</span>}
                </p>
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">Курс не найден</p>
            )}
          </div>

          {/* Mode indicator */}
          <div className="flex items-center gap-2 pt-1">
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              isManual
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                : "bg-green-500/15 text-green-400 border border-green-500/20"
            }`}>
              {isManual ? <PenLine size={12} /> : <Zap size={12} />}
              {isManual ? "Ручной режим" : "Авто-режим (НБК)"}
            </div>
            {isManual && (
              <span className="text-xs text-[var(--text-secondary)]">крон не перезаписывает</span>
            )}
          </div>

          {/* Auto-refresh button */}
          <div className="pt-1 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Получить актуальный курс с nationalbank.kz
              {isManual && <span className="ml-1 text-amber-400">(переключит на авто-режим)</span>}
            </p>
            <button
              onClick={handleAutoRefresh}
              disabled={refreshing}
              className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 w-full justify-center"
            >
              {refreshing
                ? <Loader2 size={15} className="animate-spin relative z-10" />
                : <RefreshCw size={15} className="relative z-10" />}
              <span>Обновить с nationalbank.kz</span>
            </button>
          </div>

          {/* Manual input */}
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              Ввести вручную
              <span className="ml-1 text-xs text-[var(--text-secondary)] opacity-70">(авто-обновление приостановится)</span>
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="1"
                value={manualKzt}
                onChange={(e) => setManualKzt(e.target.value)}
                placeholder="Например: 470.50"
                className="input-dark flex-1"
              />
              <button
                onClick={handleManualSave}
                disabled={saving || !manualKzt}
                className="btn-outline-gold px-3 py-2 rounded-lg text-sm flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-[var(--text-secondary)]">
        Авто-режим: крон обновляет курс раз в сутки (00:00 UTC) с nationalbank.kz. В ручном режиме крон пропускает обновление.
      </p>
    </div>
  );
}
