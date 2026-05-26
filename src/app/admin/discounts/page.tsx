"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Calendar,
  Clock,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useAdminRole } from "@/lib/adminRole";
import { createClient } from "@/lib/supabase/client";
import {
  describeDiscountApply,
  describeDiscountTrigger,
  describeDiscountValue,
  isDiscountExpired,
  isDiscountPending,
} from "@/lib/discounts";
import { convertToKzt, formatKzt } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import type {
  Discount,
  DiscountApplyTo,
  DiscountTriggerType,
  DiscountType,
  Product,
  ProductCategory,
} from "@/types";

// ─── Form state ────────────────────────────────────────────────────────────

interface FormState {
  id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  priority: string;

  trigger_type: DiscountTriggerType;
  trigger_category_ids: ProductCategory[];
  trigger_product_ids: string[];
  trigger_threshold_amount: string;          // USD, as text
  trigger_min_quantity: string;

  apply_to: DiscountApplyTo;
  apply_category_ids: ProductCategory[];
  apply_product_ids: string[];

  discount_type: DiscountType;
  discount_value: string;

  valid_from: string;                        // datetime-local
  valid_until: string;
}

const empty: FormState = {
  id: null,
  name: "",
  description: "",
  is_active: true,
  priority: "0",
  trigger_type: "all_cart",
  trigger_category_ids: [],
  trigger_product_ids: [],
  trigger_threshold_amount: "",
  trigger_min_quantity: "",
  apply_to: "all_cart",
  apply_category_ids: [],
  apply_product_ids: [],
  discount_type: "percentage",
  discount_value: "10",
  valid_from: "",
  valid_until: "",
};

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "oil", label: "Масла" },
  { value: "perfume", label: "Парфюм" },
  { value: "accessory", label: "Аксессуары" },
];

const TRIGGER_LABEL: Record<DiscountTriggerType, string> = {
  all_cart: "Сумма всей корзины",
  category_total: "Сумма по категории",
  category_per_product: "По товару в категории (порог на каждый)",
  specific_products: "Конкретные товары",
};

const APPLY_LABEL: Record<DiscountApplyTo, string> = {
  all_cart: "Вся корзина",
  category: "Категории",
  trigger_product: "Триггерные товары",
  specific_products: "Выбранные товары",
};

