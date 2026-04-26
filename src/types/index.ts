export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  price: number;
  gender: "men" | "women" | "unisex";
  volume_ml: number | null;
  image_url: string | null;
  in_stock: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  volume_ml: number | null;
  image_url: string | null;
}

export interface Order {
  id: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  comment: string | null;
  items: OrderItem[];
  total: number;
  status: "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
  created_at: string;
}

export interface CartItem extends OrderItem {
  quantity: number;
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
}
