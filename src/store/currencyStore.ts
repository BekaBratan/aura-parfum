import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_KZT_RATE } from "@/lib/currency";
import { CurrencyRate } from "@/types";

interface CurrencyStore {
  kztRate: number;
  kztUpdatedAt: string | null;
  kztIsManual: boolean;
  loading: boolean;
  fetchRates: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyStore>((set) => ({
  kztRate: DEFAULT_KZT_RATE,
  kztUpdatedAt: null,
  kztIsManual: false,
  loading: false,

  fetchRates: async () => {
    set({ loading: true });
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("currency_rates")
        .select("*");

      if (data && data.length > 0) {
        const kzt = (data as CurrencyRate[]).find(
          (r) => r.currency_code === "KZT"
        );
        if (kzt) {
          set({
            kztRate: Number(kzt.rate_to_usd),
            kztUpdatedAt: kzt.updated_at,
            kztIsManual: kzt.is_manual ?? false,
          });
        }
      }
    } catch {
      // Silently use default rate
    } finally {
      set({ loading: false });
    }
  },
}));
