// Shapes returned by the Ainur API (https://connect.ainur.app/api/v4).
// Only fields we actually consume are declared.

export interface AinurProduct {
  id: string;
  published_at: string;
  updated_at: string;
  options: {
    id: string;
    uuid: string;
    name: string;
    description: string | null;
  };
  is_variable: boolean;
  variation: {
    id: string;
    name: string;
    property: Array<{ key: string; value: string }>;
  } | null;
  sku: string;
  barcode: string;
  code: string;
  weight: number | null;
  plu_code: string | null;
  price: number;
  discount: number;
  stock: Record<string, number>;
  in_stock: boolean;
  tags: string[];
  category_id: string | null;
  img: string[];
}

export interface AinurCategory {
  id: string;
  uuid: string;
  name: string;
  parent_id: string | null;
  parent_uuid: string | null;
  created_at: string;
  updated_at: string;
}
