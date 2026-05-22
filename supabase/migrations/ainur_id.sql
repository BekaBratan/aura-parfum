-- ============================================================
-- Link Supabase products to Ainur POS products
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ainur_id text;

-- Lookup by ainur_id when applying the live-stock overlay
CREATE INDEX IF NOT EXISTS products_ainur_id_idx
  ON public.products (ainur_id)
  WHERE ainur_id IS NOT NULL;

-- Prevent two Supabase products from being linked to the same Ainur item
CREATE UNIQUE INDEX IF NOT EXISTS products_ainur_id_unique
  ON public.products (ainur_id)
  WHERE ainur_id IS NOT NULL;
