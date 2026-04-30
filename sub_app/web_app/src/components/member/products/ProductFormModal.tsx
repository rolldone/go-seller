import { useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import { deleteMemberDigitalFile, deleteMemberProductAsset, listMemberCategories, listMemberCategoryChildren, listMemberDigitalFiles, listMemberProductAssets, updateMemberDigitalFile, updateMemberProductAsset, uploadMemberDigitalFile, uploadMemberProductAsset } from "./api";
import type { BusinessOption, CategoryOption, Product, ProductAsset, ProductDigitalFile, ProductPayload, TagOption } from "./types";
import MemberSeoSegment from "./MemberSeoSegment";
import { getAmountFormatSettings } from "../../../lib/amountFormat";

type Props = {
	open: boolean;
	mode: "create" | "edit";
	initialData?: Product | null;
	businesses: BusinessOption[];
	categories: CategoryOption[];
	tags: TagOption[];
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
	category_ids: string[];
	tag_ids: string[];
	seo_content: string;
	attributes: string;
	tax_type: "include" | "exclude";
	tax_rate: string;
	custom_tax: boolean;
	price_override_enabled: boolean;
	weight: string;
	dimensions_length: string;
	dimensions_width: string;
	dimensions_height: string;
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
	category_ids: [],
	tag_ids: [],
	seo_content: "",
	attributes: "",
	tax_type: "exclude",
	tax_rate: "0",
	custom_tax: false,
	price_override_enabled: false,
	weight: "",
	dimensions_length: "",
	dimensions_width: "",
	dimensions_height: "",
};

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

function safeJsonString(value: unknown): string {
	if (value == null) return "";
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return "";
	}
}

function parseMaybeNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number(trimmed);
	if (Number.isNaN(parsed) || parsed < 0) return undefined;
	return parsed;
}

function parseJsonField(value: string): unknown | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return JSON.parse(trimmed);
}

