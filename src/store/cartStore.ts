import { CartItem } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartProductSnapshot = {
  id: string;
  name: string;
  brand: string;
  price: number;
  volume_ml: number | null;
  image_url: string | null;
  count: number | null;
};

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  syncItemsWithProducts: (products: CartProductSnapshot[]) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const availableCount = Number(item.count ?? 0);
        if (availableCount <= 0) return;

        const existing = get().items.find((i) => i.product_id === item.product_id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.product_id === item.product_id
                ? { ...i, count: availableCount, quantity: Math.min(i.quantity + 1, availableCount) }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: 1 }] });
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
        const productsById = new Map(products.map((product) => [product.id, product]));

        set({
          items: get().items.map((item) => {
            const product = productsById.get(item.product_id);
            if (!product) return item;

            const availableCount = Number(product.count ?? 0);

            return {
              ...item,
              name: product.name,
              brand: product.brand,
              price: Number(product.price),
              volume_ml: product.volume_ml,
              image_url: product.image_url,
              count: availableCount,
            };
          }),
        });
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: "aura-cart" }
  )
);
