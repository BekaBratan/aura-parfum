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

const AINUR_TIMEOUT_MS = 10_000;

async function ainurFetch<T>(
  path: string,
  params?: Record<string, QueryValue>,
  revalidateSeconds = 180,
  timeoutMs = AINUR_TIMEOUT_MS,
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

export interface ListProductsOptions {
  limit?: number;
  offset?: number;
  storeId?: string;
  ids?: string[];
  minPrice?: number;
  maxPrice?: number;
  _revalidate?: number;
  _timeoutMs?: number;
}

export async function listAinurProducts(options: ListProductsOptions = {}): Promise<AinurProduct[]> {
  return ainurFetch<AinurProduct[]>("/product", {
    limit: options.limit ?? 1000,
    offset: options.offset ?? 0,
    store_id: options.storeId ?? DEFAULT_STORE_ID,
    "ids": options.ids,
    min_price: options.minPrice,
    max_price: options.maxPrice,
  }, options._revalidate, options._timeoutMs);
}

export async function getAinurProduct(id: string): Promise<AinurProduct> {
  return ainurFetch<AinurProduct>(`/product/${id}`);
}

// POST request helper (no caching, sends JSON body).
async function ainurPost<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(BASE_URL + path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AINUR_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      method: "POST",
      headers: {
        "X-AINUR-API-Access-Token": getToken(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ainur POST ${path} → ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface AinurSaleProduct {
  product_id: string;
  quantity: number;
  discount_percent: number;
  unit: string;
  barcode?: string | null;
  price?: number;
}

export interface AinurSalePaymentDetails {
  sum: number;
  type: "debit" | "credit";
  status: boolean;
  date: string;
}

export interface CreateAinurSalePayload {
  status: boolean;
  store_id: string;
  customer_id: string;
  date: string;
  discount_percent: number;
  discount_sum: number;
  products: AinurSaleProduct[];
  payment_details?: AinurSalePaymentDetails | null;
  comment?: string;
}

export async function createAinurSale(payload: CreateAinurSalePayload): Promise<{ status: boolean; error?: string }> {
  return ainurPost("/sales", payload);
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
