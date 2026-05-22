// Server-only client. Do NOT import from client components — uses a secret token.
import { AinurCategory, AinurProduct } from "./types";

const BASE_URL = "https://connect.ainur.app/api/v4";

// Stock store id — defaults to AZ ZAHRA, the only store with real stock as of writing.
// Override via AINUR_STORE_ID env var.
export const DEFAULT_STORE_ID =
  process.env.AINUR_STORE_ID || "6689c95176d733b3f5060c00";

function getToken(): string {
  const token = process.env.AINUR_POS_TOKEN;
  if (!token) {
    throw new Error("AINUR_POS_TOKEN is not set in environment");
  }
  return token;
}

type QueryValue = string | number | undefined | null | Array<string | number>;

async function ainurFetch<T>(
  path: string,
  params?: Record<string, QueryValue>,
  revalidateSeconds = 180,
): Promise<T> {
  const url = new URL(BASE_URL + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(`${key}[]`, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-AINUR-API-Access-Token": getToken(),
      Accept: "application/json",
    },
    // Ainur reconciles its catalog every 3 minutes — match that to avoid stale data without hammering.
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ainur ${path} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export interface ListProductsOptions {
  limit?: number;
  offset?: number;
  storeId?: string;
  ids?: string[];
  minPrice?: number;
  maxPrice?: number;
}

export async function listAinurProducts(options: ListProductsOptions = {}): Promise<AinurProduct[]> {
  return ainurFetch<AinurProduct[]>("/product", {
    limit: options.limit ?? 1000,
    offset: options.offset ?? 0,
    store_id: options.storeId ?? DEFAULT_STORE_ID,
    "ids": options.ids,
    min_price: options.minPrice,
    max_price: options.maxPrice,
  });
}

export async function getAinurProduct(id: string): Promise<AinurProduct> {
  return ainurFetch<AinurProduct>(`/product/${id}`);
}

// Categories rarely change — cache in-process for the lifetime of the Lambda/server instance.
let categoriesCache: { ts: number; data: AinurCategory[] } | null = null;
const CATEGORIES_TTL_MS = 5 * 60_000;

export async function listAinurCategories(): Promise<AinurCategory[]> {
  const now = Date.now();
  if (categoriesCache && now - categoriesCache.ts < CATEGORIES_TTL_MS) {
    return categoriesCache.data;
  }
  const data = await ainurFetch<AinurCategory[]>("/product/ext-categories", undefined, 600);
  categoriesCache = { ts: now, data };
  return data;
}
