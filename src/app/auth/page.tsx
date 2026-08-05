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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Неверный email или пароль");
      setLoading(false);
      return;
    }
    toast.success("Добро пожаловать!");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    router.push(profile?.role === "client" ? "/" : "/admin");
  };

  return (
    <div className="auth-layout">
      <div className="card auth-card">
        <div className="auth-title">
          <h1>AZ-ZAHRA</h1>
          <p>Вход в панель управления</p>
        </div>

        <form onSubmit={handleLogin} className="checkout-form">
          <label className="form-field">
            <span className="form-label">Телефон или Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@az-zahra.kz"
              className="input"
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              required
            />
          </label>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
