"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClientDiscount } from "@/lib/useClientDiscount";
import type { Discount } from "@/types";

type Listener = () => void;

let cached: Discount[] | null = null;
let fetchPromise: Promise<void> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const subs = new Set<Listener>();

function notify() {
  for (const fn of subs) fn();
}

async function load() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (!error) cached = (data as Discount[]) ?? [];
    notify();
  })();
  return fetchPromise;
}

function startInterval() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    notify();
  }, 60_000);
}

function stopInterval() {
  if (subs.size === 0 && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useActiveDiscounts(): Discount[] {
  const [discounts, setDiscounts] = useState<Discount[]>(cached ?? []);

  useEffect(() => {
    const fn: Listener = () => {
      setDiscounts(cached ? [...cached] : []);
    };
    subs.add(fn);
    load();
    startInterval();
    return () => {
      subs.delete(fn);
      stopInterval();
    };
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

/**
 * Discounts that actually apply to the current shopper.
 * Registered clients get ONLY their own personal discount — no general rule
 * discounts are shown or applied to them, so the rules list is emptied out.
 * Guests / staff keep all active rules.
 */
export function useEffectiveDiscounts(): {
  discounts: Discount[];
  isClient: boolean;
  discountPercent: number;
} {
  const activeDiscounts = useActiveDiscounts();
  const { isClient, discountPercent } = useClientDiscount();
  const discounts = useMemo(
    () => (isClient ? [] : activeDiscounts),
    [isClient, activeDiscounts],
  );
  return { discounts, isClient, discountPercent };
}
