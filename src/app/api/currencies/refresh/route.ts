import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  // Protect cron endpoint
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=KZT",
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      throw new Error(`Frankfurter responded ${res.status}`);
    }

    const json = await res.json();
    const kztRate = json?.rates?.KZT;

    if (!kztRate || typeof kztRate !== "number") {
      throw new Error("Invalid rate in response");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("currency_rates")
      .update({ rate_to_usd: kztRate, updated_at: new Date().toISOString() })
      .eq("currency_code", "KZT");

    if (error) throw error;

    return NextResponse.json({ ok: true, kzt: kztRate, source: "frankfurter.app" });
  } catch (err) {
    console.error("Currency refresh failed:", err);

    // Return current rate from DB as fallback
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("currency_rates")
      .select("rate_to_usd, updated_at")
      .eq("currency_code", "KZT")
      .single();

    return NextResponse.json(
      { ok: false, error: String(err), fallback: data?.rate_to_usd },
      { status: 500 }
    );
  }
}
