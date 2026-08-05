"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ClientAccountRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  discount_percent: number;
  created_at: string;
}

type AdminResult =
  | { ok: true; admin: SupabaseClient }
  | { ok: false; error: string };

async function requireAdmin(): Promise<AdminResult> {
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

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { ok: true, admin };
}

export async function listClientAccounts(): Promise<
  { ok: true; clients: ClientAccountRow[] } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const [{ data: profiles, error: pError }, { data: authData, error: aError }] =
    await Promise.all([
      auth.admin
        .from("profiles")
        .select("id, full_name, phone, discount_percent, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false }),
      auth.admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  if (pError) return { ok: false, error: pError.message };
  if (aError) return { ok: false, error: aError.message };

  const emailById = new Map(authData.users.map((u) => [u.id, u.email ?? null]));
  const clients: ClientAccountRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? null,
    full_name: p.full_name,
    phone: p.phone,
    discount_percent: Number(p.discount_percent ?? 0),
    created_at: p.created_at,
  }));

  return { ok: true, clients };
}

export async function updateClientAccount(input: {
  id: string;
  discount_percent: number;
  name?: string | null;
  phone?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const discount = Math.round(Number(input.discount_percent) || 0);
  if (discount < 0 || discount > 100) return { ok: false, error: "Скидка должна быть от 0 до 100%" };

  const { error } = await auth.admin
    .from("profiles")
    .update({
      discount_percent: discount,
      full_name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeClientAccount(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await auth.admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
