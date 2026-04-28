import MemberModal from "../ui/MemberModal";
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

export const discountToForm = (discount: Discount): FormState => ({
	name: discount.name,
	description: discount.description ?? "",
	discount_type: discount.discount_type,
	discount_value: String(discount.discount_value),
	priority: String(discount.priority ?? 0),
	max_discount_amount: discount.max_discount_amount != null ? String(discount.max_discount_amount) : "",
	start_at: toLocalDatetime(discount.start_at),
	end_at: toLocalDatetime(discount.end_at),
	product_ids: formatProductIDs(discount.product_ids),
	selectedProductIDs: discount.product_ids ?? [],
	product_min_qty: discount.product_min_qty != null ? String(discount.product_min_qty) : "",
	product_qty_limit: discount.product_qty_limit != null ? String(discount.product_qty_limit) : "",
	min_order_amount: discount.min_order_amount != null ? String(discount.min_order_amount) : "",
	per_user_only: discount.per_user_only,
	customer_id: discount.customer_id ?? "",
	usage_limit: discount.usage_limit != null ? String(discount.usage_limit) : "",
	usage_limit_per_user: discount.usage_limit_per_user != null ? String(discount.usage_limit_per_user) : "",
	is_active: discount.is_active,
});

export const formToPayload = (form: FormState): DiscountPayload => {
	const startAt = toLocalDatetimeToRFC3339(form.start_at);
	if (!startAt) throw new Error("start_at wajib diisi");
	const priority = optionalInt(form.priority) ?? 0;

	return {
		name: form.name.trim(),
		description: form.description.trim() || undefined,
		discount_type: form.discount_type,
		discount_value: parseFloat(form.discount_value) || 0,
		priority,
		max_discount_amount: optionalFloat(form.max_discount_amount),
		start_at: startAt,
		end_at: toLocalDatetimeToRFC3339(form.end_at),
		product_ids: parseProductIDs(form.product_ids),
		product_min_qty: optionalInt(form.product_min_qty),
		product_qty_limit: optionalInt(form.product_qty_limit),
		min_order_amount: optionalFloat(form.min_order_amount),
		per_user_only: form.per_user_only,
		customer_id: form.customer_id.trim() || null,
		usage_limit: optionalInt(form.usage_limit),
		usage_limit_per_user: optionalInt(form.usage_limit_per_user),
		is_active: form.is_active,
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
	selectedProductIDs?: string[];
	onOpenProductPicker?: () => void;
	onRemoveProduct?: (id: string) => void;
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
	selectedProductIDs = [],
	onOpenProductPicker,
	onRemoveProduct,
	hideProductField = false,
}: Props) {
	if (!open) return null;

	const inp = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
	const labelCls = "text-sm";
	const labelSpan = "mb-1 block text-slate-700";

	return (
		<MemberModal
			open={open}
			onClose={onClose}
			title={mode === "create" ? "Create Discount" : "Edit Discount"}
			maxWidth="xl"
			footer={
				<>
					<button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
						Cancel
					</button>
					<button type="button" onClick={onSubmit} disabled={submitting} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-70">
						{submitting ? "Saving..." : "Save"}
					</button>
				</>
			}
		>
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
					<input type="number" min="0" className={inp} value={form.priority} onChange={(e) => onChange({ priority: e.target.value })} placeholder="0" />
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
								{onOpenProductPicker ? (
									<button type="button" onClick={onOpenProductPicker} className="text-xs font-medium text-slate-600 hover:text-slate-900">
										Explore products
									</button>
								) : null}
							</div>
							<textarea className={inp} rows={3} value={form.product_ids} onChange={(e) => onChange({ product_ids: e.target.value })} placeholder="Pisahkan dengan koma atau enter" />
							<p className="text-xs text-slate-400">Ditampung juga di relasi, untuk flash sale/extra produk.</p>
							<div className="mt-2 flex flex-wrap gap-2">
								{selectedProductIDs.length === 0 ? (
									<span className="text-xs text-slate-400">Tidak ada produk yang dipilih.</span>
								) : (
									selectedProductIDs.map((id) => (
										<span key={id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
											{shortID(id)}
											{onRemoveProduct ? (
												<button type="button" onClick={() => onRemoveProduct(id)} className="rounded-full text-slate-400 transition hover:text-slate-600" aria-label="Remove product">
													×
												</button>
											) : null}
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
		</MemberModal>
	);
}