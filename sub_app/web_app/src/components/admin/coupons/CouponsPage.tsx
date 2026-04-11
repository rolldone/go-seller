import { useCallback, useEffect, useState } from "react";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import { notifyError, notifySuccess } from "../../../lib/notification";
import CouponsTable from "./CouponsTable";
import ProductPickerModal from "./ProductPickerModal";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "./api";
import type { Coupon, CouponCategory, CouponPayload, CouponType } from "./types";

type FormState = {
  code: string;
  name: string;
  category: CouponCategory;
  description: string;
  discount_type: CouponType;
  discount_value: string;
  max_discount_amount: string;
  start_at: string;
  end_at: string;
  product_ids_text: string;
  selectedProductIDs: string[];
  product_min_qty: string;
  product_qty_limit: string;
  min_order_amount: string;
  per_user_only: boolean;
  customer_id: string;
  usage_limit: string;
  usage_limit_per_user: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  category: "product_discount",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  max_discount_amount: "",
  start_at: "",
  end_at: "",
  product_ids_text: "",
  selectedProductIDs: [],
  product_min_qty: "",
  product_qty_limit: "",
  min_order_amount: "",
  per_user_only: false,
  customer_id: "",
  usage_limit: "",
  usage_limit_per_user: "",
  is_active: true,
};

const toLocalDatetime = (iso: string | null | undefined) => {
  if (!iso) return "";
  // datetime-local input requires "YYYY-MM-DDTHH:mm"
  return iso.slice(0, 16);
};

const toLocalDatetimeToRFC3339 = (value: string) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const optionalInt = (value: string) => {
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
};

const optionalFloat = (value: string) => {
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
};

const parseProductIDs = (value: string) => {
  const seen = new Set<string>();
  value
    .split(/[\n,]+/)
    .map((segment) => segment.trim())
    .forEach((id) => {
      if (id) {
        seen.add(id);
      }
    });
  return Array.from(seen);
};

const shortID = (value: string) => value.slice(0, 8);

const couponToForm = (d: Coupon): FormState => ({
  code: d.code,
  name: d.name,
  category: (d.category as CouponCategory) || "product_discount",
  description: d.description ?? "",
  discount_type: d.discount_type,
  discount_value: String(d.discount_value),
  max_discount_amount: d.max_discount_amount != null ? String(d.max_discount_amount) : "",
  start_at: toLocalDatetime(d.start_at),
  end_at: toLocalDatetime(d.end_at),
  product_ids_text: d.product_ids?.join("\n") ?? "",
  selectedProductIDs: d.product_ids ?? [],
  product_min_qty: d.product_min_qty != null ? String(d.product_min_qty) : "",
  product_qty_limit: d.product_qty_limit != null ? String(d.product_qty_limit) : "",
  min_order_amount: d.min_order_amount != null ? String(d.min_order_amount) : "",
  per_user_only: d.per_user_only,
  customer_id: d.customer_id ?? "",
  usage_limit: d.usage_limit != null ? String(d.usage_limit) : "",
  usage_limit_per_user: d.usage_limit_per_user != null ? String(d.usage_limit_per_user) : "",
  is_active: d.is_active,
});

const formToPayload = (f: FormState): CouponPayload => {
  const startAt = toLocalDatetimeToRFC3339(f.start_at);
  if (!startAt) throw new Error("start_at wajib diisi");

  const product_ids = parseProductIDs(f.product_ids_text);

  return {
    code: f.code.trim(),
    name: f.name.trim(),
    category: f.category,
    description: f.description.trim() || undefined,
    discount_type: f.discount_type,
    discount_value: parseFloat(f.discount_value) || 0,
    max_discount_amount: optionalFloat(f.max_discount_amount),
    start_at: startAt,
    end_at: toLocalDatetimeToRFC3339(f.end_at),
    product_ids,
    product_min_qty: optionalInt(f.product_min_qty),
    product_qty_limit: optionalInt(f.product_qty_limit),
    min_order_amount: optionalFloat(f.min_order_amount),
    per_user_only: f.per_user_only,
    customer_id: f.customer_id.trim() || null,
    usage_limit: optionalInt(f.usage_limit),
    usage_limit_per_user: optionalInt(f.usage_limit_per_user),
    is_active: f.is_active,
  };
};

