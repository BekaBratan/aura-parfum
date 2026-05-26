-- ============================================================
-- Discounts engine
-- Each row is one rule. Multiple rows can target the same scope
-- (e.g. tiered discounts: oil ≥30 000 → 10%, oil ≥60 000 → 15%)
-- and the engine picks the most-beneficial active rule per cart line.
-- Run manually in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,

  -- What the rule does: percent off, or fixed amount off (in KZT)
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed_kzt')),
  discount_value numeric(12, 2) NOT NULL CHECK (discount_value > 0),

  -- Scope: which cart lines get discounted
  scope_type text NOT NULL CHECK (scope_type IN ('all', 'category', 'products')),
  scope_category text NULL CHECK (scope_category IN ('oil', 'perfume', 'accessory') OR scope_category IS NULL),
  scope_product_ids uuid[] NULL,

  -- Trigger: condition that has to hold for the rule to fire
  condition_type text NOT NULL CHECK (condition_type IN ('sum_kzt', 'quantity')),
  condition_scope text NOT NULL CHECK (condition_scope IN ('all', 'category', 'product')),
  condition_category text NULL CHECK (condition_category IN ('oil', 'perfume', 'accessory') OR condition_category IS NULL),
  condition_product_id uuid NULL,
  condition_threshold numeric(12, 2) NOT NULL CHECK (condition_threshold >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discounts_active_idx ON public.discounts (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS discounts_priority_idx ON public.discounts (priority DESC) WHERE is_active = true;

-- RLS: anyone can READ active discounts (catalog/cart needs to compute totals);
-- only admins can manage rows.
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active discounts" ON public.discounts;
CREATE POLICY "Public read active discounts" ON public.discounts
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin read all discounts" ON public.discounts;
CREATE POLICY "Admin read all discounts" ON public.discounts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin write discounts" ON public.discounts;
CREATE POLICY "Admin write discounts" ON public.discounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_discounts_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discounts_touch_updated_at ON public.discounts;
CREATE TRIGGER discounts_touch_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_discounts_updated_at();
