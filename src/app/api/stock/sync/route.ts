import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncStockFromAinur } from "@/lib/ainur/syncStock";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<{ allowed: boolean; email?: string }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false };
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return { allowed: data?.role === "admin", email: user.email ?? undefined };
}

export async function POST() {
  const { allowed, email } = await requireAdmin();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncStockFromAinur({ triggeredBy: "admin", adminEmail: email });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/stock/sync] POST failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCron) {
    try {
      const result = await syncStockFromAinur({ triggeredBy: "cron" });
      return NextResponse.json(result);
    } catch (err) {
      console.error("[/api/stock/sync] GET cron failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
  }

  // No cron secret — serve last log entry to admin
  const { allowed } = await requireAdmin();
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: logs } = await admin
      .from("stock_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ data: logs ?? [] });
  } catch (err) {
    console.error("[/api/stock/sync] GET logs failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
