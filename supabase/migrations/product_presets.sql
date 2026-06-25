-- Default volume/quantity presets for product card buttons
-- Run in Supabase SQL Editor

INSERT INTO public.product_options (type, value) VALUES
  ('preset_ml_oil', '50'),
  ('preset_ml_oil', '250'),
  ('preset_ml_oil', '500'),
  ('preset_ml_oil', '1000'),
  ('preset_ml_perfume', '50'),
  ('preset_ml_perfume', '250'),
  ('preset_ml_perfume', '500'),
  ('preset_ml_perfume', '1000'),
  ('preset_pcs_accessory', '50'),
  ('preset_pcs_accessory', '100'),
  ('preset_pcs_accessory', '250'),
  ('preset_pcs_accessory', '500')
ON CONFLICT (type, value) DO NOTHING;
