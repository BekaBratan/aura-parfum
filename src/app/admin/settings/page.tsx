"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";

interface Option {
  id: string;
  type: string;
  value: string;
  created_at: string;
}

type OptionType = "country" | "quality" | "accessory_type" | "brand";

const SECTIONS: { type: OptionType; label: string; placeholder: string; hint?: string }[] = [
  { type: "country",        label: "Страны происхождения", placeholder: "Например: Япония" },
  { type: "quality",        label: "Типы качества",        placeholder: "Например: Elite",   hint: "Используется для масел и парфюма (De Luxe, Premium...)" },
  { type: "accessory_type", label: "Виды аксессуаров",     placeholder: "Например: Диффузор", hint: "Отображается как тип на карточке аксессуара" },
  { type: "brand",          label: "Бренды",               placeholder: "Например: Dior",     hint: "Используется как подсказка при добавлении товара" },
];

function Section({
  section,
  options,
  onAdd,
  onDelete,
}: {
  section: (typeof SECTIONS)[number];
  options: Option[];
  onAdd: (type: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    await onAdd(section.type, value.trim());
    setSaving(false);
    setValue("");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">{section.label}</h2>
        {section.hint && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{section.hint}</p>}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={section.placeholder}
          className="input-dark flex-1 min-h-[38px] text-sm"
        />
        <button
          disabled={saving || !value.trim()}
          className="btn-gold px-4 rounded-lg text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 size={14} className="animate-spin relative z-10" /> : <Plus size={14} className="relative z-10" />}
          <span>Добавить</span>
        </button>
      </form>

      {/* Options list */}
      {options.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] py-3 text-center">Пусто — добавьте первый вариант</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--border)] text-sm text-[var(--text-primary)]"
            >
              <span>{opt.value}</span>
              <button
                onClick={() => handleDelete(opt.id)}
                disabled={deletingId === opt.id}
                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40 p-0.5"
              >
                {deletingId === opt.id
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { role } = useAdminRole();
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/options");
    if (!res.ok) {
      setTableExists(false);
      setLoading(false);
      return;
    }
    setOptions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleAdd = async (type: string, value: string) => {
    const res = await fetch("/api/admin/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Ошибка");
      return;
    }
    const added: Option = await res.json();
    setOptions((cur) => [...cur, added]);
    toast.success("Добавлено");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/admin/options", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { toast.error("Ошибка удаления"); return; }
    setOptions((cur) => cur.filter((o) => o.id !== id));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Настройки товаров</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Управляйте списками стран, брендов, типов — они используются при добавлении товаров.
        </p>
      </div>

      {!tableExists && (
        <div className="glass-card p-5 mb-6 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-semibold text-yellow-400 mb-2">Требуется миграция базы данных</p>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Запустите SQL из файла <code className="text-yellow-400">scripts/migration-product-options.sql</code> в Supabase Dashboard → SQL Editor.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-36 skeleton rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <Section
              key={section.type}
              section={section}
              options={options.filter((o) => o.type === section.type)}
              onAdd={handleAdd}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
