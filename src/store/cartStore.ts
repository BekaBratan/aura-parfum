import { CartItem, ProductUnit, ProductCategory } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isKztPriced } from "@/lib/utils";

export type CartProductSnapshot = {
  id: string;
  name: string;
  brand: string;
  price_usd: number;
  volume_ml: number | null;
  image_url: string | null;
  image_thumb_url?: string | null;
  count: number | null;
  unit: ProductUnit;
  category: ProductCategory;
  attributes?: Record<string, string | string[]> | null;
  gender?: string | null;
  country_of_origin?: string | null;
  code?: string | null;
  ainur_id?: string | null;
  min_volume?: number | null;
};

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  syncItemsWithProducts: (products: CartProductSnapshot[]) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalUsd: () => number;
  totalKzt: (kztRate: number) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const availableCount = Number(item.count ?? 0);
        if (availableCount <= 0) return;

        const initialQty = item.quantity ?? 1;
        const lowerBound = item.min_volume ?? 1;
        const safeQty = Math.min(Math.max(lowerBound, initialQty), availableCount);
        if (safeQty < lowerBound) return;

        const existing = get().items.find((i) => i.product_id === item.product_id);

        if (existing) {
          // Replace existing entry with the new snapshot (sets quantity to the requested value)
          set({
            items: get().items.map((i) =>
              i.product_id === item.product_id
                ? { ...i, ...item, quantity: safeQty, count: availableCount }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: safeQty }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.product_id !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) => {
            if (i.product_id !== productId) return i;
            const lowerBound = i.min_volume ?? 1;
            const clamped = Math.min(Math.max(lowerBound, quantity), Number(i.count ?? 0));
            return { ...i, quantity: clamped };
          }),
        });
      },

      syncItemsWithProducts: (products) => {
        const productsById = new Map(products.map((p) => [p.id, p]));
        set({
          items: get().items.map((item) => {
            const product = productsById.get(item.product_id);
            if (!product) return item;
            return {
              ...item,
              name: product.name,
              brand: product.brand,
              price_usd: Number(product.price_usd),
              volume_ml: item.unit === "ml" ? item.quantity : product.volume_ml,
              image_url: product.image_url,
              image_thumb_url: product.image_thumb_url ?? item.image_thumb_url ?? null,
              count: Number(product.count ?? 0),
              unit: product.unit,
              category: product.category,
              attributes: product.attributes ?? item.attributes ?? null,
              gender: product.gender ?? item.gender ?? null,
              country_of_origin: product.country_of_origin ?? item.country_of_origin ?? null,
              code: product.code ?? item.code ?? null,
              ainur_id: product.ainur_id ?? item.ainur_id ?? null,
              min_volume: product.min_volume ?? item.min_volume ?? null,
            };
          }),
        });
      },

      clearCart: () => set({ items: [] }),

      // Count distinct product lines, not sum of quantities/ml
      totalItems: () => get().items.length,

      totalUsd: () =>
        get().items.reduce((sum, i) => sum + i.price_usd * i.quantity, 0),

      totalKzt: (kztRate: number) =>
        get().items.reduce((sum, i) => {
          const kzt = isKztPriced(i.category) ? i.price_usd : i.price_usd * kztRate;
          return sum + kzt * i.quantity;
        }, 0),
    }),
    { name: "aura-cart" }
  )
);
