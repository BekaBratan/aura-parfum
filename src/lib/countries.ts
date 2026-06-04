// Legacy lookup map kept as fallback when a product row's country_code is null.
// New products should store country_code explicitly on the products table.
export const COUNTRY_CODES: Record<string, string> = {
  "Турция": "SL",
  "Франция": "FR",
  "Швейцария": "LZ",
  "Испания": "SP",
  "Саудовская Аравия": "SA",
};

export const COUNTRIES: string[] = [
  "Турция",
  "Франция",
  "Швейцария",
  "Испания",
  "Саудовская Аравия",
];

