"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, AlertTriangle } from "lucide-react";
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

  const handleAutoRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/currencies/refresh");
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

  const handleManualSave = async () => {
    const rate = Number(manualKzt);
    if (!rate || rate <= 0) { toast.error("Введите корректный курс"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("currency_rates")
      .update({ rate_to_usd: rate, updated_at: new Date().toISOString() })
      .eq("currency_code", "KZT");
    setSaving(false);
    if (error) { toast.error("Ошибка сохранения"); return; }
    toast.success("Курс сохранён вручную");
    setManualKzt("");
    await loadRates();
    await fetchStoreRates();
  };

  const kztRate = rates.find((r) => r.currency_code === "KZT");
  const isStale = kztRate ? isRateStale(kztRate.updated_at) : false;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Курсы валют</h1>
        <button
          onClick={handleAutoRefresh}
          disabled={refreshing}
          className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {refreshing
            ? <Loader2 size={15} className="animate-spin relative z-10" />
            : <RefreshCw size={15} className="relative z-10" />}
          <span>Обновить с frankfurter.app</span>
        </button>
      </div>

      {isStale && (
        <div className="mb-4 flex items-center gap-2 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} />
          Курс не обновлялся более 24 часов. Нажмите «Обновить» или введите вручную.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1].map((i) => <div key={i} className="h-24 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="glass-card p-5 rounded-xl border border-[var(--border)] max-w-md">
          <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-3">USD → KZT</p>

          {kztRate ? (
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gold-gradient">
                1 $ = {kztRate.rate_to_usd} ₸
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Пример: $2.50 = {formatKzt(2.5 * Number(kztRate.rate_to_usd))}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Обновлено: {timeAgo(kztRate.updated_at)}
                {isStale && <span className="ml-2 text-yellow-400">⚠ устарело</span>}
              </p>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)]">Курс не найден</p>
          )}

          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--text-secondary)] mb-2">Ввести вручную (если API недоступен)</p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="1"
                value={manualKzt}
                onChange={(e) => setManualKzt(e.target.value)}
                placeholder="Например: 465.50"
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
        Курс обновляется автоматически каждые 4 часа через Vercel Cron → /api/currencies/refresh.
      </p>
    </div>
  );
}
