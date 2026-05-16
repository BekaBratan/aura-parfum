-- Remove obsolete attribute keys from products

-- Perfume: remove family
UPDATE products
SET attributes = attributes - 'family'
WHERE category = 'perfume' AND attributes ? 'family';

-- Oil: remove oil_type and aroma_note (now uses gender like perfume)
UPDATE products
SET attributes = attributes - 'oil_type' - 'aroma_note'
WHERE category = 'oil';

-- Accessory: remove material and color
UPDATE products
SET attributes = attributes - 'material' - 'color'
WHERE category = 'accessory';