export default function ProductFormModal({ open, mode, initialData, businesses, categories, tags, submitting, onClose, onSubmit }: Props) {
    const amountFormatSettings = getAmountFormatSettings();
	const [form, setForm] = useState<FormState>(defaultForm);
	const [error, setError] = useState("");
	const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({ html: "", plain: "", blocks: { type: "doc", content: [] } });
	const [tagSearch, setTagSearch] = useState("");
	const [productAssets, setProductAssets] = useState<ProductAsset[]>([]);
	const [digitalFiles, setDigitalFiles] = useState<ProductDigitalFile[]>([]);
	const [assetUploadFiles, setAssetUploadFiles] = useState<File[]>([]);
	const [digitalUploadFiles, setDigitalUploadFiles] = useState<File[]>([]);
	const [mediaLoading, setMediaLoading] = useState(false);
	const [assetUploading, setAssetUploading] = useState(false);
	const [digitalUploading, setDigitalUploading] = useState(false);
	const [assetDrafts, setAssetDrafts] = useState<Record<string, { usage_tag: string; display_order: string }>>({});
	const [digitalDrafts, setDigitalDrafts] = useState<Record<string, { file_name: string; is_active: boolean; download_limit: string; sort_order: string }>>({});
	const [parentID, setParentID] = useState<string>("");
	const [currentCategories, setCurrentCategories] = useState<CategoryOption[]>([]);
	const [loadingCategories, setLoadingCategories] = useState(false);
	const [categoriesError, setCategoriesError] = useState<string | null>(null);
	const [breadcrumbs, setBreadcrumbs] = useState<CategoryOption[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Record<string, string[]>>({});

	const categoriesByID = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

	const buildCategoryChain = (id: string): CategoryOption[] => {
		const chain: CategoryOption[] = [];
		let current = categoriesByID.get(id);
		let guard = 0;
		while (current && guard < 20) {
			guard += 1;
			chain.unshift(current);
			current = current.parent_id ? categoriesByID.get(current.parent_id) || null : null;
		}
		return chain;
	};

	const applyCategoryChain = (chain: CategoryOption[]) => {
		setForm((prev) => ({ ...prev, category_ids: chain.map((category) => category.id) }));
		if (chain.length === 0) {
			setSelectedPaths({});
			return;
		}

		setSelectedPaths((prev) => {
			const copy = { ...prev };
			for (let i = 0; i < chain.length; i += 1) {
				copy[chain[i].id] = chain.slice(0, i + 1).map((category) => category.name);
			}
			return copy;
		});
	};

	const selectCategory = (id: string, item?: CategoryOption) => {
		const chain = buildCategoryChain(id);
		if (chain.length > 0) {
			applyCategoryChain(chain);
			setParentID(chain.length > 1 ? chain[chain.length - 2].id : "");
			return;
		}

		if (item) {
			applyCategoryChain([item]);
			setParentID(item.parent_id || "");
		}
	};

	const clearCategorySelection = () => {
		setForm((prev) => ({ ...prev, category_ids: [] }));
		setSelectedPaths({});
		setParentID("");
		setBreadcrumbs([]);
		setCurrentCategories([]);
	};

	const hydrateCategorySelection = (ids: string[]) => {
		const uniqueIDs = Array.from(new Set(ids.filter(Boolean)));
		if (uniqueIDs.length === 0) {
			clearCategorySelection();
			setParentID("");
			setBreadcrumbs([]);
			return;
		}

		const chains = uniqueIDs.map((id) => buildCategoryChain(id)).filter((chain) => chain.length > 0);
		const longestChain = chains.reduce<CategoryOption[]>((best, chain) => (chain.length > best.length ? chain : best), []);
		applyCategoryChain(longestChain);
		setParentID(longestChain.length > 1 ? longestChain[longestChain.length - 2].id : "");
	};

	const loadChildren = async (pid: string) => {
		setLoadingCategories(true);
		setCategoriesError(null);
		try {
			const rows = await listMemberCategoryChildren(pid);
			setCurrentCategories(rows);
		} catch (err) {
			setCategoriesError(err instanceof Error ? err.message : "Failed to load categories");
			setCurrentCategories([]);
		} finally {
			setLoadingCategories(false);
		}
	};

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
				category_ids: initialData.category_ids || [],
				tag_ids: initialData.tag_ids || [],
				seo_content: safeJsonString(initialData.seo_content),
				attributes: safeJsonString(initialData.attributes),
				tax_type: initialData.tax_type || "exclude",
				tax_rate: typeof initialData.tax_rate === "number" ? String(initialData.tax_rate) : "0",
				custom_tax: initialData.custom_tax ?? false,
				price_override_enabled: initialData.price_override_enabled ?? false,
				weight: typeof initialData.weight === "number" ? String(initialData.weight) : "",
				dimensions_length: typeof initialData.dimensions_length === "number" ? String(initialData.dimensions_length) : "",
				dimensions_width: typeof initialData.dimensions_width === "number" ? String(initialData.dimensions_width) : "",
				dimensions_height: typeof initialData.dimensions_height === "number" ? String(initialData.dimensions_height) : "",
			});
			setDescriptionValue({
				html: initialData.description_html || initialData.description || "",
				plain: initialData.description_plain || initialData.description || "",
				blocks: (initialData.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
			});
			hydrateCategorySelection(initialData.category_ids || []);
			setError("");
			setTagSearch("");
			return;
		}
		setForm({ ...defaultForm, business_id: businesses[0]?.id || "" });
		setDescriptionValue({ html: "", plain: "", blocks: { type: "doc", content: [] } });
		setSelectedPaths({});
		setParentID("");
		setBreadcrumbs([]);
		setCurrentCategories([]);
		setCategoriesError(null);
		setError("");
		setTagSearch("");
	}, [open, mode, initialData, businesses]);

	useEffect(() => {
		if (!open) return;
		void loadChildren(parentID);
		if (!parentID) {
			setBreadcrumbs([]);
			return;
		}

		setBreadcrumbs(buildCategoryChain(parentID));
	}, [open, parentID, categoriesByID]);

	const filteredTags = useMemo(() => {
		const needle = tagSearch.trim().toLowerCase();
		if (!needle) return tags;
		return tags.filter((tag) => tag.name.toLowerCase().includes(needle) || tag.slug.toLowerCase().includes(needle));
	}, [tags, tagSearch]);

	const parsedSeoContent = useMemo(() => {
		try {
			return form.seo_content.trim() ? JSON.parse(form.seo_content) : null;
		} catch {
			return null;
		}
	}, [form.seo_content]);

	const activeProductID = initialData?.id || "";

	const refreshMedia = async (productID: string) => {
		const [assets, files] = await Promise.all([listMemberProductAssets(productID), listMemberDigitalFiles(productID)]);
		setProductAssets(assets);
		setAssetDrafts(Object.fromEntries(assets.map((asset) => [asset.id, { usage_tag: asset.usage_tag || "", display_order: String(asset.display_order ?? 0) }] )));
		setDigitalFiles(files);
		setDigitalDrafts(Object.fromEntries(files.map((file) => [file.id, { file_name: file.file_name || "", is_active: file.is_active ?? true, download_limit: String(file.download_limit ?? 0), sort_order: String(file.sort_order ?? 0) }] )));
	};

	useEffect(() => {
		if (!open || !activeProductID) {
			setProductAssets([]);
			setDigitalFiles([]);
			setAssetUploadFiles([]);
			setDigitalUploadFiles([]);
			return;
		}
		let cancelled = false;
		setMediaLoading(true);
		void refreshMedia(activeProductID)
			.catch(() => {
				if (!cancelled) {
					setProductAssets([]);
					setDigitalFiles([]);
				}
			})
			.finally(() => {
				if (!cancelled) setMediaLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, activeProductID]);

	const detectFileType = (file: File) => {
		if (file.type.startsWith("image/")) return "image";
		if (file.type.startsWith("video/")) return "video";
		return "doc";
	};

	const handleUploadAsset = async () => {
		if (!activeProductID || assetUploadFiles.length === 0) return;
		setAssetUploading(true);
		try {
			for (const [index, file] of assetUploadFiles.entries()) {
				const formData = new FormData();
				formData.append("file", file);
				formData.append("file_type", detectFileType(file));
				formData.append("is_main", String(productAssets.length === 0 && index === 0));
				formData.append("display_order", String(productAssets.length + index));
				formData.append("usage_tag", "gallery");
				await uploadMemberProductAsset(activeProductID, formData);
			}
			setAssetUploadFiles([]);
			await refreshMedia(activeProductID);
		} finally {
			setAssetUploading(false);
		}
	};

	const handleDeleteAsset = async (assetID: string) => {
		if (!activeProductID) return;
		await deleteMemberProductAsset(activeProductID, assetID);
		await refreshMedia(activeProductID);
	};

	const handleSetMainAsset = async (assetID: string) => {
		if (!activeProductID) return;
		await updateMemberProductAsset(activeProductID, assetID, { is_main: true });
		await refreshMedia(activeProductID);
	};

	const handleSaveAssetMeta = async (assetID: string) => {
		if (!activeProductID) return;
		const draft = assetDrafts[assetID];
		if (!draft) return;
		const displayOrder = draft.display_order.trim() ? Number(draft.display_order) : undefined;
		if (draft.display_order.trim() && (Number.isNaN(displayOrder) || displayOrder === undefined)) {
			setError("Display order asset harus berupa angka valid");
			return;
		}
		setError("");
		await updateMemberProductAsset(activeProductID, assetID, { usage_tag: draft.usage_tag.trim(), display_order: displayOrder });
		await refreshMedia(activeProductID);
	};

	const handleUploadDigitalFile = async () => {
		if (!activeProductID || digitalUploadFiles.length === 0) return;
		setDigitalUploading(true);
		try {
			for (const [index, file] of digitalUploadFiles.entries()) {
				const formData = new FormData();
				formData.append("file", file);
				formData.append("download_limit", "0");
				formData.append("sort_order", String(digitalFiles.length + index));
				await uploadMemberDigitalFile(activeProductID, formData);
			}
			setDigitalUploadFiles([]);
			await refreshMedia(activeProductID);
		} finally {
			setDigitalUploading(false);
		}
	};

	const handleDeleteDigitalFile = async (fileID: string) => {
		if (!activeProductID) return;
		await deleteMemberDigitalFile(activeProductID, fileID);
		await refreshMedia(activeProductID);
	};

	const handleSaveDigitalFileMeta = async (fileID: string) => {
		if (!activeProductID) return;
		const draft = digitalDrafts[fileID];
		if (!draft) return;
		const downloadLimit = draft.download_limit.trim() ? Number(draft.download_limit) : undefined;
		const sortOrder = draft.sort_order.trim() ? Number(draft.sort_order) : undefined;
		if (draft.download_limit.trim() && (Number.isNaN(downloadLimit) || downloadLimit === undefined || downloadLimit < 0)) {
			setError("Download limit harus berupa angka valid");
			return;
		}
		if (draft.sort_order.trim() && (Number.isNaN(sortOrder) || sortOrder === undefined || sortOrder < 0)) {
			setError("Sort order harus berupa angka valid");
			return;
		}
		setError("");
		await updateMemberDigitalFile(activeProductID, fileID, { file_name: draft.file_name.trim(), is_active: draft.is_active, download_limit: downloadLimit, sort_order: sortOrder });
		await refreshMedia(activeProductID);
	};

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
		const taxRate = parseMaybeNumber(form.tax_rate);
		const weight = parseMaybeNumber(form.weight);
		const dimensionsLength = parseMaybeNumber(form.dimensions_length);
		const dimensionsWidth = parseMaybeNumber(form.dimensions_width);
		const dimensionsHeight = parseMaybeNumber(form.dimensions_height);

		if (Number.isNaN(price) || price < 0) {
			setError("Price harus valid dan >= 0");
			return;
		}
		if (salePrice !== undefined && (Number.isNaN(salePrice) || salePrice < 0)) {
			setError("Sale price harus valid dan >= 0");
			return;
		}
		if (form.tax_rate.trim() && taxRate === undefined) {
			setError("Tax rate harus valid dan >= 0");
			return;
		}
		if (form.weight.trim() && weight === undefined) {
			setError("Weight harus valid dan >= 0");
			return;
		}
		if (form.dimensions_length.trim() && dimensionsLength === undefined) {
			setError("Dimensions length harus valid dan >= 0");
			return;
		}
		if (form.dimensions_width.trim() && dimensionsWidth === undefined) {
			setError("Dimensions width harus valid dan >= 0");
			return;
		}
		if (form.dimensions_height.trim() && dimensionsHeight === undefined) {
			setError("Dimensions height harus valid dan >= 0");
			return;
		}

		let seoContent: unknown | undefined;
		let attributes: unknown | undefined;
		try {
			seoContent = parseJsonField(form.seo_content);
		} catch {
			setError("SEO content harus berupa JSON valid");
			return;
		}
		try {
			attributes = parseJsonField(form.attributes);
		} catch {
			setError("Attributes harus berupa JSON valid");
			return;
		}

		await onSubmit({
			sku: form.sku.trim(),
			name: form.name.trim(),
			slug,
			description: descriptionValue.plain.trim() || undefined,
			description_html: descriptionValue.html.trim() || undefined,
			description_plain: descriptionValue.plain.trim() || undefined,
			description_blocks: descriptionValue.blocks || undefined,
			short_description: form.short_description.trim() || undefined,
			price,
			sale_price: salePrice,
			status: form.status,
			stock_status: form.stock_status,
			is_visible: form.is_visible,
			is_negotiate: form.is_negotiate,
			seo_content: seoContent,
			attributes,
			business_id: form.business_id.trim(),
			category_ids: form.category_ids,
			tag_ids: form.tag_ids,
			product_type: form.product_type,
			tax_type: form.tax_type,
			tax_rate: taxRate,
			custom_tax: form.custom_tax,
			price_override_enabled: form.price_override_enabled,
			weight,
			dimensions_length: dimensionsLength,
			dimensions_width: dimensionsWidth,
			dimensions_height: dimensionsHeight,
		}, initialData?.id);
	};

	const toggleTag = (id: string) => {
		setForm((prev) => ({ ...prev, tag_ids: prev.tag_ids.includes(id) ? prev.tag_ids.filter((item) => item !== id) : [...prev.tag_ids, id] }));
	};

	return (
		<MemberModal open={open} onClose={onClose} title={mode === "create" ? "Create Product" : `Edit Product: ${initialData?.name || ""}`} maxWidth="2xl" footer={
			<>
				<button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">Cancel</button>
				<button type="button" onClick={() => void handleSave()} disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">{submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}</button>
			</>
		}>
			<div className="space-y-5">
				<div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Product Profile</p>
					<p className="text-sm text-slate-600">Lengkapi detail produk, kategori, tags, assets, dan metadata agar listing lebih rapi dan siap publish.</p>
				</div>

				{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-3 text-sm font-semibold text-slate-900">Informasi Dasar</h4>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</span><input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business</span><select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.business_id} onChange={(e) => setForm((prev) => ({ ...prev, business_id: e.target.value }))}><option value="">Pilih bisnis</option>{businesses.map((business) => (<option key={business.id} value={business.id}>{business.name}</option>))}</select></label>
						<label className="space-y-1 text-sm md:col-span-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span><input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
						<label className="space-y-1 text-sm md:col-span-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span><div className="flex gap-2"><input className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="auto from name if empty" /><button type="button" onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">Generate</button></div></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price</span><NumericFormat value={form.price} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, price: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={0} allowNegative={false} inputMode="numeric" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sale Price</span><NumericFormat value={form.sale_price} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, sale_price: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={0} allowNegative={false} inputMode="numeric" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm md:col-span-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span><textarea className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.short_description} onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))} /></label>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-3 text-sm font-semibold text-slate-900">Klasifikasi</h4>
					<p className="mb-3 text-xs text-slate-500">Pilih satu kategori. Parent akan ikut terisi otomatis agar struktur tetap utuh.</p>
					<div className="grid gap-4 lg:grid-cols-2">
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</span><span className="text-xs text-slate-400">{form.category_ids.length > 0 ? "1 selected" : "0 selected"}</span></div>
							<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
								<button type="button" className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200" onClick={() => setParentID("")}>Categories</button>
								{breadcrumbs.map((crumb) => (
									<button key={crumb.id} type="button" className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200" onClick={() => setParentID(crumb.id)}>
										/ {crumb.name}
									</button>
								))}
							</div>
							<div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
								{loadingCategories ? (
									<div className="text-xs text-slate-500">Loading...</div>
								) : categoriesError ? (
									<div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{categoriesError}</div>
								) : currentCategories.length === 0 ? (
									<div className="text-xs text-slate-500">No categories available</div>
								) : (
									<div className="space-y-2">{currentCategories.map((category) => (<div key={category.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-slate-50"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="member-category-single" checked={form.category_ids.includes(category.id)} onChange={() => selectCategory(category.id, category)} /><span>{category.name}</span><span className="text-xs text-slate-400">({category.slug})</span></label><button type="button" onClick={() => setParentID(category.id)} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200">Subcategories</button></div>))}</div>
								)}
							</div>
							{form.category_ids.length > 0 ? <div className="flex flex-wrap gap-2">{form.category_ids.map((id) => { const item = categoriesByID.get(id); return <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{item ? item.name : (selectedPaths[id] || [id]).join(" > ")}<button type="button" onClick={clearCategorySelection} className="text-slate-400 hover:text-slate-600">×</button></span>; })}</div> : null}
						</div>

						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</span><span className="text-xs text-slate-400">{form.tag_ids.length} selected</span></div>
							<div className="rounded-xl border border-slate-200 bg-white p-3">
								<input className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} />
								<div className="max-h-56 overflow-y-auto space-y-2">{filteredTags.map((tag) => (<label key={tag.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"><input type="checkbox" checked={form.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} /><span>{tag.name}</span><span className="text-xs text-slate-400">({tag.slug})</span></label>))}{filteredTags.length === 0 ? <div className="text-xs text-slate-500">Tidak ada tag yang cocok.</div> : null}</div>
							</div>
							{form.tag_ids.length > 0 ? <div className="flex flex-wrap gap-2">{form.tag_ids.map((id) => { const item = tags.find((tag) => tag.id === id); return <span key={id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">{item ? item.name : id}<button type="button" onClick={() => toggleTag(id)} className="text-emerald-500 hover:text-emerald-700">×</button></span>; })}</div> : null}
						</div>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-3 text-sm font-semibold text-slate-900">Settings</h4>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
						<label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"><input type="checkbox" checked={form.is_visible} onChange={(e) => setForm((prev) => ({ ...prev, is_visible: e.target.checked }))} /><span>Visible</span></label>
						<label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"><input type="checkbox" checked={form.is_negotiate} onChange={(e) => setForm((prev) => ({ ...prev, is_negotiate: e.target.checked }))} /><span>Negotiable price</span></label>
						<label className="text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span><select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}><option value="draft">draft</option><option value="published">published</option></select></label>
						<label className="text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</span><select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.stock_status} onChange={(e) => setForm((prev) => ({ ...prev, stock_status: e.target.value }))}><option value="instock">instock</option><option value="outofstock">outofstock</option><option value="backorder">backorder</option></select></label>
						<label className="text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span><select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.product_type} onChange={(e) => setForm((prev) => ({ ...prev, product_type: e.target.value }))}><option value="product">product</option><option value="service">service</option><option value="digital">digital</option></select></label>
						<label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"><input type="checkbox" checked={form.custom_tax} onChange={(e) => setForm((prev) => ({ ...prev, custom_tax: e.target.checked }))} /><span>Custom tax</span></label>
						<label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"><input type="checkbox" checked={form.price_override_enabled} onChange={(e) => setForm((prev) => ({ ...prev, price_override_enabled: e.target.checked }))} /><span>Price override enabled</span></label>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-3 text-sm font-semibold text-slate-900">Metadata</h4>
					<div className="space-y-4">
						<MemberSeoSegment value={parsedSeoContent} onChange={(next) => setForm((prev) => ({ ...prev, seo_content: next ? JSON.stringify(next, null, 2) : "" }))} />
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attributes (JSON)</span><textarea className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm font-mono" value={form.attributes} onChange={(e) => setForm((prev) => ({ ...prev, attributes: e.target.value }))} placeholder='{"color":"blue"}' /></label>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-3 text-sm font-semibold text-slate-900">Tax & Dimensions</h4>
					<div className="grid gap-3 md:grid-cols-2">
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax Type</span><select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" value={form.tax_type} onChange={(e) => setForm((prev) => ({ ...prev, tax_type: e.target.value as "include" | "exclude" }))}><option value="exclude">exclude</option><option value="include">include</option></select></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax Rate</span><NumericFormat value={form.tax_rate} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, tax_rate: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={2} allowNegative={false} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weight</span><NumericFormat value={form.weight} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, weight: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={2} allowNegative={false} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensions Length</span><NumericFormat value={form.dimensions_length} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, dimensions_length: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={2} allowNegative={false} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensions Width</span><NumericFormat value={form.dimensions_width} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, dimensions_width: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={2} allowNegative={false} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
						<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensions Height</span><NumericFormat value={form.dimensions_height} valueIsNumericString onValueChange={(values) => setForm((prev) => ({ ...prev, dimensions_height: values.value }))} thousandSeparator={amountFormatSettings.thousandSeparator} decimalSeparator={amountFormatSettings.decimalSeparator} decimalScale={2} allowNegative={false} inputMode="decimal" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm" placeholder="0" /></label>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<h4 className="mb-1 text-sm font-semibold text-slate-900">Deskripsi Produk</h4>
					<p className="mb-4 text-xs text-slate-500">Tulis deskripsi yang informatif dan meyakinkan untuk listing member.</p>
					<MemberRichTextEditor value={descriptionValue.html} placeholder="Tulis deskripsi product" onChange={setDescriptionValue} />
				</section>

				<section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h4 className="text-sm font-semibold text-slate-900">Media Product</h4>
							<p className="mt-1 text-xs text-slate-500">Kelola asset utama, urutan tampil, dan file digital langsung dari form ini.</p>
						</div>
						<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{productAssets.length + digitalFiles.length} items</span>
					</div>

					<div className="mt-4">
						{activeProductID ? (
							<div className="grid gap-4 lg:grid-cols-2">
								<div className="rounded-2xl border border-slate-200 bg-white p-4">
									<div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product Assets</p><p className="text-sm text-slate-600">Upload gambar/video yang akan ditampilkan di katalog.</p></div><span className="text-xs text-slate-400">{mediaLoading ? "Loading..." : `${productAssets.length} files`}</span></div>
									<div className="space-y-3">
										<input type="file" multiple onChange={(e) => setAssetUploadFiles(e.target.files ? Array.from(e.target.files) : [])} className="block w-full text-xs" />
										{assetUploadFiles.length > 0 ? <p className="text-xs text-slate-500">{assetUploadFiles.length} file dipilih</p> : null}
										{assetUploadFiles.length > 0 ? <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{assetUploadFiles.map((file) => (<div key={`${file.name}-${file.lastModified}`} className="truncate py-0.5">{file.name}</div>))}</div> : null}
										<div className="flex items-center gap-2"><button type="button" onClick={() => void handleUploadAsset()} disabled={assetUploadFiles.length === 0 || assetUploading} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{assetUploading ? "Uploading..." : `Upload Asset (${assetUploadFiles.length || 0})`}</button>{assetUploadFiles.length > 0 ? <button type="button" onClick={() => setAssetUploadFiles([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Clear</button> : null}</div>
										<div className="space-y-2">{productAssets.length === 0 ? <p className="text-xs text-slate-500">Belum ada asset.</p> : null}{productAssets.map((asset) => (<div key={asset.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="truncate font-medium text-slate-900">{asset.original_name || asset.file_path}</div><div className="mt-1 text-slate-500">{asset.file_type || "asset"}{asset.is_main ? " · main" : ""}</div>{asset.public_url ? <a href={asset.public_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-sky-600 hover:underline">Preview</a> : null}</div><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs text-slate-600"><input type="radio" name="member-product-main-asset" checked={asset.is_main} onChange={() => void handleSetMainAsset(asset.id)} />Main</label><button type="button" onClick={() => void handleSaveAssetMeta(asset.id)} className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white hover:bg-slate-800">Save</button><button type="button" onClick={() => void handleDeleteAsset(asset.id)} className="rounded-md bg-rose-100 px-2 py-1 font-medium text-rose-700 hover:bg-rose-200">Delete</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="space-y-1"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Usage Tag</span><input type="text" value={assetDrafts[asset.id]?.usage_tag ?? asset.usage_tag ?? ""} onChange={(e) => setAssetDrafts((prev) => ({ ...prev, [asset.id]: { usage_tag: e.target.value, display_order: prev[asset.id]?.display_order ?? String(asset.display_order ?? 0) } }))} className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="gallery" /></label><label className="space-y-1"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Display Order</span><input type="number" min="0" step="1" value={assetDrafts[asset.id]?.display_order ?? String(asset.display_order ?? 0)} onChange={(e) => setAssetDrafts((prev) => ({ ...prev, [asset.id]: { usage_tag: prev[asset.id]?.usage_tag ?? asset.usage_tag ?? "", display_order: e.target.value } }))} className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" /></label></div></div>))}</div>
									</div>

									{form.product_type === "digital" ? (
										<div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
											<div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Digital Files</p><p className="text-sm text-slate-600">Upload file yang akan didownload setelah pembelian.</p></div><span className="text-xs text-slate-400">{digitalFiles.length} files</span></div>
											<div className="space-y-3">
												<input type="file" multiple onChange={(e) => setDigitalUploadFiles(e.target.files ? Array.from(e.target.files) : [])} className="block w-full text-xs" />
												{digitalUploadFiles.length > 0 ? <p className="text-xs text-slate-500">{digitalUploadFiles.length} file dipilih</p> : null}
												{digitalUploadFiles.length > 0 ? <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{digitalUploadFiles.map((file) => (<div key={`${file.name}-${file.lastModified}`} className="truncate py-0.5">{file.name}</div>))}</div> : null}
												<div className="flex items-center gap-2"><button type="button" onClick={() => void handleUploadDigitalFile()} disabled={digitalUploadFiles.length === 0 || digitalUploading} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{digitalUploading ? "Uploading..." : `Upload Digital File (${digitalUploadFiles.length || 0})`}</button>{digitalUploadFiles.length > 0 ? <button type="button" onClick={() => setDigitalUploadFiles([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Clear</button> : null}</div>
												<div className="space-y-2">{digitalFiles.length === 0 ? <p className="text-xs text-slate-500">Belum ada file digital.</p> : null}{digitalFiles.map((file) => (<div key={file.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="truncate font-medium text-slate-900">{file.file_name || file.file_path}</div><div className="mt-1 text-slate-500">{file.is_active ? "active" : "inactive"}</div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void handleSaveDigitalFileMeta(file.id)} className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white hover:bg-slate-800">Save</button><button type="button" onClick={() => void handleDeleteDigitalFile(file.id)} className="rounded-md bg-rose-100 px-2 py-1 font-medium text-rose-700 hover:bg-rose-200">Delete</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="space-y-1"><span className="block text-[11px] uppercase tracking-wide text-slate-400">File Name</span><input type="text" value={digitalDrafts[file.id]?.file_name ?? file.file_name ?? ""} onChange={(e) => setDigitalDrafts((prev) => ({ ...prev, [file.id]: { file_name: e.target.value, is_active: prev[file.id]?.is_active ?? (file.is_active ?? true), download_limit: prev[file.id]?.download_limit ?? String(file.download_limit ?? 0), sort_order: prev[file.id]?.sort_order ?? String(file.sort_order ?? 0) } }))} className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" /></label><label className="space-y-1"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Sort Order</span><input type="number" min="0" step="1" value={digitalDrafts[file.id]?.sort_order ?? String(file.sort_order ?? 0)} onChange={(e) => setDigitalDrafts((prev) => ({ ...prev, [file.id]: { file_name: prev[file.id]?.file_name ?? file.file_name ?? "", is_active: prev[file.id]?.is_active ?? (file.is_active ?? true), download_limit: prev[file.id]?.download_limit ?? String(file.download_limit ?? 0), sort_order: e.target.value } }))} className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" /></label><label className="space-y-1"><span className="block text-[11px] uppercase tracking-wide text-slate-400">Download Limit</span><input type="number" min="0" step="1" value={digitalDrafts[file.id]?.download_limit ?? String(file.download_limit ?? 0)} onChange={(e) => setDigitalDrafts((prev) => ({ ...prev, [file.id]: { file_name: prev[file.id]?.file_name ?? file.file_name ?? "", is_active: prev[file.id]?.is_active ?? (file.is_active ?? true), download_limit: e.target.value, sort_order: prev[file.id]?.sort_order ?? String(file.sort_order ?? 0) } }))} className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" /></label><label className="flex items-center gap-2 pt-4 text-[11px] uppercase tracking-wide text-slate-400"><input type="checkbox" checked={digitalDrafts[file.id]?.is_active ?? (file.is_active ?? true)} onChange={(e) => setDigitalDrafts((prev) => ({ ...prev, [file.id]: { file_name: prev[file.id]?.file_name ?? file.file_name ?? "", is_active: e.target.checked, download_limit: prev[file.id]?.download_limit ?? String(file.download_limit ?? 0), sort_order: prev[file.id]?.sort_order ?? String(file.sort_order ?? 0) } }))} />Active</label></div></div>))}</div>
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">Klik <span className="font-semibold text-slate-900">Save Product</span> dulu supaya assets dan file digital bisa dikelola.</div>
						)}
					</div>
				</section>
			</div>
		</MemberModal>
	);
}
