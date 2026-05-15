-- ============================================================
-- USD-Based Pricing
-- Run manually in Supabase SQL Editor
-- ============================================================

-- 1. currency_rates table
CREATE TABLE IF NOT EXISTS public.currency_rates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code text        NOT NULL UNIQUE,
  rate_to_usd   numeric(18,6) NOT NULL,  -- units of currency per 1 USD
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Initial rate — admin will update via panel / auto-cron
INSERT INTO public.currency_rates (currency_code, rate_to_usd)
VALUES ('KZT', 460.00)
ON CONFLICT (currency_code) DO NOTHING;

-- Public read (clients need rates), writes via service role only
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "currency_rates_public_read" ON public.currency_rates
  FOR SELECT USING (true);

-- 2. products: rename price → price_usd
ALTER TABLE public.products RENAME COLUMN price TO price_usd;

-- 3. orders: rename total_price → total_usd, add display-currency fields
ALTER TABLE public.orders RENAME COLUMN total_price TO total_usd;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS display_currency_code  text           NOT NULL DEFAULT 'KZT',
  ADD COLUMN IF NOT EXISTS total_display_currency numeric(12,2);

-- Backfill total_display_currency for existing orders using current KZT rate
UPDATE public.orders o
SET total_display_currency = ROUND(
  o.total_usd * (SELECT rate_to_usd FROM public.currency_rates WHERE currency_code = 'KZT'),
  0
)
WHERE total_display_currency IS NULL;

-- 4. Migrate order items JSONB: rename price → price_usd in all items
UPDATE public.orders
SET items = (
  SELECT jsonb_agg(
    CASE
      WHEN item ? 'price_usd' THEN item
      ELSE item || jsonb_build_object('price_usd', (item->>'price')::numeric)
              - 'price'
    END
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE items IS NOT NULL;
