import type { Discount, DiscountPayload, DiscountType } from "./types";

export type FormState = {
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  priority: string;
  max_discount_amount: string;
  start_at: string;
  end_at: string;
  product_ids: string;
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

export const emptyForm: FormState = {
  name: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  priority: "0",
  max_discount_amount: "",
  start_at: "",
  end_at: "",
  product_ids: "",
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

const formatProductIDs = (ids?: string[] | null) => {
  if (!ids || ids.length === 0) return "";
  return ids.join("\n");
};

export const parseProductIDs = (value: string) => {
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

export const discountToForm = (d: Discount): FormState => ({
  name: d.name,
  description: d.description ?? "",
  discount_type: d.discount_type,
  discount_value: String(d.discount_value),
  priority: String(d.priority ?? 0),
  max_discount_amount: d.max_discount_amount != null ? String(d.max_discount_amount) : "",
  start_at: toLocalDatetime(d.start_at),
  end_at: toLocalDatetime(d.end_at),
  product_ids: formatProductIDs(d.product_ids),
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

export const formToPayload = (f: FormState): DiscountPayload => {
  const startAt = toLocalDatetimeToRFC3339(f.start_at);
  if (!startAt) throw new Error("start_at wajib diisi");
  const priority = optionalInt(f.priority) ?? 0;

  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    discount_type: f.discount_type,
    discount_value: parseFloat(f.discount_value) || 0,
    priority,
    max_discount_amount: optionalFloat(f.max_discount_amount),
    start_at: startAt,
    end_at: toLocalDatetimeToRFC3339(f.end_at),
    product_ids: parseProductIDs(f.product_ids),
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

type Props = {
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
  hideProductField?: boolean;
};

export default function DiscountFormModal({
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
  hideProductField = false,
}: Props) {
  if (!open) return null;

  const inp = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
  const labelCls = "text-sm";
  const labelSpan = "mb-1 block text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 overflow-y-auto">
      <div className="my-4 w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {mode === "create" ? "Create Discount" : "Edit Discount"}
          </h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-2 py-1 text-sm hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            <span className={labelSpan}>Name *</span>
            <input className={inp} value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Diskon 10%" />
          </label>

          <label className={labelCls}>
            <span className={labelSpan}>Type</span>
            <select className={inp} value={form.discount_type} onChange={(e) => onChange({ discount_type: e.target.value as DiscountType })}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed (Rp)</option>
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Value *</span>
            <input type="number" min="0" className={inp} value={form.discount_value} onChange={(e) => onChange({ discount_value: e.target.value })} placeholder="10" />
          </label>
          <label className={labelCls}>
            <span className={labelSpan}>Priority</span>
            <input
              type="number"
              min="0"
              className={inp}
              value={form.priority}
              onChange={(e) => onChange({ priority: e.target.value })}
              placeholder="0"
            />
            <p className="text-xs text-slate-400">Angka lebih besar dijalankan lebih dulu saat kondisi sama.</p>
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

          {!hideProductField && (
            <>
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
                  value={form.product_ids}
                  onChange={(e) => onChange({ product_ids: e.target.value })}
                  placeholder="Pisahkan dengan koma atau enter"
                />
                <p className="text-xs text-slate-400">Ditampung juga di relasi, untuk flash sale/extra produk.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedProductIDs.length === 0 ? (
                    <span className="text-xs text-slate-400">Tidak ada produk yang dipilih.</span>
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
            </>
          )}
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
