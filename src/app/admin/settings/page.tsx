"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock, Database, Globe, Loader2, Plus, RefreshCw, Tag, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";

const PRESET_PREFIX = "preset_";

const CATEGORY_LABELS: Record<string, string> = {
  oil: "Масла",
  perfume: "Парфюм",
  accessory: "Аксессуары",
  original: "Оригинал",
  analog: "Аналог",
};

const UNIT_LABELS: Record<string, string> = {
  ml: "мл",
  pcs: "шт",
};

function presetLabel(type: string): string {
  const parts = type.replace(PRESET_PREFIX, "").split("_");
  const unit = parts[0];
  const cat = parts.slice(1).join("_");
  const catLabel = CATEGORY_LABELS[cat] ?? cat;
  const unitLabel = UNIT_LABELS[unit] ?? unit;
  return `${catLabel} (${unitLabel})`;
}

interface CountryOption {
  id: string;
  type: string;
  value: string;
  code: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const { role } = useAdminRole();
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  // Add form
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit drafts (id → code)
  const [codeDraft, setCodeDraft] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/options");
    if (!res.ok) {
      setTableExists(false);
      setLoading(false);
      return;
    }
    const all: CountryOption[] = await res.json();
    setCountries(all.filter((o) => o.type === "country"));
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/admin/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "country",
        value: newName.trim(),
        code: newCode.trim() || null,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Ошибка");
      return;
    }
    const added: CountryOption = await res.json();
    setCountries((cur) => [...cur, added].sort((a, b) => a.value.localeCompare(b.value, "ru")));
    setNewName("");
    setNewCode("");
    toast.success("Добавлено");
  };

  const handleCodeBlur = async (opt: CountryOption) => {
    const draft = codeDraft[opt.id];
    if (draft == null) return;
    const next = draft.trim().toUpperCase();
    if (next === (opt.code ?? "")) return;
    const res = await fetch("/api/admin/options", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: opt.id, code: next || null }),
    });
    if (!res.ok) { toast.error("Не удалось сохранить код"); return; }
    const updated: CountryOption = await res.json();
    setCountries((cur) => cur.map((o) => (o.id === updated.id ? updated : o)));
    setCodeDraft((cur) => {
      const { [opt.id]: _gone, ...rest } = cur;
      return rest;
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch("/api/admin/options", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    if (!res.ok) { toast.error("Ошибка удаления"); return; }
    setCountries((cur) => cur.filter((o) => o.id !== id));
    toast.success("Удалено");
  };

  if (role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Доступ запрещён</h1>
        <p className="text-sm text-[var(--text-secondary)]">Настройки доступны только администратору.</p>
    </div>
  );
}

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 grid place-items-center text-[var(--gold)]">
          <Globe size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Настройки стран</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Названия стран и их 2-буквенные коды для бейджа на карточке товара.
          </p>
        </div>
      </div>

      {!tableExists && (
        <div className="glass-card p-5 mb-6 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-semibold text-yellow-400 mb-2">Требуется миграция базы данных</p>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Запустите SQL из файла <code className="text-yellow-400">scripts/migration-product-options.sql</code>{" "}
            и <code className="text-yellow-400">supabase/migrations/product_options_code.sql</code>{" "}
            в Supabase Dashboard → SQL Editor.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
      ) : (
        <div className="glass-card p-5">
          {/* Add new country */}
          <form onSubmit={handleAdd} className="settings-add-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название страны (например, Япония)"
              className="input-dark settings-name-input"
            />
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="JP"
              maxLength={3}
              className="input-dark settings-code-input"
            />
            <button
              disabled={adding || !newName.trim()}
              className="btn-gold settings-add-btn"
            >
              {adding ? <Loader2 size={14} className="animate-spin relative z-10" /> : <Plus size={14} className="relative z-10" />}
              <span className="relative z-10">Добавить</span>
            </button>
          </form>

          {/* Country list */}
          {countries.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
              Список пуст — добавьте первую страну
            </p>
          ) : (
            <ul className="settings-country-list">
              {countries.map((opt) => {
                const displayed = codeDraft[opt.id] ?? opt.code ?? "";
                const isDirty = codeDraft[opt.id] != null && codeDraft[opt.id] !== (opt.code ?? "");
                return (
                  <li key={opt.id} className="settings-country-row">
                    <div className="settings-country-code">
                      <input
                        value={displayed}
                        onChange={(e) =>
                          setCodeDraft((prev) => ({ ...prev, [opt.id]: e.target.value.toUpperCase() }))
                        }
                        onBlur={() => handleCodeBlur(opt)}
                        placeholder="—"
                        maxLength={3}
                        className={`settings-code-edit${isDirty ? " is-dirty" : ""}${!opt.code ? " is-empty" : ""}`}
                      />
                    </div>
                    <span className="settings-country-name">{opt.value}</span>
                    <button
                      onClick={() => handleDelete(opt.id)}
                      disabled={deletingId === opt.id}
                      className="settings-delete-btn"
                      aria-label="Удалить"
                    >
                      {deletingId === opt.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-10 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 grid place-items-center text-[var(--gold)]">
          <Tag size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Пресеты для карточек</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Значения кнопок на карточках товаров (мл / шт).
          </p>
        </div>
      </div>

      <PresetsEditor />

      <StockSyncSection />
    </div>
  );
}

function PresetsEditor() {
  const [items, setItems] = useState<Array<{ id: string; type: string; value: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [deletingValue, setDeletingValue] = useState<Record<string, boolean>>({});
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  // New type form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCat, setNewCat] = useState("oil");
  const [newUnit, setNewUnit] = useState("ml");
  const [newVal, setNewVal] = useState("");
  const [newTypeAdding, setNewTypeAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/options");
    if (!res.ok) { setLoading(false); return; }
    const all: Array<{ id: string; type: string; value: string }> = await res.json();
    setItems(all.filter((o) => o.type.startsWith(PRESET_PREFIX)));
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const types = useMemo(() => {
    const map = new Map<string, Array<{ id: string; type: string; value: string }>>();
    for (const item of items) {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type)!.push(item);
    }
    for (const [, vals] of map) vals.sort((a, b) => parseInt(a.value) - parseInt(b.value));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const handleAddValue = async (type: string) => {
    const val = inputs[type]?.trim();
    if (!val || isNaN(parseInt(val))) return;
    setAdding((cur) => ({ ...cur, [type]: true }));
    const res = await fetch("/api/admin/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: val }),
    });
    setAdding((cur) => ({ ...cur, [type]: false }));
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Ошибка"); return; }
    const added = await res.json();
    setItems((cur) => [...cur, added]);
    setInputs((cur) => ({ ...cur, [type]: "" }));
    toast.success("Добавлено");
  };

  const handleDeleteValue = async (id: string) => {
    setDeletingValue((cur) => ({ ...cur, [id]: true }));
    const res = await fetch("/api/admin/options", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingValue((cur) => ({ ...cur, [id]: false }));
    if (!res.ok) { toast.error("Ошибка удаления"); return; }
    setItems((cur) => cur.filter((o) => o.id !== id));
    toast.success("Удалено");
  };

  const handleDeleteType = async (type: string) => {
    if (!window.confirm(`Удалить весь тип "${presetLabel(type)}" и все его значения?`)) return;
    setDeletingType(type);
    const res = await fetch("/api/admin/options", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setDeletingType(null);
    if (!res.ok) { toast.error("Ошибка удаления"); return; }
    setItems((cur) => cur.filter((o) => o.type !== type));
    toast.success("Тип удалён");
  };

  const handleNewType = async () => {
    const type = `${PRESET_PREFIX}${newUnit}_${newCat}`;
    const val = newVal.trim();
    if (!val || isNaN(parseInt(val))) { toast.error("Введите начальное значение"); return; }
    setNewTypeAdding(true);
    const res = await fetch("/api/admin/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: val }),
    });
    setNewTypeAdding(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Ошибка"); return; }
    const added = await res.json();
    setItems((cur) => [...cur, added]);
    setShowNewForm(false);
    setNewVal("");
    toast.success(`Тип "${presetLabel(type)}" создан`);
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>;
  }

  return (
    <div className="glass-card p-5 space-y-5">
      {types.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
          Нет пресетов — создайте первый
        </p>
      )}

      {types.map(([type, vals]) => (
        <div key={type} className="pb-4 border-b border-[var(--border)] last:border-b-0 last:pb-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">{presetLabel(type)}</p>
            <button
              onClick={() => handleDeleteType(type)}
              disabled={deletingType === type}
              className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 transition-colors flex items-center gap-1"
            >
              {deletingType === type
                ? <Loader2 size={12} className="animate-spin" />
                : <X size={12} />}
              Удалить тип
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {vals.map((v) => (
              <div key={v.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--gold)]/10 text-[var(--gold-dark)] text-sm font-semibold">
                {v.value}
                <button
                  onClick={() => handleDeleteValue(v.id)}
                  disabled={deletingValue[v.id]}
                  className="ml-0.5 hover:text-[var(--color-danger)] transition-colors"
                >
                  {deletingValue[v.id]
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={inputs[type] ?? ""}
              onChange={(e) => setInputs((cur) => ({ ...cur, [type]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddValue(type); } }}
              placeholder="Новое значение"
              type="number"
              min="1"
              className="input-dark settings-name-input"
              style={{ width: 140 }}
            />
            <button
              onClick={() => handleAddValue(type)}
              disabled={adding[type] || !inputs[type]?.trim()}
              className="btn-gold settings-add-btn"
            >
              {adding[type]
                ? <Loader2 size={14} className="animate-spin relative z-10" />
                : <Plus size={14} className="relative z-10" />}
              <span className="relative z-10">Добавить</span>
            </button>
          </div>
        </div>
      ))}

      <div className="pt-2">
        {showNewForm ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="input-dark"
              style={{ width: 140, height: 40, padding: "0 10px" }}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="input-dark"
              style={{ width: 80, height: 40, padding: "0 10px" }}
            >
              {Object.entries(UNIT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNewType(); } }}
              placeholder="Первое значение"
              type="number"
              min="1"
              className="input-dark settings-name-input"
              style={{ width: 140 }}
            />
            <button
              onClick={handleNewType}
              disabled={newTypeAdding || !newVal.trim()}
              className="btn-gold settings-add-btn"
            >
              {newTypeAdding
                ? <Loader2 size={14} className="animate-spin relative z-10" />
                : <Plus size={14} className="relative z-10" />}
              <span className="relative z-10">Создать</span>
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="btn-ghost"
              style={{ height: 40 }}
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-gold settings-add-btn"
          >
            <Plus size={14} />
            <span>Добавить категорию</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface SyncLogEntry {
  id: number;
  triggered_by: string;
  admin_email: string | null;
  total_products: number;
  updated_count: number;
  errors: unknown[] | null;
  created_at: string;
}

function StockSyncSection() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    const res = await fetch("/api/stock/sync");
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setLogs(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(t);
  }, [loadLogs]);

  const handleSync = async () => {
    setSyncing(true);
    const res = await fetch("/api/stock/sync", { method: "POST" });
    setSyncing(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Ошибка синхронизации");
      return;
    }
    const result = await res.json();
    const msg = result.errors?.length
      ? `Обновлено ${result.updated} из ${result.total}. Ошибок: ${result.errors.length}`
      : `Обновлено ${result.updated} из ${result.total}`;
    toast.success(msg);
    await loadLogs();
  };

  const last = logs[0];

  return (
    <>
      <div className="mt-10 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 grid place-items-center text-[var(--gold)]">
          <Database size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Синхронизация стока</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Копирование остатков из AinurPOS в Supabase
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            {loading ? (
              <div className="h-4 w-48 skeleton rounded" />
            ) : last ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Clock size={14} />
                <span>
                  Последняя синхронизация:{" "}
                  {new Date(last.created_at).toLocaleString("ru-RU")}
                </span>
                {last.errors?.length ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <X size={14} /> {last.errors.length} ошибок
                  </span>
                ) : (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle size={14} /> {last.updated_count} из {last.total_products}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Синхронизация ещё не выполнялась
              </p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-gold"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin relative z-10" />
            ) : (
              <RefreshCw size={14} className="relative z-10" />
            )}
            <span className="relative z-10">Синхронизировать</span>
          </button>
        </div>

        {logs.length > 1 && (
          <details className="text-xs text-[var(--text-secondary)]">
            <summary className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              История синхронизаций ({logs.length})
            </summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {logs.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/[0.03]">
                  <span>{new Date(entry.created_at).toLocaleString("ru-RU")}</span>
                  <span className={entry.errors?.length ? "text-red-400" : "text-green-400"}>
                    {entry.updated_count}/{entry.total_products}
                    {entry.errors?.length ? ` (${entry.errors.length} ошиб.)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
