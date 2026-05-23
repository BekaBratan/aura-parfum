export type ProductCategory = "oil" | "perfume" | "accessory";
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
  unit: ProductUnit;
  category: ProductCategory;
  attributes?: Record<string, string | string[]> | null;
  gender?: string | null;
  country_of_origin?: string | null;
  code?: string | null;
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
  created_at: string;
}

export interface CartItem extends OrderItem {
  quantity: number;
  count: number;
}

export interface FilterState {
  search: string;
  brands: string[];
  genders: string[];
  volumes: number[];
  priceMin: number | null;
  priceMax: number | null;
  inStockOnly: boolean;
  sortBy: "price_asc" | "price_desc" | "newest";
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
