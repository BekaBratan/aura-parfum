"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Discount } from "@/types";

/**
 * Fetch active, in-window discount rules. RLS also enforces the same window
 * on the public-read policy, but we filter once more on the client to handle
 * clock skew + cache freshness.
 */
export function useActiveDiscounts(): Discount[] {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (cancelled || error) return;
      setDiscounts((data as Discount[]) ?? []);
    })();
    // Re-evaluate the date window every minute so a discount that expires
    // during the customer's session disappears automatically.
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return useMemo(() => {
    const now = Date.now();
    return discounts.filter((d) => {
      if (d.valid_from && new Date(d.valid_from).getTime() > now) return false;
      if (d.valid_until && new Date(d.valid_until).getTime() < now) return false;
      return true;
    });
  }, [discounts]);
}