// Convert ISO timestamp → value usable in <input type="datetime-local">
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toFormState(d: Discount): FormState {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    is_active: d.is_active,
    priority: String(d.priority ?? 0),
    trigger_type: d.trigger_type,
    trigger_category_ids: d.trigger_category_ids ?? [],
    trigger_product_ids: d.trigger_product_ids ?? [],
    trigger_threshold_amount: d.trigger_threshold_amount != null ? String(d.trigger_threshold_amount) : "",
    trigger_min_quantity: d.trigger_min_quantity != null ? String(d.trigger_min_quantity) : "",
    apply_to: d.apply_to,
    apply_category_ids: d.apply_category_ids ?? [],
    apply_product_ids: d.apply_product_ids ?? [],
    discount_type: d.discount_type,
    discount_value: String(d.discount_value),
    valid_from: isoToLocalInput(d.valid_from),
    valid_until: isoToLocalInput(d.valid_until),
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminDiscountsPage() {
  const { role } = useAdminRole();
  const isAdmin = role === "admin";
  const supabase = useMemo(() => createClient(), []);
  const kztRate = useCurrencyStore((s) => s.kztRate);

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  // Single product picker, used for both trigger_product_ids and apply_product_ids.
  type PickerTarget = "trigger" | "apply" | null;
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: ds, error }, { data: prods }] = await Promise.all([
      supabase.from("discounts").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, brand, category, code").order("name"),
    ]);
    if (error) toast.error("Не удалось загрузить скидки. Запустите supabase/migrations/discounts_v2.sql");
    setDiscounts(((ds as Discount[]) ?? []));
    setProducts(((prods as unknown) as Product[]) ?? []);
    setLoading(false);
  }

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.code?.toLowerCase().includes(q) ?? false),
    );
  }, [products, productSearch]);

  const openNew = () => { setForm(empty); setModalOpen(true); };
  const openEdit = (d: Discount) => { setForm(toFormState(d)); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  // ─── Form updaters ──────────────────────────────────────────────────────

  const toggleCategory = (key: "trigger_category_ids" | "apply_category_ids", cat: ProductCategory) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(cat) ? prev[key].filter((c) => c !== cat) : [...prev[key], cat],
    }));
  };

  const removeProductFromList = (key: "trigger_product_ids" | "apply_product_ids", id: string) => {
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== id) }));
  };

  const onPickProduct = (id: string) => {
    if (pickerTarget === "trigger") {
      setForm((prev) => ({
        ...prev,
        trigger_product_ids: prev.trigger_product_ids.includes(id)
          ? prev.trigger_product_ids
          : [...prev.trigger_product_ids, id],
      }));
    } else if (pickerTarget === "apply") {
      setForm((prev) => ({
        ...prev,
        apply_product_ids: prev.apply_product_ids.includes(id)
          ? prev.apply_product_ids
          : [...prev.apply_product_ids, id],
      }));
    }
  };

  const handleTriggerTypeChange = (next: DiscountTriggerType) => {
    setForm((prev) => {
      // category_per_product is always paired with apply_to='trigger_product'
      // — the qualifying lines are the only meaningful target.
      if (next === "category_per_product") {
        return { ...prev, trigger_type: next, apply_to: "trigger_product" };
      }
      // apply_to='trigger_product' only makes sense for specific_products / category_per_product.
      const apply_to =
        prev.apply_to === "trigger_product" && next !== "specific_products"
          ? "all_cart"
          : prev.apply_to;
      return { ...prev, trigger_type: next, apply_to };
    });
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!isAdmin) return;

    if (!form.name.trim()) { toast.error("Укажите название"); return; }

    const value = Number(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Размер скидки должен быть > 0"); return; }
    if (form.discount_type === "percentage" && value > 100) { toast.error("Процент не может быть больше 100"); return; }

    // Trigger validation
    if (form.trigger_type === "category_total" && form.trigger_category_ids.length === 0) {
      toast.error("Выберите хотя бы одну категорию для условия"); return;
    }
    if (form.trigger_type === "category_per_product") {
      if (form.trigger_category_ids.length === 0) {
        toast.error("Выберите хотя бы одну категорию для условия"); return;
      }
      const tRaw = form.trigger_threshold_amount.trim();
      const qRaw = form.trigger_min_quantity.trim();
      const tNum = tRaw === "" ? null : Number(tRaw);
      const qNum = qRaw === "" ? null : Number(qRaw);
      const hasT = tNum != null && Number.isFinite(tNum) && tNum > 0;
      const hasQ = qNum != null && Number.isFinite(qNum) && qNum >= 1;
      if (!hasT && !hasQ) {
        toast.error("Укажите порог суммы ($) или минимальное количество товара"); return;
      }
    }
    if (form.trigger_type === "specific_products" && form.trigger_product_ids.length === 0) {
      toast.error("Выберите хотя бы один товар-триггер"); return;
    }

    // Apply validation
    if (form.apply_to === "category" && form.apply_category_ids.length === 0) {
      toast.error("Выберите хотя бы одну категорию для применения скидки"); return;
    }
    if (form.apply_to === "specific_products" && form.apply_product_ids.length === 0) {
      toast.error("Выберите хотя бы один товар для применения скидки"); return;
    }
    if (
      form.apply_to === "trigger_product"
      && form.trigger_type !== "specific_products"
      && form.trigger_type !== "category_per_product"
    ) {
      toast.error("«К триггерным товарам» работает только с условиями «Конкретные товары» или «По товару в категории»"); return;
    }

    const validFrom = localInputToIso(form.valid_from);
    const validUntil = localInputToIso(form.valid_until);
    if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
      toast.error("«Действует с» должно быть раньше «по»"); return;
    }

    const triggerThreshold = form.trigger_threshold_amount === ""
      ? null
      : Math.max(0, Number(form.trigger_threshold_amount));
    const triggerMinQty = form.trigger_min_quantity === ""
      ? null
      : Math.max(1, Math.floor(Number(form.trigger_min_quantity)));

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
      priority: Math.max(0, parseInt(form.priority, 10) || 0),
      trigger_type: form.trigger_type,
      trigger_category_ids:
        form.trigger_type === "category_total" || form.trigger_type === "category_per_product"
          ? form.trigger_category_ids
          : null,
      trigger_product_ids: form.trigger_type === "specific_products" ? form.trigger_product_ids : null,
      trigger_threshold_amount:
        form.trigger_type === "specific_products" || form.trigger_type === "category_per_product"
          ? triggerThreshold
          : (triggerThreshold ?? 0),
      trigger_min_quantity:
        form.trigger_type === "specific_products" || form.trigger_type === "category_per_product"
          ? triggerMinQty
          : null,
      apply_to: form.apply_to,
      apply_category_ids: form.apply_to === "category" ? form.apply_category_ids : null,
      apply_product_ids: form.apply_to === "specific_products" ? form.apply_product_ids : null,
      discount_type: form.discount_type,
      discount_value: value,
      valid_from: validFrom,
      valid_until: validUntil,
    };

    setSaving(true);
    const op = form.id
      ? supabase.from("discounts").update(payload).eq("id", form.id)
      : supabase.from("discounts").insert(payload);
    const { error } = await op;
    setSaving(false);

    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Скидка обновлена" : "Скидка создана");
    setModalOpen(false);
    void loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Удалить скидку?")) return;
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Скидка удалена");
    void loadAll();
  };

  const toggleActive = async (d: Discount) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("discounts").update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) toast.error(error.message);
    else void loadAll();
  };

  // ─── Live KZT preview for USD inputs ─────────────────────────────────────

  const liveKzt = (usdText: string): string => {
    const n = Number(usdText);
    if (!Number.isFinite(n) || n <= 0) return "";
    return formatKzt(convertToKzt(n, kztRate));
  };

  const showApplyTriggerProduct = form.trigger_type === "specific_products";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Percent size={20} className="text-[var(--gold)]" />
            Скидки
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Для каждой позиции применяется только одна скидка — та, что даёт большую экономию (при равенстве — с большим приоритетом).
          </p>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
            <Plus size={16} className="relative z-10" /> <span>Новая скидка</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : discounts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] p-12 text-center">
          <Tag size={32} className="mx-auto text-[var(--gold)] mb-3" />
          <p className="text-[var(--text-secondary)] mb-3">Скидок пока нет</p>
          {isAdmin && (
            <button onClick={openNew} className="btn-gold px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2 cursor-pointer">
              <Plus size={16} /> Создать первую
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => {
            const expired = isDiscountExpired(d);
            const pending = isDiscountPending(d);
            const status = !d.is_active ? "off" : expired ? "expired" : pending ? "pending" : "on";
            return (
              <div
                key={d.id}
                className={`rounded-xl border bg-[var(--dark-2)] p-4 flex flex-col md:flex-row md:items-center gap-4 ${
                  status === "on" ? "border-[var(--gold)]/30" : "border-[var(--border)] opacity-70"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">{d.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] font-bold">
                      −{describeDiscountValue(d)}
                    </span>
                    {status === "off" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-secondary)]">Выключена</span>
                    )}
                    {status === "expired" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Истекла</span>
                    )}
                    {status === "pending" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">Ещё не началась</span>
                    )}
                    {d.priority > 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                        приоритет {d.priority}
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{d.description}</p>
                  )}
                  <div className="text-xs text-[var(--text-secondary)] mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <span><b className="text-[var(--text-primary)]">Условие:</b> {describeDiscountTrigger(d)}</span>
                    <span><b className="text-[var(--text-primary)]">На что:</b> {describeDiscountApply(d)}</span>
                    {(d.valid_from || d.valid_until) && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {d.valid_from ? new Date(d.valid_from).toLocaleDateString("ru-RU") : "…"}
                        {" – "}
                        {d.valid_until ? new Date(d.valid_until).toLocaleDateString("ru-RU") : "…"}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        onChange={() => toggleActive(d)}
                        className="accent-[var(--gold)] w-4 h-4"
                      />
                      Активна
                    </label>
                    <button onClick={() => openEdit(d)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────── Modal form ────────────── */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card modal-form w-full max-w-2xl p-6 bg-[var(--dark-2)] overflow-y-auto max-h-[90vh]">
            <div className="modal-form-header">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {form.id ? "Редактировать скидку" : "Новая скидка"}
              </h2>
              <button type="button" onClick={closeModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>

            <div className="modal-form-body">
              {/* Basics */}
              <div className="form-group">
                <label className="form-label">Название</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Например: Скидка на масла"
                  className="input-dark"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Описание (для админки)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Например: летняя акция"
                  className="input-dark resize-none"
                />
              </div>

              <div className="form-grid">
                <label className="form-group form-group-inline">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="accent-[var(--gold)] w-4 h-4"
                  />
                  <span className="form-label cursor-pointer">Активна</span>
                </label>
                <div className="form-group">
                  <label className="form-label">Приоритет</label>
                  <input
                    type="number" min={0} value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="input-dark"
                  />
                  <p className="form-help">Тай-брейк при равной выгоде: больший приоритет побеждает.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label flex items-center gap-1"><Clock size={12} /> Действует с</label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="input-dark"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label flex items-center gap-1"><Clock size={12} /> Действует по</label>
                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="input-dark"
                  />
                </div>
              </div>

              {/* ─── Trigger ───────────────────────────────────────────── */}
              <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--gold)] font-semibold">
                  По чему создается скидка (условие)
                </p>
                <div className="form-group">
                  <select
                    value={form.trigger_type}
                    onChange={(e) => handleTriggerTypeChange(e.target.value as DiscountTriggerType)}
                    className="input-dark"
                  >
                    {(Object.keys(TRIGGER_LABEL) as DiscountTriggerType[]).map((k) => (
                      <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>
                    ))}
                  </select>
                </div>

                {(form.trigger_type === "category_total" || form.trigger_type === "category_per_product") && (
                  <div className="form-group">
                    <label className="form-label">Категории (одна или несколько)</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((c) => {
                        const checked = form.trigger_category_ids.includes(c.value);
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => toggleCategory("trigger_category_ids", c.value)}
                            className={`text-sm px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                              checked
                                ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
                                : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.trigger_type === "category_per_product" && (
                      <p className="form-help">
                        Условие проверяется отдельно для каждого товара. Можно задать минимальное количество, минимальную сумму, или оба.
                      </p>
                    )}
                  </div>
                )}

                {form.trigger_type === "category_per_product" && (
                  <div className="form-group">
                    <label className="form-label">Мин. количество товара (необязательно)</label>
                    <input
                      type="number" min={1} value={form.trigger_min_quantity}
                      onChange={(e) => setForm({ ...form, trigger_min_quantity: e.target.value })}
                      placeholder="например 3"
                      className="input-dark"
                    />
                  </div>
                )}

                {form.trigger_type === "specific_products" && (
                  <div className="space-y-2">
                    <label className="form-label">Товары-триггеры</label>
                    <div className="flex flex-wrap gap-1.5">
                      {form.trigger_product_ids.length === 0 && (
                        <span className="text-xs text-[var(--text-secondary)]">Список пуст</span>
                      )}
                      {form.trigger_product_ids.map((id) => {
                        const p = productsById.get(id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--gold)]/15 text-[var(--gold)]">
                            {p?.code && <span className="font-mono">{p.code}</span>}
                            <span className="truncate max-w-[180px]">{p?.name ?? id}</span>
                            <button onClick={() => removeProductFromList("trigger_product_ids", id)} className="hover:text-red-400" aria-label="Убрать">
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProductSearch(""); setPickerTarget("trigger"); }}
                      className="btn-outline-gold text-xs px-3 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2"
                    >
                      <Plus size={14} /> Добавить товар
                    </button>
                    <div className="form-group">
                      <label className="form-label">Мин. количество (по каждому, необязательно)</label>
                      <input
                        type="number" min={1} value={form.trigger_min_quantity}
                        onChange={(e) => setForm({ ...form, trigger_min_quantity: e.target.value })}
                        placeholder="по умолчанию 1"
                        className="input-dark"
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    {form.trigger_type === "specific_products"
                      ? "Мин. сумма по этим товарам, $ (необязательно)"
                      : form.trigger_type === "category_per_product"
                        ? "Порог суммы на каждый товар, $ (необязательно)"
                        : "Порог, $"}
                  </label>
                  <input
                    type="number" min={0} step="0.01" value={form.trigger_threshold_amount}
                    onChange={(e) => setForm({ ...form, trigger_threshold_amount: e.target.value })}
                    placeholder={form.trigger_type === "all_cart" ? "например 100" : ""}
                    className="input-dark"
                  />
                  {liveKzt(form.trigger_threshold_amount) && (
                    <p className="form-help" style={{ color: "var(--gold)" }}>
                      ≈ {liveKzt(form.trigger_threshold_amount)}
                    </p>
                  )}
                </div>
              </div>

              {/* ─── Apply ────────────────────────────────────────────── */}
              <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--gold)] font-semibold">
                  К чему применяется скидка
                </p>
                {form.trigger_type === "category_per_product" ? (
                  <div className="rounded-md border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3 text-xs text-[var(--text-secondary)]">
                    Применяется к каждому товару из выбранных категорий, чья сумма ≥ порога. Изменить нельзя.
                  </div>
                ) : (
                  <div className="form-group">
                    <select
                      value={form.apply_to}
                      onChange={(e) => setForm({ ...form, apply_to: e.target.value as DiscountApplyTo })}
                      className="input-dark"
                    >
                      <option value="all_cart">{APPLY_LABEL.all_cart}</option>
                      <option value="category">{APPLY_LABEL.category}</option>
                      {showApplyTriggerProduct && (
                        <option value="trigger_product">{APPLY_LABEL.trigger_product} (те же, что в условии)</option>
                      )}
                      <option value="specific_products">{APPLY_LABEL.specific_products}</option>
                    </select>
                  </div>
                )}

                {form.trigger_type !== "category_per_product" && form.apply_to === "category" && (
                  <div className="form-group">
                    <label className="form-label">Категории применения</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((c) => {
                        const checked = form.apply_category_ids.includes(c.value);
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => toggleCategory("apply_category_ids", c.value)}
                            className={`text-sm px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                              checked
                                ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
                                : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.apply_to === "specific_products" && (
                  <div className="space-y-2">
                    <label className="form-label">Товары, к которым применится скидка</label>
                    <div className="flex flex-wrap gap-1.5">
                      {form.apply_product_ids.length === 0 && (
                        <span className="text-xs text-[var(--text-secondary)]">Список пуст</span>
                      )}
                      {form.apply_product_ids.map((id) => {
                        const p = productsById.get(id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--gold)]/15 text-[var(--gold)]">
                            {p?.code && <span className="font-mono">{p.code}</span>}
                            <span className="truncate max-w-[180px]">{p?.name ?? id}</span>
                            <button onClick={() => removeProductFromList("apply_product_ids", id)} className="hover:text-red-400" aria-label="Убрать">
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setProductSearch(""); setPickerTarget("apply"); }}
                      className="btn-outline-gold text-xs px-3 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2"
                    >
                      <Plus size={14} /> Добавить товар
                    </button>
                  </div>
                )}
              </div>

              {/* ─── Value ────────────────────────────────────────────── */}
              <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--gold)] font-semibold">Размер скидки</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discount_type: "percentage" })}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                      form.discount_type === "percentage"
                        ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
                        : "bg-transparent border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    Процент (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discount_type: "fixed" })}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                      form.discount_type === "fixed"
                        ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
                        : "bg-transparent border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    Фиксированная (₸)
                  </button>
                </div>
                <input
                  type="number" min={0}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === "percentage" ? "10" : "5000"}
                  className="input-dark"
                />
              </div>
            </div>

            <div className="modal-form-actions">
              <button type="button" onClick={closeModal} className="btn-outline-gold flex-1 py-2.5 rounded-lg text-sm cursor-pointer">Отмена</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin relative z-10" /> : <Save size={16} className="relative z-10" />}
                <span>{saving ? "Сохранение..." : "Сохранить"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────── Product picker ────────────── */}
      {pickerTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-xl bg-[var(--dark-2)] rounded-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between gap-3 p-5 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {pickerTarget === "trigger" ? "Добавить товар в условие" : "Добавить товар для скидки"}
              </h3>
              <button onClick={() => setPickerTarget(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 border-b border-[var(--border)]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  autoFocus type="text" value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Поиск по имени, бренду или коду..."
                  className="input-dark w-full pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="p-6 text-sm text-[var(--text-secondary)]">Ничего не найдено</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]/40">
                  {filteredProducts.slice(0, 200).map((p) => {
                    const alreadyAdded = pickerTarget === "trigger"
                      ? form.trigger_product_ids.includes(p.id)
                      : form.apply_product_ids.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => !alreadyAdded && onPickProduct(p.id)}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${alreadyAdded ? "opacity-50" : "hover:bg-white/[0.04]"}`}
                        >
                          {p.code && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] shrink-0">
                              {p.code}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text-primary)] truncate">{p.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {p.brand} · {CATEGORY_OPTIONS.find((c) => c.value === p.category)?.label}
                            </p>
                          </div>
                          {alreadyAdded && <span className="text-xs text-[var(--gold)] shrink-0">добавлен</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border)]">
              <button onClick={() => setPickerTarget(null)} className="btn-gold w-full py-2.5 rounded-lg text-sm cursor-pointer">Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
