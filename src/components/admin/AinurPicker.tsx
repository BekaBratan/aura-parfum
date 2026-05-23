"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { AdminAinurProduct } from "@/app/api/admin/ainur-products/route";

interface AinurPickerProps {
  value: string | null;
  // Names that are already linked to other Supabase products — shown greyed-out
  // so the operator doesn't accidentally double-link them.
  takenIds?: Set<string>;
  initialSearch?: string;
  onPick: (ainur: AdminAinurProduct) => void;
  onClose: () => void;
}

export default function AinurPicker({
  value,
  takenIds,
  initialSearch = "",
  onPick,
  onClose,
}: AinurPickerProps) {
  const [list, setList] = useState<AdminAinurProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/ainur-products");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: AdminAinurProduct[]; error?: string };
        if (json.error || !json.data) throw new Error(json.error ?? "no data");
        if (!cancelled) setList(json.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.includes(q) ||
        p.code.toLowerCase().includes(q),
    );
  }, [list, search]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl bg-[var(--dark-2)] rounded-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Привязать к Ainur</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {list ? `${filtered.length} из ${list.length} товаров Ainur` : "Загрузка..."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, коду или id..."
              className="input-dark w-full pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <p className="p-6 text-sm text-red-400">Ошибка: {error}</p>
          ) : list === null ? (
            <div className="p-8 grid place-items-center text-[var(--text-secondary)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-secondary)]">Ничего не найдено</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]/40">
              {filtered.map((p) => {
                const isCurrent = p.id === value;
                const isTaken = !isCurrent && takenIds?.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      className={`w-full text-left px-5 py-3 flex items-start gap-4 cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-[var(--gold)]/10"
                          : isTaken
                          ? "opacity-60 hover:bg-white/[0.02]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.code && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] shrink-0">
                              {p.code}
                            </span>
                          )}
                          <p className="text-sm text-[var(--text-primary)] truncate">{p.name || "(без имени)"}</p>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                          id: {p.id}
                          {isCurrent && <span className="ml-2 text-[var(--gold)]">— текущая привязка</span>}
                          {isTaken && <span className="ml-2 text-amber-400">— уже привязан к другому товару</span>}
                        </p>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <p className="text-[var(--text-primary)]">{p.price.toLocaleString("ru-RU")} ₸</p>
                        <p className={`mt-0.5 ${p.stock > 0 ? "text-green-400" : "text-red-400"}`}>
                          {p.stock > 0 ? `${p.stock} шт.` : "нет"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
