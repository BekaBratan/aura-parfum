-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS product_options (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text NOT NULL,   -- 'country' | 'quality' | 'accessory_type' | 'brand'
  value      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(type, value)
);

ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

-- Authenticated staff can read
CREATE POLICY "Staff read options" ON product_options
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));

-- Service role has full access (used by API routes)
CREATE POLICY "Service role full access" ON product_options
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial data
INSERT INTO product_options (type, value) VALUES
  ('country', 'Франция'),
  ('country', 'Швейцария'),
  ('country', 'Турция'),
  ('country', 'ОАЭ'),
  ('country', 'Германия'),
  ('country', 'Италия'),
  ('country', 'Великобритания'),
  ('quality', 'De Luxe'),
  ('quality', 'Premium'),
  ('accessory_type', 'Спрей'),
  ('accessory_type', 'Ролик'),
  ('accessory_type', 'Спрей-помадка'),
  ('accessory_type', 'Автофлакон'),
  ('accessory_type', 'Бокс'),
  ('accessory_type', 'Графин'),
  ('accessory_type', 'Шприц'),
  ('accessory_type', 'Насадка'),
  ('accessory_type', 'Наклейки'),
  ('accessory_type', 'Термопринтер'),
  ('accessory_type', 'Парфюмерная вода'),
  ('accessory_type', 'Блоттер')
ON CONFLICT (type, value) DO NOTHING;
