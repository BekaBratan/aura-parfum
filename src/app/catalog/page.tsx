"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Product, FilterState } from "@/types";
import ProductCard from "@/components/product/ProductCard";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react";

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

  // Fetch products
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      const list = (data as Product[]) || [];
      setProducts(list);

      // extract unique brands
      const uniqueBrands = [...new Set(list.map((p) => p.brand))].sort();
      setBrands(uniqueBrands);

      setLoading(false);
    }
    load();
  }, []);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...products];

    // search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
    }

    // brand
    if (filters.brands.length > 0) {
      list = list.filter((p) => filters.brands.includes(p.brand));
    }

    // gender
    if (filters.genders.length > 0) {
      list = list.filter((p) => filters.genders.includes(p.gender));
    }

    // volume
    if (filters.volumes.length > 0) {
      list = list.filter(
        (p) => p.volume_ml !== null && filters.volumes.includes(p.volume_ml)
      );
    }

    // price
    if (filters.priceMin !== null) {
      list = list.filter((p) => p.price >= filters.priceMin!);
    }
    if (filters.priceMax !== null) {
      list = list.filter((p) => p.price <= filters.priceMax!);
    }

    // stock
    if (filters.inStockOnly) {
      list = list.filter((p) => p.in_stock);
    }

    // sort
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
    (
      key: "brands" | "genders" | "volumes",
      value: string | number
    ) => {
      setFilters((prev) => {
        const arr = prev[key] as (string | number)[];
        return {
          ...prev,
          [key]: arr.includes(value)
            ? arr.filter((v) => v !== value)
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

  const hasActiveFilters =
    filters.brands.length > 0 ||
    filters.genders.length > 0 ||
    filters.volumes.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.inStockOnly;

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-[var(--gold)] mb-2">
            Коллекция
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Каталог ароматов
          </h1>
        </div>

        {/* Search + sort bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <input
              type="text"
              placeholder="Поиск по названию или бренду..."
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              className="input-dark pl-11"
            />
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    sortBy: e.target.value as FilterState["sortBy"],
                  }))
                }
                className="input-dark pr-10 appearance-none cursor-pointer text-sm min-w-[190px]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm cursor-pointer transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-[var(--gold)] text-[var(--dark)]"
                  : "bg-[var(--dark-3)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)]"
              }`}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">Фильтры</span>
            </button>
          </div>
        </div>

        {/* Filters panel */}
        <div
          className={`overflow-hidden transition-all duration-400 ${
            showFilters ? "max-h-[600px] opacity-100 mb-6" : "max-h-0 opacity-0"
          }`}
        >
          <div className="glass-card p-5 space-y-5">
            {/* Brands */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[var(--gold)] mb-3">
                Бренд
              </h4>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => toggleFilter("brands", b)}
                    className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all ${
                      filters.brands.includes(b)
                        ? "bg-[var(--gold)] text-[var(--dark)] font-semibold"
                        : "bg-[var(--dark-3)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--gold)]"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[var(--gold)] mb-3">
                Пол
              </h4>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => toggleFilter("genders", g.value)}
                    className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all ${
                      filters.genders.includes(g.value)
                        ? "bg-[var(--gold)] text-[var(--dark)] font-semibold"
                        : "bg-[var(--dark-3)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--gold)]"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[var(--gold)] mb-3">
                Объём (мл)
              </h4>
              <div className="flex flex-wrap gap-2">
                {VOLUMES.map((v) => (
                  <button
                    key={v}
                    onClick={() => toggleFilter("volumes", v)}
                    className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all ${
                      filters.volumes.includes(v)
                        ? "bg-[var(--gold)] text-[var(--dark)] font-semibold"
                        : "bg-[var(--dark-3)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--gold)]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Price + stock */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex gap-3 flex-1">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Цена от (₸)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.priceMin ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        priceMin: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="input-dark w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Цена до (₸)
                  </label>
                  <input
                    type="number"
                    placeholder="999999"
                    value={filters.priceMax ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        priceMax: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="input-dark w-full text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer whitespace-nowrap pb-1">
                <input
                  type="checkbox"
                  checked={filters.inStockOnly}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      inStockOnly: e.target.checked,
                    }))
                  }
                  className="accent-[var(--gold)] w-4 h-4"
                />
                Только в наличии
              </label>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap pb-1"
                >
                  <X size={14} />
                  Сбросить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {loading
            ? "Загрузка..."
            : `Найдено: ${filtered.length} ${filtered.length === 1 ? "аромат" : "ароматов"}`}
        </p>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="aspect-[3/4] skeleton" />
                <div className="p-4 space-y-2">
                  <div className="h-3 skeleton w-16" />
                  <div className="h-4 skeleton w-full" />
                  <div className="h-4 skeleton w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--text-secondary)] text-lg mb-2">
              Ничего не найдено
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Попробуйте изменить параметры поиска
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((p, i) => (
              <div
                key={p.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
