export type ProductCategory = "oil" | "perfume" | "accessory" | "original" | "analog";
export type ProductUnit = "ml" | "pcs";

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  price_usd: number;
  gender: "men" | "women" | "unisex";
  volume_ml: number | null;
  image_url: string | null;
  image_thumb_url?: string | null;
  count: number;
  is_featured: boolean;
  created_at: string;
  category: ProductCategory;
  unit: ProductUnit;
  attributes: Record<string, string | string[]>;
  min_volume: number | null;
  country_of_origin: string | null;
  ainur_id?: string | null;
  code?: string | null;
}

export interface OrderItem {
  product_id: string;
  name: string;
  brand: string;
  price_usd: number;
  quantity: number;
  volume_ml: number | null;
  image_url: string | null;
  image_thumb_url?: string | null;
  unit: ProductUnit;
  category: ProductCategory;
  attributes?: Record<string, string | string[]> | null;
  gender?: string | null;
  country_of_origin?: string | null;
  code?: string | null;
  ainur_id?: string | null;
  // Per-line discount snapshot (set at checkout if a rule applied to this line)
  discount_kzt?: number | null;
  applied_discount_name?: string | null;
}

export interface Order {
  id: string;
  invoice_number: string;
  payment_status: "pending_payment" | "paid" | "failed" | "refunded";
  order_status: "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
  customer_phone: string;
  customer_name: string;
  customer_city: string;
  customer_address: string;
  comment: string | null;
  items: OrderItem[];
  total_usd: number;
  display_currency_code: string;
  total_display_currency: number | null;
  discount_kzt?: number | null;
  applied_discounts?: AppliedDiscountLine[] | null;
  kzt_rate?: number;
  // Personal client discount. On a registered client's order BOTH can be > 0:
  // discount_kzt = general rule discounts (on non-oil/perfume lines),
  // discount_sum = the client's personal discount on масло/парфюм lines.
  discount_percent?: number;
  discount_sum?: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  role: "client";
  discount_percent: number;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export type DiscountTriggerType =
  | "all_cart"
  | "category_total"
  | "specific_products"
  | "category_per_product";
export type DiscountApplyTo = "all_cart" | "category" | "trigger_product" | "specific_products";
export type DiscountType = "percentage" | "fixed";
export type DiscountCurrencyCode = "USD" | "KZT";

export interface Discount {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;

  // Trigger axis — what unlocks the discount
  trigger_type: DiscountTriggerType;
  trigger_category_ids: ProductCategory[] | null;
  trigger_product_ids: string[] | null;
  trigger_threshold_amount: number | null;   // USD
  trigger_min_quantity: number | null;       // per product, only for specific_products

  // Apply axis — what lines actually get the price cut
  apply_to: DiscountApplyTo;
  apply_category_ids: ProductCategory[] | null;
  apply_product_ids: string[] | null;

  // Value
  discount_type: DiscountType;
  discount_value: number;                    // percentage: 0–100, fixed: in currency_code

  // Currency for the trigger threshold AND fixed discount value.
  // Percentage discounts ignore this. Existing rows default to 'USD'.
  currency_code: DiscountCurrencyCode;

  // Validity window (null = no bound on that side)
  valid_from: string | null;
  valid_until: string | null;

  created_at: string;
  updated_at: string;
}

// Snapshot stored on each order so the invoice / PDF can render the applied
// rules later without depending on the (possibly edited or deleted) source row.
export interface AppliedDiscountLine {
  discount_id: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  amount_kzt: number;
  trigger_product_ids: string[] | null;
}

export interface CartItem extends OrderItem {
  quantity: number;
  count: number;
  min_volume?: number | null;
}

export interface FilterState {
  search: string;
  brands: string[];
  genders: string[];
  volumes: number[];
  priceMin: number | null;
  priceMax: number | null;
  inStockOnly: boolean;
  sortBy: "name_asc" | "name_desc" | "price_asc" | "price_desc";
  category: ProductCategory | null;
  attributeFilters: Record<string, string[]>;
  countries: string[];
}

export interface CurrencyRate {
  id: string;
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
  is_manual: boolean;
}
