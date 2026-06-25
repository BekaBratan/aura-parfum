"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Listener = () => void;

interface PresetRow {
  type: string;
  value: string;
}

const PRESET_PREFIX = "preset_";

let cached: Record<string, number[]> | null = null;
let fetchPromise: Promise<void> | null = null;
const subs = new Set<Listener>();

function notify() {
  for (const fn of subs) fn();
}

async function load() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_options")
      .select("type, value")
      .like("type", `${PRESET_PREFIX}%`);

    const map: Record<string, number[]> = {};
    for (const row of (data ?? []) as PresetRow[]) {
      const num = parseInt(row.value, 10);
      if (!isNaN(num)) {
        if (!map[row.type]) map[row.type] = [];
        map[row.type].push(num);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a - b);
    }
    cached = map;
    notify();
  })();
  return fetchPromise;
}

export function usePresets(type: string): number[] {
  const [data, setData] = useState<number[]>(cached?.[type] ?? []);

  useEffect(() => {
    const fn: Listener = () => {
      setData(cached?.[type] ?? []);
    };
    subs.add(fn);
    load();
    return () => { subs.delete(fn); };
  }, [type]);

  return data;
}

export function getPresetType(
  category: string | undefined | null,
  unit: string | undefined | null,
): string | null {
  if (!category || !unit) return null;
  return `${PRESET_PREFIX}${unit}_${category}`;
}
