"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Product, FilterState } from "@/types";
import ProductCard from "@/components/product/ProductCard";
import { Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";

type CatalogViewMode = "grid" | "list";

const CATALOG_VIEW_STORAGE_KEY = "catalogViewMode";

const GENDERS = [
  { value: "men", label: "Мужские" },
  { value: "women", label: "Женские" },
  { value: "unisex", label: "Унисекс" },
];

const VOLUMES = [30, 50, 75, 90, 100, 150, 200];

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
];

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<CatalogViewMode>("grid");

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    brands: [],
    genders: [],
    volumes: [],
    priceMin: null,
    priceMax: null,
    inStockOnly: false,
    sortBy: "newest",
  });

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const list = (data as Product[]) || [];
        setProducts(list);
        setBrands([...new Set(list.map((product) => product.brand))].sort());
      } catch (err) {
        console.error("Не удалось загрузить товары:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const storedViewMode = window.localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (storedViewMode === "grid" || storedViewMode === "list") {
      setViewMode(storedViewMode);
    }
  }, []);

  const filtered = useMemo(() => {
    let list = [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q)
      );
    }

    if (filters.brands.length > 0) {
      list = list.filter((product) => filters.brands.includes(product.brand));
    }

    if (filters.genders.length > 0) {
      list = list.filter((product) => filters.genders.includes(product.gender));
    }

    if (filters.volumes.length > 0) {
      list = list.filter(
        (product) =>
          product.volume_ml !== null && filters.volumes.includes(product.volume_ml)
      );
    }

    if (filters.priceMin !== null) {
      list = list.filter((product) => product.price >= filters.priceMin!);
    }

    if (filters.priceMax !== null) {
      list = list.filter((product) => product.price <= filters.priceMax!);
    }

    if (filters.inStockOnly) {
      list = list.filter((product) => Number(product.count ?? 0) > 0);
    }

    switch (filters.sortBy) {
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return list;
  }, [products, filters]);

  const toggleFilter = useCallback(
    (key: "brands" | "genders" | "volumes", value: string | number) => {
      setFilters((prev) => {
        const arr = prev[key] as (string | number)[];
        return {
          ...prev,
          [key]: arr.includes(value)
            ? arr.filter((item) => item !== value)
            : [...arr, value],
        };
      });
    },
    []
  );

  const clearFilters = () =>
    setFilters({
      search: "",
      brands: [],
      genders: [],
      volumes: [],
      priceMin: null,
      priceMax: null,
      inStockOnly: false,
      sortBy: "newest",
    });

  const handleViewModeChange = (mode: CatalogViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, mode);
  };

  const hasActiveFilters =
    filters.brands.length > 0 ||
    filters.genders.length > 0 ||
    filters.volumes.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.inStockOnly;

  return (
    <div className="catalog-layout">
      <div className="site-container">
        <div className="section-header">
          <div>
            <p className="eyebrow">Коллекция</p>
            <h1 className="section-title">Каталог ароматов</h1>
            <p className="section-subtitle">
              Подберите аромат по бренду, объему, цене и наличию.
            </p>
          </div>
        </div>

        <div className="catalog-controls">
          <div className="catalog-controls-main">
            <div className="search-field catalog-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Поиск по названию или бренду..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((current) => ({ ...current, search: e.target.value }))
                }
                className="input"
              />
            </div>

            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  sortBy: e.target.value as FilterState["sortBy"],
                }))
              }
              className="select catalog-sort"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              className={`btn filter-button ${showFilters || hasActiveFilters ? "btn-primary" : "btn-secondary"}`}
            >
              <SlidersHorizontal size={16} />
              Фильтры
            </button>
          </div>
        </div>

        <div className={`filter-panel ${showFilters ? "" : "is-hidden"}`}>
          <div>
            <h4 className="filter-title">Бренд</h4>
            <div className="filter-options">
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => toggleFilter("brands", brand)}
                  className={`chip ${filters.brands.includes(brand) ? "is-active" : ""}`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="filter-title">Пол</h4>
            <div className="filter-options">
              {GENDERS.map((gender) => (
                <button
                  key={gender.value}
                  onClick={() => toggleFilter("genders", gender.value)}
                  className={`chip ${filters.genders.includes(gender.value) ? "is-active" : ""}`}
                >
                  {gender.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="filter-title">Объем, мл</h4>
            <div className="filter-options">
              {VOLUMES.map((volume) => (
                <button
                  key={volume}
                  onClick={() => toggleFilter("volumes", volume)}
                  className={`chip ${filters.volumes.includes(volume) ? "is-active" : ""}`}
                >
                  {volume}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <label className="form-field">
              <span className="form-label">Цена от</span>
              <input
                type="number"
                placeholder="0"
                value={filters.priceMin ?? ""}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
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
                  setFilters((current) => ({
                    ...current,
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
                  setFilters((current) => ({
                    ...current,
                    inStockOnly: e.target.checked,
                  }))
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

        <p className="section-subtitle">
          {loading
            ? "Загрузка..."
            : `Найдено: ${filtered.length} ${filtered.length === 1 ? "аромат" : "ароматов"}`}
        </p>

        {loading ? (
          <div className={`${viewMode === "list" ? "product-list" : "product-grid compact-grid"} catalog-results`}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={`product-card product-card--${viewMode} ${
                  viewMode === "grid" ? "product-card--compact" : "product-list-item"
                }`}
              >
                <div
                  className={`${viewMode === "list" ? "product-list-media " : ""}product-card-media product-card-image skeleton`}
                />
                <div className={viewMode === "list" ? "product-list-content" : "product-card-body"}>
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
          <div className={`${viewMode === "list" ? "product-list" : "product-grid compact-grid"} catalog-results`}>
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} variant={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
