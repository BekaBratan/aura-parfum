import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

async function fetchRateFromNBK(): Promise<number> {
  const res = await fetch(
    "https://nationalbank.kz/rss/rates_all.xml",
    { next: { revalidate: 0 } }
  );

  if (!res.ok) throw new Error(`НБК API responded ${res.status}`);

  const xml = await res.text();
  const items = xml.split("<item>");
  for (const item of items) {
    if (/<title>USD<\/title>/.test(item)) {
      const match = item.match(/<description>([\d.]+)<\/description>/);
      if (match) return parseFloat(match[1]);
    }
  }
  throw new Error("Курс USD не найден в ответе НБК");
}

async function saveRate(
  rate: number,
  isManual: boolean
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("currency_rates")
    .update({
      rate_to_usd: rate,
      updated_at: new Date().toISOString(),
      is_manual: isManual,
    })
    .eq("currency_code", "KZT");

  if (error) throw error;
}

// POST: called from admin panel — auto-refresh from NBK (resets manual lock)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Manual rate save: body contains { rate, is_manual: true }
    if (body.is_manual && body.rate) {
      const rate = Number(body.rate);
      if (!rate || rate <= 0) {
        return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
      }
      await saveRate(rate, true);
      return NextResponse.json({ ok: true, kzt: rate, source: "manual" });
    }

    // Auto-refresh from NBK (clears manual lock)
    const kztRate = await fetchRateFromNBK();
    await saveRate(kztRate, false);
    return NextResponse.json({ ok: true, kzt: kztRate, source: "nationalbank.kz" });
  } catch (err) {
    console.error("Currency refresh failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// GET: Vercel Cron — skips update when in manual mode
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if manual mode is active — skip auto-update if so
    const { data: row } = await supabase
      .from("currency_rates")
      .select("is_manual, rate_to_usd")
      .eq("currency_code", "KZT")
      .single();

    if (row?.is_manual) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "manual mode active",
        kzt: row.rate_to_usd,
      });
    }

    const kztRate = await fetchRateFromNBK();
    await saveRate(kztRate, false);
    return NextResponse.json({ ok: true, kzt: kztRate, source: "nationalbank.kz" });
  } catch (err) {
    console.error("Currency cron failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
