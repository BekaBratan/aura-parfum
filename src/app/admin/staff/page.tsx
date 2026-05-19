"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff, KeyRound, Loader2, Trash2, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";

interface StaffRow {
  id: string;
  user_id: string;
  role: "admin" | "cashier";
  created_at: string;
  email: string | null;
}

const ROLE_LABELS: Record<StaffRow["role"], string> = {
  admin: "Администратор",
  cashier: "Кассир",
};

const ROLE_COLORS: Record<StaffRow["role"], string> = {
  admin: "bg-[var(--gold)]/15 text-[var(--gold)]",
  cashier: "bg-blue-500/10 text-blue-400",
};

export default function StaffPage() {
  const { role: myRole } = useAdminRole();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "cashier" as StaffRow["role"] });
  const [pwdModal, setPwdModal] = useState<{ id: string; user_id: string; email: string | null } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const loadStaff = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (!res.ok) { toast.error("Не удалось загрузить сотрудников"); setLoading(false); return; }
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (myRole !== "admin") { setLoading(false); return; }
    const t = window.setTimeout(() => { void loadStaff(); }, 0);
    return () => window.clearTimeout(t);
  }, [loadStaff, myRole]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) { toast.error("Укажите email"); return; }
    if (form.password.length < 6) { toast.error("Пароль минимум 6 символов"); return; }

    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email.trim(), password: form.password, role: form.role }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Не удалось создать аккаунт");
      return;
    }

    toast.success(`Аккаунт создан: ${form.email}`);
    setForm({ email: "", password: "", role: "cashier" });
    loadStaff();
  };

  const changeRole = async (id: string, newRole: StaffRow["role"]) => {
    setChangingId(id);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: newRole }),
    });
    setChangingId(null);
    if (!res.ok) { toast.error("Не удалось изменить роль"); return; }
    toast.success("Роль обновлена");
    setRows((cur) => cur.map((r) => r.id === id ? { ...r, role: newRole } : r));
  };

  const changePassword = async () => {
    if (!pwdModal) return;
    if (newPassword.length < 6) { toast.error("Пароль минимум 6 символов"); return; }
    setSavingPwd(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: pwdModal.user_id, password: newPassword }),
    });
    setSavingPwd(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Ошибка"); return; }
    toast.success("Пароль изменён");
    setPwdModal(null);
    setNewPassword("");
  };

  const removeRole = async (id: string) => {
    if (!confirm("Удалить сотрудника?")) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { toast.error("Не удалось удалить"); return; }
    toast.success("Удалено");
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  if (myRole !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Доступ запрещён</h1>
        <p className="text-sm text-[var(--text-secondary)]">Управление сотрудниками доступно только администратору.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Сотрудники</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Создавайте аккаунты и управляйте ролями.</p>
      </div>

      {/* Create user form */}
      <div className="glass-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-[var(--gold)]" />
          Новый сотрудник
        </h2>
        <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_auto]">
          <div className="form-group mb-0">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="sot@example.com"
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
            <label className="form-label">Роль</label>
            <select
              value={form.role}
              onChange={(e) => setForm((c) => ({ ...c, role: e.target.value as StaffRow["role"] }))}
              className="input-dark"
            >
              <option value="cashier">Кассир</option>
              <option value="admin">Администратор</option>
            </select>
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

      {/* Staff table */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">Сотрудников пока нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">User ID</th>
                <th className="pb-3 pr-4">Роль</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Добавлен</th>
                <th className="pb-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isChanging = changingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-[var(--text-primary)] font-medium">
                        {row.email ?? <span className="text-[var(--text-secondary)] italic text-xs">—</span>}
                      </p>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <span className="text-[var(--text-secondary)] font-mono text-xs">{row.user_id.slice(0, 8)}…</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="relative inline-block">
                        <select
                          value={row.role}
                          disabled={isChanging}
                          onChange={(e) => changeRole(row.id, e.target.value as StaffRow["role"])}
                          className={`appearance-none text-xs px-3 py-1 pr-7 rounded-full cursor-pointer border-0 outline-none font-semibold ${ROLE_COLORS[row.role]} disabled:opacity-50`}
                        >
                          <option value="cashier">{ROLE_LABELS.cashier}</option>
                          <option value="admin">{ROLE_LABELS.admin}</option>
                        </select>
                        {isChanging
                          ? <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin pointer-events-none opacity-60" />
                          : <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)] hidden md:table-cell">
                      {new Date(row.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setPwdModal({ id: row.id, user_id: row.user_id, email: row.email }); setNewPassword(""); setShowNewPwd(false); }}
                          className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                          title="Изменить пароль"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button onClick={() => removeRole(row.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Change password modal */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Изменить пароль</h2>
              <button onClick={() => setPwdModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {pwdModal.email ?? pwdModal.user_id.slice(0, 8) + "…"}
            </p>

            <div className="form-group">
              <label className="form-label">Новый пароль</label>
              <div className="relative">
                <input
                  type={showNewPwd ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && changePassword()}
                  placeholder="Минимум 6 символов"
                  className="input-dark pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setPwdModal(null)} className="btn-outline-gold flex-1 py-2.5 rounded-lg text-sm cursor-pointer">
                Отмена
              </button>
              <button onClick={changePassword} disabled={savingPwd} className="btn-gold flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {savingPwd ? <Loader2 size={15} className="animate-spin relative z-10" /> : <KeyRound size={15} className="relative z-10" />}
                <span>Сохранить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
