-- ============================================================
-- Fix 1: Allow public to read presets from product_options
-- ============================================================
-- The previous policy only allowed SELECT WHERE type='country'.
-- Presets (type LIKE 'preset_%') are needed by the frontend
-- for product card volume/quantity buttons.

DROP POLICY IF EXISTS "Public read country options" ON public.product_options;
CREATE POLICY "Public read product options" ON public.product_options
  FOR SELECT
  USING (type = 'country' OR type LIKE 'preset_%');

-- ============================================================
-- Fix 2: Allow cashiers to update product stock on order cancel
-- ============================================================
-- Previously only 'admin' could UPDATE products. Cashiers need
-- to restore stock when cancelling orders.
-- Uses has_staff_role (admin + cashier) matching the orders policy.

DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE
  USING (has_staff_role(auth.uid()))
  WITH CHECK (has_staff_role(auth.uid()));
