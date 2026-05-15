import { CartItem, ProductUnit, ProductCategory } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartProductSnapshot = {
  id: string;
  name: string;
  brand: string;
  price_usd: number;
  volume_ml: number | null;
  image_url: string | null;
  count: number | null;
  unit: ProductUnit;
  category: ProductCategory;
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
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const availableCount = Number(item.count ?? 0);
        if (availableCount <= 0) return;

        const initialQty = item.quantity ?? 1;
        const safeQty = Math.min(Math.max(1, initialQty), availableCount);

        const existing = get().items.find((i) => i.product_id === item.product_id);

        if (existing && item.unit === "pcs") {
          set({
            items: get().items.map((i) =>
              i.product_id === item.product_id
                ? { ...i, count: availableCount, quantity: Math.min(i.quantity + 1, availableCount) }
                : i
            ),
          });
        } else if (existing && item.unit === "ml") {
          set({
            items: get().items.map((i) =>
              i.product_id === item.product_id
                ? { ...item, quantity: safeQty, count: availableCount }
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
          items: get().items.map((i) =>
            i.product_id === productId
              ? { ...i, quantity: Math.min(quantity, Number(i.count ?? 0)) }
              : i
          ),
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
              count: Number(product.count ?? 0),
              unit: product.unit,
              category: product.category,
            };
          }),
        });
      },

      clearCart: () => set({ items: [] }),

      // Count distinct product lines, not sum of quantities/ml
      totalItems: () => get().items.length,

      totalUsd: () =>
        get().items.reduce((sum, i) => sum + i.price_usd * i.quantity, 0),
    }),
    { name: "aura-cart" }
  )
);
