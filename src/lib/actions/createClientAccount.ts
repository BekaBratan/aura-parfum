"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type CreateClientAccountInput = {
  email: string;
  password: string;
  name: string;
  phone: string;
  discount_percent: number;
};

// Admin-only: creates an auth user via the service-role admin API (so the
// admin's own session is never touched) and registers the matching profile
// with role = 'client' and the personal discount.
export async function createClientAccount(
  input: CreateClientAccountInput,
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован" };

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin") return { ok: false, error: "Доступ запрещён" };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Некорректный email" };
  if (!input.password || input.password.length < 6) return { ok: false, error: "Пароль минимум 6 символов" };

  const discount = Math.round(Number(input.discount_percent) || 0);
  if (discount < 0 || discount > 100) return { ok: false, error: "Скидка должна быть от 0 до 100%" };

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (createError) return { ok: false, error: createError.message };

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      role: "client",
      discount_percent: discount,
      full_name: input.name.trim() || null,
      phone: input.phone.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) return { ok: false, error: profileError.message };

  return { ok: true, user_id: created.user.id };
}
