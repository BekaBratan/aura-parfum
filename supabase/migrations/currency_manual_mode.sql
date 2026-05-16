-- Add manual override mode to currency_rates
-- When is_manual = true, the cron job skips automatic updates

ALTER TABLE currency_rates
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
