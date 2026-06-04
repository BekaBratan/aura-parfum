"use client";

import { useEffect } from "react";
import { useCountryStore } from "@/store/countryStore";

export default function CountryLoader() {
  const fetchCountries = useCountryStore((s) => s.fetchCountries);
  useEffect(() => {
    void fetchCountries();
  }, [fetchCountries]);
  return null;
}
