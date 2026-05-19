"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AdminRoleProvider, StaffRole } from "@/lib/adminRole";
import { LayoutDashboard, Package, ShoppingCart, LogOut, Menu, X, Users, DollarSign, ExternalLink } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
        return;
      }

      setUserEmail(data.user.email ?? null);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .in("role", ["admin", "cashier"]);

      const role = roles?.some((row) => row.role === "admin")
        ? "admin"
        : roles?.some((row) => row.role === "cashier")
        ? "cashier"
        : null;

      if (!role) {
        router.replace("/");
        return;
      }

      setStaffRole(role as StaffRole);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (staffRole === "cashier" && pathname.startsWith("/admin/staff")) {
      router.replace("/admin");
    }
  }, [pathname, router, staffRole]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!staffRole) return null;

  const links = [
    { href: "/admin", label: "Панель", icon: LayoutDashboard },
    { href: "/admin/products", label: "Товары", icon: Package },
    { href: "/admin/orders", label: "Заказы", icon: ShoppingCart },
    ...(staffRole === "admin" ? [
      { href: "/admin/staff", label: "Сотрудники", icon: Users },
      { href: "/admin/currencies", label: "Курсы валют", icon: DollarSign },
    ] : []),
  ];
  const roleLabel = staffRole === "admin" ? "Администратор" : "Кассир";

  return (
    <AdminRoleProvider role={staffRole}>
      {/* Mobile overlay */}
      {sideOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSideOpen(false)} />
      )}

      {/* Sidebar — always fixed, independent scroll */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--dark-2)] border-r border-[var(--border)] flex flex-col transition-transform duration-300 ${sideOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 flex items-center justify-between shrink-0">
          <Link href="/admin" className="text-xl font-bold text-gold-gradient" style={{ fontFamily: "'Playfair Display', serif" }}>AZ-ZAHRA Admin</Link>
          <button onClick={() => setSideOpen(false)} className="lg:hidden text-[var(--text-secondary)] cursor-pointer"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSideOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${pathname === link.href ? "bg-[var(--gold)]/10 text-[var(--gold)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"}`}
            >
              <link.icon size={18} /> {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--border)] shrink-0 space-y-1">
          {/* Current user card */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/[0.03] mb-2">
            <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] font-bold text-sm shrink-0 uppercase">
              {userEmail?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{userEmail ?? "—"}</p>
              <p className="text-[10px] text-[var(--gold)] font-medium">{roleLabel}</p>
            </div>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-full px-4 py-2"
          >
            <ExternalLink size={18} /> Главная страница
          </a>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer w-full px-4 py-2">
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>

      {/* Main content — offset by sidebar width on desktop */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className="h-16 border-b border-[var(--border)] bg-[var(--dark-2)] flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30">
          <button onClick={() => setSideOpen(true)} className="lg:hidden text-[var(--text-secondary)] cursor-pointer"><Menu size={22} /></button>
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Панель управления · {roleLabel}</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] font-bold text-xs uppercase shrink-0">
              {userEmail?.[0] ?? "?"}
            </div>
            <span className="text-xs text-[var(--text-secondary)] hidden sm:block truncate max-w-[180px]">{userEmail ?? "—"}</span>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </AdminRoleProvider>
  );
}
