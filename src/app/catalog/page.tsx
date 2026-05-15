"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Product, FilterState, ProductCategory } from "@/types";
import ProductCard from "@/components/product/ProductCard";
import {
  Grid2X2,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/utils";

type CatalogViewMode = "grid" | "list";

const CATALOG_VIEW_KEY = "catalogViewMode";

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
];

// Category → which attribute keys to render as filter panels
const CATEGORY_ATTRIBUTE_FILTERS: Record<
  ProductCategory,
  Array<{ key: string; label: string }>
> = {
  oil: [
    { key: "oil_type", label: "Тип масла" },
    { key: "aroma_note", label: "Аромат / нота" },
    { key: "country", label: "Страна" },
  ],
  perfume: [
    { key: "gender", label: "Пол" },
    { key: "family", label: "Семейство аромата" },
  ],
  accessory: [
    { key: "type", label: "Тип" },
    { key: "material", label: "Материал" },
    { key: "color", label: "Цвет" },
  ],
};

const DEFAULT_FILTERS: FilterState = {
  search: "",
  brands: [],
  genders: [],
  volumes: [],
  priceMin: null,
  priceMax: null,
  inStockOnly: false,
  sortBy: "newest",
  category: null,
  attributeFilters: {},
};

function pluralItems(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeCategory =
    (searchParams.get("category") as ProductCategory | null) ?? null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<CatalogViewMode>("grid");

  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    category: activeCategory,
  });

  // Persist view mode
  useEffect(() => {
    const stored = window.localStorage.getItem(CATALOG_VIEW_KEY);
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  // Load all products once
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setProducts((data as Product[]) || []);
      } catch (err) {
        console.error("Не удалось загрузить товары:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Sync category filter when URL param changes
  useEffect(() => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      sortBy: prev.sortBy,
      category: activeCategory,
    }));
  }, [activeCategory]);

  const handleCategoryChange = (cat: ProductCategory | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) params.set("category", cat);
    else params.delete("category");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleViewModeChange = (mode: CatalogViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(CATALOG_VIEW_KEY, mode);
  };

  // Products belonging to the currently selected category (for filter option building)
  const categoryProducts = useMemo(
    () =>
      activeCategory
        ? products.filter((p) => (p.category ?? "perfume") === activeCategory)
        : products,
    [products, activeCategory]
  );

  // Unique brands for current category
  const brands = useMemo(
    () => [...new Set(categoryProducts.map((p) => p.brand))].sort(),
    [categoryProducts]
  );

  // Attribute filter config + available options for current category
  const attrFilterConfig = useMemo(
    () => (activeCategory ? CATEGORY_ATTRIBUTE_FILTERS[activeCategory] : []),
    [activeCategory]
  );

  const attrOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const { key } of attrFilterConfig) {
      const values = new Set<string>();
      for (const product of categoryProducts) {
        const val = product.attributes?.[key];
        if (typeof val === "string" && val) values.add(val);
        if (Array.isArray(val)) val.forEach((v) => typeof v === "string" && values.add(v));
      }
      opts[key] = [...values].sort();
    }
    return opts;
  }, [categoryProducts, attrFilterConfig]);

  // Apply all filters
  const filtered = useMemo(() => {
    let list = activeCategory
      ? products.filter((p) => (p.category ?? "perfume") === activeCategory)
      : [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }

    if (filters.brands.length > 0) {
      list = list.filter((p) => filters.brands.includes(p.brand));
    }

    // Apply attribute filters
    Object.entries(filters.attributeFilters).forEach(([key, values]) => {
      if (!values.length) return;
      list = list.filter((p) => {
        const val = p.attributes?.[key];
        if (!val) return false;
        if (typeof val === "string") return values.includes(val);
        if (Array.isArray(val)) return val.some((v) => values.includes(String(v)));
        return false;
      });
    });

    if (filters.priceMin !== null) {
      list = list.filter((p) => p.price >= filters.priceMin!);
    }
    if (filters.priceMax !== null) {
      list = list.filter((p) => p.price <= filters.priceMax!);
    }
    if (filters.inStockOnly) {
      list = list.filter((p) => Number(p.count ?? 0) > 0);
    }

    switch (filters.sortBy) {
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return list;
  }, [products, activeCategory, filters]);

  const toggleBrand = useCallback((brand: string) => {
    setFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  }, []);

  const toggleAttr = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      const current = prev.attributeFilters[key] ?? [];
      return {
        ...prev,
        attributeFilters: {
          ...prev.attributeFilters,
          [key]: current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
        },
      };
    });
  }, []);

  const clearFilters = () =>
    setFilters({ ...DEFAULT_FILTERS, category: activeCategory, sortBy: filters.sortBy });

  const hasActiveFilters =
    filters.brands.length > 0 ||
    Object.values(filters.attributeFilters).some((v) => v.length > 0) ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.inStockOnly;

  return (
    <div className="catalog-layout">
      <div className="site-container">
        {/* Page header */}
        <div className="section-header">
          <div>
            <p className="eyebrow">Коллекция</p>
            <h1 className="section-title">Каталог</h1>
            <p className="section-subtitle">
              Масла, парфюм и аксессуары — всё для вашего аромата.
            </p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="catalog-tabs" role="tablist" aria-label="Категории">
          <button
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => handleCategoryChange(null)}
            className={`catalog-tab ${activeCategory === null ? "is-active" : ""}`}
          >
            Все
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => handleCategoryChange(cat)}
              className={`catalog-tab ${activeCategory === cat ? "is-active" : ""}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Controls: search + sort + view toggle + filters button */}
        <div className="catalog-controls">
          <div className="catalog-controls-main">
            <div className="search-field catalog-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Поиск по названию или бренду..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="input"
              />
            </div>

            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value as FilterState["sortBy"],
                }))
              }
              className="select catalog-sort"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog-actions">
            <div className="view-toggle" aria-label="Вид каталога">
              <button
                type="button"
                onClick={() => handleViewModeChange("grid")}
                className={`view-toggle-button ${viewMode === "grid" ? "active" : ""}`}
                aria-pressed={viewMode === "grid"}
              >
                <Grid2X2 size={15} />
                Плитка
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("list")}
                className={`view-toggle-button ${viewMode === "list" ? "active" : ""}`}
                aria-pressed={viewMode === "list"}
              >
                <List size={15} />
                Список
              </button>
            </div>

            <button
              onClick={() => setShowFilters((open) => !open)}
              className={`btn filter-button ${
                showFilters || hasActiveFilters ? "btn-primary" : "btn-secondary"
              }`}
            >
              <SlidersHorizontal size={16} />
              Фильтры
            </button>
          </div>
        </div>

        {/* Filter panel */}
        <div className={`filter-panel ${showFilters ? "" : "is-hidden"}`}>
          {/* Brand filter (all categories) */}
          {brands.length > 0 && (
            <div>
              <h4 className="filter-title">Бренд</h4>
              <div className="filter-options">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className={`chip ${filters.brands.includes(brand) ? "is-active" : ""}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category-specific attribute filters */}
          {attrFilterConfig.map(({ key, label }) => {
            const options = attrOptions[key] ?? [];
            if (!options.length) return null;
            const active = filters.attributeFilters[key] ?? [];
            return (
              <div key={key}>
                <h4 className="filter-title">{label}</h4>
                <div className="filter-options">
                  {options.map((val) => (
                    <button
                      key={val}
                      onClick={() => toggleAttr(key, val)}
                      className={`chip ${active.includes(val) ? "is-active" : ""}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Price range + stock (all categories) */}
          <div className="filter-row">
            <label className="form-field">
              <span className="form-label">Цена от</span>
              <input
                type="number"
                placeholder="0"
                value={filters.priceMin ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    priceMin: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="input"
              />
            </label>
            <label className="form-field">
              <span className="form-label">Цена до</span>
              <input
                type="number"
                placeholder="999999"
                value={filters.priceMax ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    priceMax: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="input"
              />
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, inStockOnly: e.target.checked }))
                }
              />
              Только в наличии
            </label>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-ghost">
                <X size={14} />
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <p className="section-subtitle">
          {loading ? "Загрузка..." : pluralItems(filtered.length)}
        </p>

        {/* Product grid / list / skeleton */}
        {loading ? (
          <div
            className={`${
              viewMode === "list" ? "product-list" : "product-grid compact-grid"
            } catalog-results`}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`product-card product-card--${viewMode} ${
                  viewMode === "grid" ? "product-card--compact" : "product-list-item"
                }`}
              >
                <div
                  className={`${
                    viewMode === "list" ? "product-list-media " : ""
                  }product-card-media product-card-image skeleton`}
                />
                <div
                  className={
                    viewMode === "list" ? "product-list-content" : "product-card-body"
                  }
                >
                  <div className="skeleton skeleton-line is-short" />
                  <div className="skeleton skeleton-line is-full" />
                  <div className="skeleton skeleton-line is-medium" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-inner">
              <h2 className="section-title">Ничего не найдено</h2>
              <p className="section-subtitle">
                Попробуйте изменить параметры поиска или сбросить фильтры.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`${
              viewMode === "list" ? "product-list" : "product-grid compact-grid"
            } catalog-results`}
          >
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} variant={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogContent />
    </Suspense>
  );
}
