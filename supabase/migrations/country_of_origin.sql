-- ============================================================
-- Add country_of_origin column to products
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS country_of_origin text;

-- Migrate existing attributes.country → new column (for oil products)
UPDATE public.products
SET country_of_origin = attributes->>'country'
WHERE attributes ? 'country'
  AND (attributes->>'country') <> '';

-- Remove 'country' from attributes (now stored in dedicated column)
UPDATE public.products
SET attributes = attributes - 'country'
WHERE attributes ? 'country';
