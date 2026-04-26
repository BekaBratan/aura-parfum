"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Неверный email или пароль");
      setLoading(false);
      return;
    }
    toast.success("Добро пожаловать!");
    router.push("/admin");
  };

  return (
    <div className="pt-24 pb-16 flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gold-gradient mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            AURA
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">Вход в панель управления</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card p-6 space-y-4">
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@aura.kz" className="input-dark" required />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-dark" required />
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin relative z-10" /> : <LogIn size={18} className="relative z-10" />}
            <span>{loading ? "Вход..." : "Войти"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
