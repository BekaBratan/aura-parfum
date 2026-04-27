"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";
import { createClient } from "@/lib/supabase/client";

interface StaffRoleRow {
  id: string;
  user_id: string;
  role: "admin" | "cashier";
  created_at: string;
}

const ROLE_LABELS: Record<StaffRoleRow["role"], string> = {
  admin: "Администратор",
  cashier: "Кассир",
};

export default function StaffPage() {
  const { role } = useAdminRole();
  const [rows, setRows] = useState<StaffRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ user_id: string; role: StaffRoleRow["role"] }>({
    user_id: "",
    role: "cashier",
  });

  const loadStaff = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Не удалось загрузить сотрудников");
      setLoading(false);
      return;
    }

    setRows((data as StaffRoleRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role !== "admin") {
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadStaff();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadStaff, role]);

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "admin") return;
    if (!form.user_id.trim()) {
      toast.error("Укажите user_id");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("user_roles").insert({
      user_id: form.user_id.trim(),
      role: form.role,
    });

    setSaving(false);

    if (error) {
      toast.error("Не удалось добавить роль");
      return;
    }

    toast.success("Роль добавлена");
    setForm({ user_id: "", role: "cashier" });
    loadStaff();
  };

  const removeRole = async (id: string) => {
    if (role !== "admin") return;
    if (!confirm("Удалить роль сотрудника?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("user_roles").delete().eq("id", id);

    if (error) {
      toast.error("Не удалось удалить роль");
      return;
    }

    toast.success("Роль удалена");
    setRows((current) => current.filter((row) => row.id !== id));
  };

  if (role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Доступ запрещен</h1>
        <p className="text-sm text-[var(--text-secondary)]">Управление сотрудниками доступно только администратору.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Сотрудники</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          Для добавления роли укажите user_id из Supabase Authentication Users.
        </p>
      </div>

      <form onSubmit={addRole} className="glass-card p-4 mb-6 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input
          value={form.user_id}
          onChange={(e) => setForm((current) => ({ ...current, user_id: e.target.value }))}
          placeholder="user_id"
          className="input-dark"
        />
        <select
          value={form.role}
          onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as StaffRoleRow["role"] }))}
          className="input-dark"
        >
          <option value="cashier">Кассир</option>
          <option value="admin">Администратор</option>
        </select>
        <button disabled={saving} className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin relative z-10" /> : <Plus size={16} className="relative z-10" />}
          <span>Добавить</span>
        </button>
      </form>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">Сотрудников пока нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">user_id</th>
                <th className="pb-3 pr-4">Роль</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Дата</th>
                <th className="pb-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4 text-[var(--text-primary)] font-mono text-xs">{row.user_id}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{ROLE_LABELS[row.role]}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)] hidden md:table-cell">
                    {new Date(row.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => removeRole(row.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
