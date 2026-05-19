import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  // Verify caller is admin via their own session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use service role to bypass RLS for both queries
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: staffRows, error: staffError }, { data: authData, error: authError }] =
    await Promise.all([
      admin.from("user_roles").select("id, user_id, role, created_at").order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (authError)  return NextResponse.json({ error: authError.message },  { status: 500 });

  const emailById = new Map(authData.users.map((u) => [u.id, u.email ?? null]));

  const staff = (staffRows ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    email: emailById.get(row.user_id) ?? null,
  }));

  return NextResponse.json(staff);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Change password
  if (body.user_id && body.password) {
    if (body.password.length < 6)
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Change role
  const { id, role } = body;
  if (!id || !["admin", "cashier"].includes(role))
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { error } = await admin.from("user_roles").update({ role }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin.from("user_roles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create new user account + assign role
  if (body.email && body.password) {
    const { email, password, role } = body;
    if (!["admin", "cashier"].includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

    return NextResponse.json({ ok: true, user_id: created.user.id });
  }

  // Add role to existing user by user_id
  const { user_id, role } = body;
  if (!user_id || !["admin", "cashier"].includes(role))
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { error } = await admin.from("user_roles").insert({ user_id, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
