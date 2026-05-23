-- ============================================================
-- Product code (internal/Ainur SKU) — manually entered or auto-filled from Ainur
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code text;

-- Trigram index for substring/prefix search in the admin search box
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_code_trgm_idx
  ON public.products USING gin (code gin_trgm_ops)
  WHERE code IS NOT NULL;