function CouponFormModal({
  open,
  mode,
  form,
  submitting,
  onChange,
  onClose,
  onSubmit,
  selectedProductIDs,
  onOpenProductPicker,
  onRemoveProduct,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: FormState;
  submitting: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  selectedProductIDs: string[];
  onOpenProductPicker: () => void;
  onRemoveProduct: (id: string) => void;
}) {
  if (!open) return null;

  const inp = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
  const labelCls = "text-sm";
  const labelSpan = "mb-1 block text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 overflow-y-auto">
      <div className="my-4 w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {mode === "create" ? "Create Coupon" : "Edit Coupon"}
          </h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-2 py-1 text-sm hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            <span className={labelSpan}>Code *</span>
            <input className={inp} value={form.code} onChange={(e) => onChange({ code: e.target.value })} placeholder="PROMO10" />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Name *</span>
            <input className={inp} value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Coupon 10%" />
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Category</span>
            <select className={inp} value={form.category} onChange={(e) => onChange({ category: e.target.value as CouponCategory })}>
              <option value="product_discount">Product Discount (per product)</option>
              <option value="total_discount">Total Discount (order subtotal)</option>
              <option value="shipping_discount">Shipping Discount</option>
              <option value="cashback">Cashback</option>
            </select>
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Type</span>
            <select className={inp} value={form.discount_type} onChange={(e) => onChange({ discount_type: e.target.value as CouponType })}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (Rp)</option>
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Value *</span>
            <input type="number" min="0" className={inp} value={form.discount_value} onChange={(e) => onChange({ discount_value: e.target.value })} placeholder="10" />
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Max Discount Amount</span>
            <input type="number" min="0" className={inp} value={form.max_discount_amount} onChange={(e) => onChange({ max_discount_amount: e.target.value })} placeholder="Optional" />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Min Order Amount</span>
            <input type="number" min="0" className={inp} value={form.min_order_amount} onChange={(e) => onChange({ min_order_amount: e.target.value })} placeholder="Optional" />
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Start At *</span>
            <input type="datetime-local" className={inp} value={form.start_at} onChange={(e) => onChange({ start_at: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>End At</span>
            <input type="datetime-local" className={inp} value={form.end_at} onChange={(e) => onChange({ end_at: e.target.value })} />
          </label>

          <label className={`${labelCls} sm:col-span-2`}>
            <div className="mb-1 flex items-center justify-between">
              <span className={labelSpan}>Product IDs</span>
              <button
                type="button"
                onClick={onOpenProductPicker}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Explore products
              </button>
            </div>
            <textarea
              className={inp}
              rows={3}
              value={form.product_ids_text}
              onChange={(e) => onChange({ product_ids_text: e.target.value })}
              placeholder="One UUID per line or comma separated (optional)"
            />
            <p className="text-xs text-slate-400">Leave empty to target all products.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProductIDs.length === 0 ? (
                <span className="text-xs text-slate-400">No products selected yet.</span>
              ) : (
                selectedProductIDs.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {shortID(id)}
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(id)}
                      className="rounded-full text-slate-400 transition hover:text-slate-600"
                      aria-label="Remove product"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>
              <span className={labelSpan}>Min Qty</span>
              <input type="number" min="1" className={inp} value={form.product_min_qty} onChange={(e) => onChange({ product_min_qty: e.target.value })} placeholder="-" />
            </label>
            <label className={labelCls}>
              <span className={labelSpan}>Qty Limit</span>
              <input type="number" min="1" className={inp} value={form.product_qty_limit} onChange={(e) => onChange({ product_qty_limit: e.target.value })} placeholder="-" />
            </label>
          </div>

          <label className={labelCls}>
            <span className={labelSpan}>Usage Limit</span>
            <input type="number" min="1" className={inp} value={form.usage_limit} onChange={(e) => onChange({ usage_limit: e.target.value })} placeholder="Unlimited" />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Usage Limit Per User</span>
            <input type="number" min="1" className={inp} value={form.usage_limit_per_user} onChange={(e) => onChange({ usage_limit_per_user: e.target.value })} placeholder="Unlimited" />
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Customer ID</span>
            <input className={inp} value={form.customer_id} onChange={(e) => onChange({ customer_id: e.target.value })} placeholder="UUID (optional, per-user)" />
          </label>

          <label className={`${labelCls} sm:col-span-2`}>
            <span className={labelSpan}>Description</span>
            <textarea className={inp} rows={2} value={form.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Optional" />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.per_user_only} onChange={(e) => onChange({ per_user_only: e.target.checked })} />
            Per user only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} />
            Active
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCoupons({ q, is_active: activeFilter, page, limit });
      setCoupons(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch coupons");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, limit, page, q]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedCoupon(null);
    setFormState(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setFormMode("edit");
    setSelectedCoupon(coupon);
    setFormState(couponToForm(coupon));
    setFormOpen(true);
  };

    const handleFormChange = (patch: Partial<FormState>) => {
      setFormState((prev) => {
        const next = { ...prev, ...patch };
        if ("product_ids_text" in patch) {
          next.selectedProductIDs = parseProductIDs(next.product_ids_text);
        }
        return next;
      });
    };

    const applySelectedProductIDs = (ids: string[]) => {
      const normalized = parseProductIDs(ids.join("\n"));
      setFormState((prev) => ({
        ...prev,
        selectedProductIDs: normalized,
        product_ids_text: normalized.join("\n"),
      }));
    };

    const handleRemoveSelectedProduct = (id: string) => {
      applySelectedProductIDs(formState.selectedProductIDs.filter((value) => value !== id));
    };

  const handleFormSubmit = async () => {
    setFormSubmitting(true);
    try {
      const payload = formToPayload(formState);
      if (!payload.code || !payload.name) {
        notifyError("Code dan name wajib diisi");
        return;
      }
      if (formMode === "create") {
        await createCoupon(payload);
        notifySuccess("Coupon created");
      } else if (selectedCoupon) {
        await updateCoupon(selectedCoupon.id, payload);
        notifySuccess("Coupon updated");
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCoupon) return;
    setDeleteSubmitting(true);
    try {
      await deleteCoupon(selectedCoupon.id);
      notifySuccess("Coupon deleted");
      setDeleteOpen(false);
      setSelectedCoupon(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete coupon");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Coupons</h3>
          <p className="text-sm text-slate-600">Kelola promo dan kode diskon.</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Coupon
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search code / name"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={activeFilter}
          onChange={(e) => { setPage(1); setActiveFilter(e.target.value as "" | "true" | "false"); }}
        >
          <option value="">All status</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
        >
          {[10, 20, 50].map((v) => (
            <option key={v} value={v}>{v} per page</option>
          ))}
        </select>
      </div>

      <CouponsTable
        coupons={coupons}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded bg-slate-100 px-3 py-1 hover:bg-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded bg-slate-100 px-3 py-1 hover:bg-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <CouponFormModal
        open={formOpen}
        mode={formMode}
        form={formState}
        submitting={formSubmitting}
        onChange={handleFormChange}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
          selectedProductIDs={formState.selectedProductIDs}
          onOpenProductPicker={() => setProductPickerOpen(true)}
          onRemoveProduct={handleRemoveSelectedProduct}
      />
        <ProductPickerModal
          open={productPickerOpen}
          selectedIds={formState.selectedProductIDs}
          onChange={applySelectedProductIDs}
          onClose={() => setProductPickerOpen(false)}
        />

      <EntityDeleteModal
        open={deleteOpen}
        title="Delete Coupon"
        itemName={selectedCoupon?.name ?? selectedCoupon?.code ?? ""}
        description={`Hapus coupon "${selectedCoupon?.name}" (${selectedCoupon?.code})?`}
        submitting={deleteSubmitting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
