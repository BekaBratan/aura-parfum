"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Trash2, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";
import { createClientAccount } from "@/lib/actions/createClientAccount";
import {
  listClientAccounts,
  updateClientAccount,
  removeClientAccount,
  ClientAccountRow,
} from "@/lib/actions/clientAccounts";

export default function ClientsPage() {
  const { role: myRole } = useAdminRole();
  const [rows, setRows] = useState<ClientAccountRow[]>([]);
  const [loading, setLoading] = useState(myRole !== "admin");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    discount_percent: "0",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClientAccountRow | null>(null);

  const loadClients = useCallback(async () => {
    const res = await listClientAccounts();
    if (!res.ok) {
      toast.error(res.error || "Не удалось загрузить клиентов");
      setLoading(false);
      return;
    }
    setRows(res.clients);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (myRole !== "admin") return;
    const t = window.setTimeout(() => {
      void loadClients();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadClients, myRole]);

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error("Укажите email");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Пароль минимум 6 символов");
      return;
    }

    setSaving(true);
    const res = await createClientAccount({
      email: form.email.trim(),
      password: form.password,
      name: form.name,
      phone: form.phone,
      discount_percent: Number(form.discount_percent) || 0,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error || "Не удалось создать аккаунт");
      return;
    }

    toast.success(`Клиент создан: ${form.email}`);
    setForm({ email: "", password: "", name: "", phone: "", discount_percent: "0" });
    setShowPassword(false);
    void loadClients();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingId(editing.id);
    const res = await updateClientAccount({
      id: editing.id,
      discount_percent: Number(editing.discount_percent) || 0,
      name: editing.full_name,
      phone: editing.phone,
    });
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.error || "Не удалось обновить");
      return;
    }
    toast.success("Клиент обновлён");
    setEditing(null);
    void loadClients();
  };

  const removeClient = async (row: ClientAccountRow) => {
    if (!window.confirm(`Удалить клиента ${row.email ?? row.id.slice(0, 8)}?`)) return;
    setSavingId(row.id);
    const res = await removeClientAccount(row.id);
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.error || "Не удалось удалить");
      return;
    }
    toast.success("Клиент удалён");
    setRows((cur) => cur.filter((r) => r.id !== row.id));
  };

  if (myRole !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Доступ запрещён</h1>
        <p className="text-sm text-[var(--text-secondary)]">Управление клиентами доступно только администратору.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Клиенты</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Создавайте клиентские аккаунты с персональной скидкой.</p>
      </div>

      {/* Create client form */}
      <div className="glass-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-[var(--gold)]" />
          Новый клиент
        </h2>
        <form onSubmit={createClient} className="grid gap-3 md:grid-cols-2">
          <div className="form-group mb-0">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="client@example.com"
              className="input-dark"
              autoComplete="off"
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                placeholder="Минимум 6 символов"
                className="input-dark pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Имя</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="Имя клиента"
              className="input-dark"
              autoComplete="off"
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Телефон</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+7 (777) 777 7777"
              className="input-dark"
              autoComplete="off"
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label">Скидка, %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.discount_percent}
              onChange={(e) => setForm((c) => ({ ...c, discount_percent: e.target.value }))}
              placeholder="0"
              className="input-dark"
            />
          </div>

          <div className="form-group mb-0 flex items-end">
            <button
              disabled={saving}
              className="btn-gold w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving
                ? <Loader2 size={16} className="animate-spin relative z-10" />
                : <UserPlus size={16} className="relative z-10" />}
              <span>Создать</span>
            </button>
          </div>
        </form>
      </div>

      {/* Clients table */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">Клиентов пока нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">Имя</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Телефон</th>
                <th className="pb-3 pr-4">Скидка</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Добавлен</th>
                <th className="pb-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <p className="text-[var(--text-primary)] font-medium">
                      {row.email ?? <span className="text-[var(--text-secondary)] italic text-xs">—</span>}
                    </p>
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell text-[var(--text-secondary)]">
                    {row.full_name ?? "—"}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell text-[var(--text-secondary)]">
                    {row.phone ?? "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="bg-[var(--gold)]/15 text-[var(--gold)] text-xs px-3 py-1 rounded-full font-semibold">
                      {row.discount_percent}%
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)] hidden md:table-cell">
                    {new Date(row.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing({ ...row })}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                        title="Редактировать"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => removeClient(row)}
                        disabled={savingId === row.id}
                        className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {savingId === row.id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Редактировать клиента</h2>
              <button onClick={() => setEditing(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {editing.email ?? editing.id.slice(0, 8) + "…"}
            </p>

            <div className="space-y-3">
              <div className="form-group">
                <label className="form-label">Имя</label>
                <input
                  type="text"
                  value={editing.full_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                  className="input-dark"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Телефон</label>
                <input
                  type="tel"
                  value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="input-dark"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Скидка, %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editing.discount_percent}
                  onChange={(e) => setEditing({ ...editing, discount_percent: Number(e.target.value) })}
                  className="input-dark"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="btn-outline-gold flex-1 py-2.5 rounded-lg text-sm cursor-pointer">
                Отмена
              </button>
              <button
                onClick={saveEdit}
                disabled={savingId === editing.id}
                className="btn-gold flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingId === editing.id
                  ? <Loader2 size={15} className="animate-spin relative z-10" />
                  : <Pencil size={15} className="relative z-10" />}
                <span>Сохранить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
