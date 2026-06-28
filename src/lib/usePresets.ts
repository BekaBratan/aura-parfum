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
let fetchError: string | null = null;
const subs = new Set<Listener>();

function notify() {
  for (const fn of subs) fn();
}

async function load() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_options")
        .select("type, value")
        .like("type", `${PRESET_PREFIX}%`);

      if (error) {
        fetchError = error.message;
        fetchPromise = null;
        notify();
        return;
      }

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
      fetchError = null;
      notify();
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
      fetchPromise = null;
      notify();
    }
  })();
  return fetchPromise;
}

export function usePresets(type: string): { presets: number[]; error: string | null } {
  const [data, setData] = useState<number[]>(cached?.[type] ?? []);
  const [error, setError] = useState<string | null>(fetchError);

  useEffect(() => {
    const fn: Listener = () => {
      setData(cached?.[type] ?? []);
      setError(fetchError);
    };
    subs.add(fn);
    load();
    return () => { subs.delete(fn); };
  }, [type]);

  return { presets: data, error };
}

export function getPresetType(
  category: string | undefined | null,
  unit: string | undefined | null,
): string | null {
  if (!category || !unit) return null;
  return `${PRESET_PREFIX}${unit}_${category}`;
}
