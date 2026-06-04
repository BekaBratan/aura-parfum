import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_CODES as LEGACY_CODES } from "@/lib/countries";

// Country data lives on product_options (type='country'). Each row carries an
// optional 2–3 letter code shown as a badge on product cards. Static legacy
// map in lib/countries.ts is the fallback while the table loads or for
// countries the admin hasn't seeded yet.

interface CountryStore {
  // name → code (uppercase). Empty until fetchCountries() resolves.
  codes: Record<string, string>;
  loaded: boolean;
  fetchCountries: () => Promise<void>;
}

export const useCountryStore = create<CountryStore>((set, get) => ({
  codes: {},
  loaded: false,

  fetchCountries: async () => {
    if (get().loaded) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_options")
        .select("value, code")
        .eq("type", "country");

      const map: Record<string, string> = {};
      for (const row of (data ?? []) as Array<{ value: string; code: string | null }>) {
        if (row.code) map[row.value] = row.code.toUpperCase();
      }
      set({ codes: map, loaded: true });
    } catch {
      // Fall through — components will use the legacy map.
      set({ loaded: true });
    }
  },
}));

// Resolve a country code with three-stage fallback:
//   1. live table (codes loaded from product_options)
//   2. legacy hardcoded map in lib/countries.ts
//   3. null
export function getCountryCode(
  codes: Record<string, string>,
  countryName: string | null | undefined,
): string | null {
  if (!countryName) return null;
  return codes[countryName] ?? LEGACY_CODES[countryName] ?? null;
}
