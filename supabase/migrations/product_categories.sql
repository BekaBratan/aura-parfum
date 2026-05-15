-- ============================================================
-- Product Categories: oil / perfume / accessory
-- Run manually in Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category   text NOT NULL DEFAULT 'perfume'
    CHECK (category IN ('oil', 'perfume', 'accessory')),
  ADD COLUMN IF NOT EXISTS unit       text NOT NULL DEFAULT 'ml'
    CHECK (unit IN ('ml', 'pcs')),
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_volume integer;

-- 2. Migrate existing products (all are perfumes sold by ml)
--    price_per_ml = ROUND(price / volume_ml)
--    Existing count stays as-is (admin will update stock in ml manually)
UPDATE public.products
SET
  category = 'perfume',
  unit     = 'ml',
  price    = ROUND(price / NULLIF(volume_ml, 0), 0)
WHERE volume_ml IS NOT NULL
  AND volume_ml > 0;

-- Products without volume_ml: keep category=perfume, unit=ml, price unchanged
UPDATE public.products
SET
  category = 'perfume',
  unit     = 'ml'
WHERE volume_ml IS NULL OR volume_ml = 0;

-- 3. Migrate gender field into attributes for existing perfumes
--    (gender column stays for backward compat, but also mirrored in attributes)
UPDATE public.products
SET attributes = jsonb_build_object('gender', gender)
WHERE category = 'perfume'
  AND gender IS NOT NULL;
