import { useEffect, useState } from "react";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import type { BusinessOption, Product, ProductPayload } from "./types";

type Props = {
	open: boolean;
	mode: "create" | "edit";
	initialData?: Product | null;
	businesses: BusinessOption[];
	submitting: boolean;
	onClose: () => void;
	onSubmit: (payload: ProductPayload, productID?: string) => Promise<Product>;
};

type FormState = {
	sku: string;
	name: string;
	slug: string;
	business_id: string;
	price: string;
	sale_price: string;
	status: string;
	stock_status: string;
	product_type: string;
	is_visible: boolean;
	is_negotiate: boolean;
	short_description: string;
};

const defaultForm: FormState = {
	sku: "",
	name: "",
	slug: "",
	business_id: "",
	price: "0",
	sale_price: "",
	status: "draft",
	stock_status: "instock",
	product_type: "product",
	is_visible: true,
	is_negotiate: false,
	short_description: "",
};

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

export default function ProductFormModal({ open, mode, initialData, businesses, submitting, onClose, onSubmit }: Props) {
	const [form, setForm] = useState<FormState>(defaultForm);
	const [error, setError] = useState("");
	const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({ html: "", plain: "", blocks: { type: "doc", content: [] } });

	useEffect(() => {
		if (!open) return;
		if (mode === "edit" && initialData) {
			setForm({
				sku: initialData.sku || "",
				name: initialData.name || "",
				slug: initialData.slug || "",
				business_id: initialData.business_id || businesses[0]?.id || "",
				price: String(initialData.price ?? 0),
				sale_price: typeof initialData.sale_price === "number" ? String(initialData.sale_price) : "",
				status: initialData.status || "draft",
				stock_status: initialData.stock_status || "instock",
				product_type: initialData.product_type || "product",
				is_visible: initialData.is_visible ?? true,
				is_negotiate: initialData.is_negotiate ?? false,
				short_description: initialData.short_description || "",
			});
			setDescriptionValue({
				html: initialData.description_html || initialData.description || "",
				plain: initialData.description_plain || initialData.description || "",
				blocks: (initialData.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
			});
			setError("");
			return;
		}
		setForm({ ...defaultForm, business_id: businesses[0]?.id || "" });
		setDescriptionValue({ html: "", plain: "", blocks: { type: "doc", content: [] } });
		setError("");
	}, [open, mode, initialData, businesses]);

	const handleSave = async () => {
		if (!form.sku.trim() || !form.name.trim()) {
			setError("SKU dan nama wajib diisi");
			return;
		}
		if (!form.business_id.trim()) {
			setError("Pilih bisnis dulu");
			return;
		}

		setError("");
		const slug = form.slug.trim() || slugify(form.name);
		const price = Number(form.price || 0);
		const salePrice = form.sale_price.trim() ? Number(form.sale_price) : undefined;
		if (Number.isNaN(price) || price < 0) {
			setError("Price harus valid dan >= 0");
			return;
		}
		if (salePrice !== undefined && (Number.isNaN(salePrice) || salePrice < 0)) {
			setError("Sale price harus valid dan >= 0");
			return;
		}

		await onSubmit(
			{
				sku: form.sku.trim(),
				name: form.name.trim(),
				slug,
				business_id: form.business_id.trim(),
				price,
				sale_price: salePrice,
				status: form.status,
				stock_status: form.stock_status,
				product_type: form.product_type,
				is_visible: form.is_visible,
				is_negotiate: form.is_negotiate,
				short_description: form.short_description.trim() || undefined,
				description_html: descriptionValue.html.trim() || undefined,
				description_plain: descriptionValue.plain.trim() || undefined,
				description_blocks: descriptionValue.blocks || undefined,
			},
			initialData?.id,
		);
	};

	return (
		<MemberModal
			open={open}
			onClose={onClose}
			title={mode === "create" ? "New Product" : `Edit Product: ${initialData?.name || ""}`}
			maxWidth="xl"
			footer={
				<>
					<button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
						Cancel
					</button>
					<button type="button" onClick={() => void handleSave()} disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">
						{submitting ? "Saving..." : "Save Product"}
					</button>
				</>
			}
		>
			<div className="space-y-5">
				{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</span>
						<input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business</span>
						<select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.business_id} onChange={(e) => setForm((prev) => ({ ...prev, business_id: e.target.value }))}>
							<option value="">Pilih bisnis</option>
							{businesses.map((business) => (
								<option key={business.id} value={business.id}>{business.name}</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
						<input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
					</label>
					<label className="space-y-1 text-sm md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
						<input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="auto from name if empty" />
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</span>
						<input type="number" min="0" step="0.01" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sale Price</span>
						<input type="number" min="0" step="0.01" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.sale_price} onChange={(e) => setForm((prev) => ({ ...prev, sale_price: e.target.value }))} />
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
						<select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
							<option value="draft">draft</option>
							<option value="published">published</option>
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</span>
						<select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.stock_status} onChange={(e) => setForm((prev) => ({ ...prev, stock_status: e.target.value }))}>
							<option value="instock">instock</option>
							<option value="outofstock">outofstock</option>
							<option value="backorder">backorder</option>
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
						<select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.product_type} onChange={(e) => setForm((prev) => ({ ...prev, product_type: e.target.value }))}>
							<option value="product">product</option>
							<option value="service">service</option>
							<option value="digital">digital</option>
						</select>
					</label>
					<label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-700">
						<input type="checkbox" checked={form.is_visible} onChange={(e) => setForm((prev) => ({ ...prev, is_visible: e.target.checked }))} />
						Visible in catalog
					</label>
					<label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-700">
						<input type="checkbox" checked={form.is_negotiate} onChange={(e) => setForm((prev) => ({ ...prev, is_negotiate: e.target.checked }))} />
						Negotiable
					</label>
					<label className="space-y-1 text-sm md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span>
						<textarea className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.short_description} onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))} />
					</label>
				</div>

				<MemberRichTextEditor value={descriptionValue.html} placeholder="Tulis deskripsi product" onChange={setDescriptionValue} />
			</div>
		</MemberModal>
	);
}