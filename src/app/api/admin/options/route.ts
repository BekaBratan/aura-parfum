import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  if (data?.role !== "admin") return null;
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("product_options")
    .select("id, type, value, code, created_at")
    .order("type")
    .order("value");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, value, code } = await request.json();
  if (!type || !value?.trim())
    return NextResponse.json({ error: "type and value required" }, { status: 400 });

  const normalisedCode = typeof code === "string" && code.trim()
    ? code.trim().toUpperCase()
    : null;

  const { data, error } = await admin
    .from("product_options")
    .insert({ type, value: value.trim(), code: normalisedCode })
    .select("id, type, value, code, created_at")
    .single();

  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ error: "Такое значение уже существует" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// Update just the `code` field of an existing option (used by the country list)
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, code } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const normalisedCode = typeof code === "string" && code.trim()
    ? code.trim().toUpperCase()
    : null;

  const { data, error } = await admin
    .from("product_options")
    .update({ code: normalisedCode })
    .eq("id", id)
    .select("id, type, value, code, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await admin.from("product_options").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
