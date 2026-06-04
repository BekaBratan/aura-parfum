"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";

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
    </div>
  );
}
