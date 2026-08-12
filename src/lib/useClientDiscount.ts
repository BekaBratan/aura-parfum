"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientDiscount = {
  discountPercent: number;
  isLoading: boolean;
  userEmail: string | null;
  isClient: boolean;
};

let cached: { userEmail: string | null; discountPercent: number; isClient: boolean } | null = null;
let fetchPromise: Promise<void> | null = null;

async function load() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      cached = { userEmail: null, discountPercent: 0, isClient: false };
      return;
    }
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("discount_percent, role")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "cashier"])
        .limit(1),
    ]);

    const profile = profileRes.data;
    const isStaff = (roleRes.data ?? []).length > 0;

    cached = {
      userEmail: user.email ?? null,
      discountPercent: Number(profile?.discount_percent ?? 0),
      isClient: profile?.role === "client" && !isStaff,
    };
  })();
  return fetchPromise;
}

// Returns the signed-in client's personal discount for DISPLAY only.
// The authoritative value is always re-read server-side at checkout.
export function useClientDiscount(): ClientDiscount {
  const [state, setState] = useState<ClientDiscount>({
    discountPercent: cached?.discountPercent ?? 0,
    isLoading: !cached,
    userEmail: cached?.userEmail ?? null,
    isClient: cached?.isClient ?? false,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const refresh = () => {
      cached = null;
      fetchPromise = null;
      void load().then(() => {
        if (!active || !cached) return;
        setState({
          discountPercent: cached.discountPercent,
          isLoading: false,
          userEmail: cached.userEmail,
          isClient: cached.isClient,
        });
      });
    };

    refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => refresh());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
