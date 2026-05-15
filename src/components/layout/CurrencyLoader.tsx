"use client";

import { useEffect } from "react";
import { useCurrencyStore } from "@/store/currencyStore";

export default function CurrencyLoader() {
  const fetchRates = useCurrencyStore((s) => s.fetchRates);
  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);
  return null;
}
