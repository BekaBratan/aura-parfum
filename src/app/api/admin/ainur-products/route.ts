import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_STORE_ID, listAinurProducts } from "@/lib/ainur/client";

export const dynamic = "force-dynamic";

export interface AdminAinurProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category_id: string | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return data?.role === "admin";
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id") || DEFAULT_STORE_ID;
    const products = await listAinurProducts({ storeId, limit: 1000 });

    const list: AdminAinurProduct[] = products
      .map((p) => ({
        id: p.id,
        name: (p.options?.name ?? "").trim(),
        price: Number(p.price ?? 0),
        stock: Number(p.stock?.[storeId] ?? 0),
        category_id: p.category_id ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    return NextResponse.json({ data: list });
  } catch (err) {
    console.error("[/api/admin/ainur-products] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
