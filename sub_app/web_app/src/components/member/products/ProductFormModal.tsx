import { useCallback, useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import MemberAssetBundleField, { type ExistingMemberAsset, type MemberAssetRulesConfig, validateMemberFilesAgainstUsageConfig } from "../ui/MemberAssetBundleField";
import type { MemberUploadFile } from "../ui/MemberFileUploadDropzone";
import { deleteMemberDigitalFile, deleteMemberProductAsset, listMemberDigitalFiles, listMemberProductAssets, updateMemberDigitalFile, updateMemberProductAsset, uploadMemberDigitalFile, uploadMemberProductAsset, listMemberCategoryChildren } from "./api";
import type { BusinessOption, CategoryOption, Product, ProductDigitalFile, ProductPayload, TagOption } from "./types";
import MemberSeoSegment from "./MemberSeoSegment";
import ClassificationTabs from "../ui/ClassificationTabs";
import { getAmountFormatSettings } from "../../../lib/amountFormat";
import { notifyError, notifySuccess } from "../../../lib/notification";

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

const productAssetUsageConfig: MemberAssetRulesConfig = {
	type: "product_asset",
	rules: {
		thumbnail: {
			label: "Thumbnail",
			helper: "Crop rasio 1:1. Hasil upload mengikuti proporsi ini untuk card/listing.",
			minWidth: 600,
			minHeight: 600,
			aspectRatio: 1,
			targetWidth: 800,
			targetHeight: 800,
		},
		gallery: {
			label: "Gallery",
			helper: "Fleksibel. Tidak ada crop wajib; gunakan untuk gambar yang bebas rasio.",
			minWidth: 1200,
			minHeight: 1200,
		},
		social_1_1: {
			label: "Social 1:1",
			helper: "Crop rasio 1:1. Hasil upload mengikuti proporsi ini.",
			minWidth: 1080,
			minHeight: 1080,
			aspectRatio: 1,
			targetWidth: 1080,
			targetHeight: 1080,
		},
		social_4_5: {
			label: "Social 4:5",
			helper: "Crop rasio 4:5. Hasil upload mengikuti proporsi ini untuk feed portrait.",
			minWidth: 1080,
			minHeight: 1350,
			aspectRatio: 4 / 5,
			targetWidth: 1080,
			targetHeight: 1350,
		},
		header: {
			label: "Header",
			helper: "Crop rasio 16:5. Hasil upload mengikuti proporsi ini untuk area judul halaman.",
			minWidth: 1920,
			minHeight: 600,
			aspectRatio: 16 / 5,
			targetWidth: 1920,
			targetHeight: 600,
		},
		desktop_banner: {
			label: "Desktop Banner",
			helper: "Crop rasio 3:1. Hasil upload mengikuti proporsi ini untuk banner desktop.",
			minWidth: 1920,
			minHeight: 640,
			aspectRatio: 3,
			targetWidth: 1920,
			targetHeight: 640,
		},
	},
};

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
	const [existingAssets, setExistingAssets] = useState<ExistingMemberAsset[]>([]);
	const [loadingExisting, setLoadingExisting] = useState(false);
	const [digitalFiles, setDigitalFiles] = useState<ProductDigitalFile[]>([]);
	const [loadingDigitalFiles, setLoadingDigitalFiles] = useState(false);
	const [selectedFiles, setSelectedFiles] = useState<MemberUploadFile[]>([]);
	const [digitalUploadFiles, setDigitalUploadFiles] = useState<File[]>([]);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
	const [digitalUploading, setDigitalUploading] = useState(false);
	const [usageTag, setUsageTag] = useState("gallery");
	const [digitalDrafts, setDigitalDrafts] = useState<Record<string, { file_name: string; is_active: boolean; download_limit: string; sort_order: string }>>({});
	const [parentID, setParentID] = useState<string>("");
	const [createdProductID, setCreatedProductID] = useState<string>("");
	const [currentCategories, setCurrentCategories] = useState<CategoryOption[]>([]);
	const [loadingCategories, setLoadingCategories] = useState(false);
	const [categoriesError, setCategoriesError] = useState<string | null>(null);
	const [breadcrumbs, setBreadcrumbs] = useState<CategoryOption[]>([]);
	const [selectedPaths, setSelectedPaths] = useState<Record<string, string[]>>({});

	const categoriesByID = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

	const buildCategoryChain = useCallback((id: string): CategoryOption[] => {
		const chain: CategoryOption[] = [];
		let current: CategoryOption | null = categoriesByID.get(id) || null;
		let guard = 0;
		while (current && guard < 20) {
			guard += 1;
			chain.unshift(current);
			current = current.parent_id ? categoriesByID.get(current.parent_id) || null : null;
		}
		return chain;
	}, [categoriesByID]);

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

	const hydrateCategorySelection = useCallback((ids: string[]) => {
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
	}, [buildCategoryChain]);

	const loadChildren = useCallback(async (pid: string) => {
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
	}, []);

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
	}, [open, mode, initialData, businesses, hydrateCategorySelection]);

	useEffect(() => {
		if (!open) return;
		void loadChildren(parentID);
		if (!parentID) {
			setBreadcrumbs([]);
			return;
		}

		setBreadcrumbs(buildCategoryChain(parentID));
	}, [open, parentID, loadChildren, buildCategoryChain]);

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

	const activeProductID = initialData?.id || createdProductID || "";

	const refreshExistingAssets = useCallback(async (productID: string) => {
		const assets = await listMemberProductAssets(productID);
		setExistingAssets(assets.map((a) => ({
			id: a.id,
			file_path: a.file_path,
			file_type: a.file_type || "",
			file_size: a.file_size,
			original_name: a.original_name,
			public_url: a.public_url,
			is_main: a.is_main,
			display_order: a.display_order ?? 0,
			usage_tag: a.usage_tag,
		})));
	}, []);

	const refreshDigitalFiles = useCallback(async (productID: string) => {
		const files = await listMemberDigitalFiles(productID);
		setDigitalFiles(files);
		setDigitalDrafts(Object.fromEntries(files.map((file) => [file.id, { file_name: file.file_name || "", is_active: file.is_active ?? true, download_limit: String(file.download_limit ?? 0), sort_order: String(file.sort_order ?? 0) }])));
	}, []);

	useEffect(() => {
		if (!open || !activeProductID) {
			setExistingAssets([]);
			setDigitalFiles([]);
			setSelectedFiles([]);
			setDigitalUploadFiles([]);
			setUploadProgress(null);
			return;
		}
		let cancelled = false;
		setLoadingExisting(true);
		void refreshExistingAssets(activeProductID)
			.catch((err) => {
				if (!cancelled) {
					setExistingAssets([]);
					notifyError(err instanceof Error ? err.message : "Gagal memuat asset product.");
				}
			})
			.finally(() => {
				if (!cancelled) setLoadingExisting(false);
			});
		setLoadingDigitalFiles(true);
		void refreshDigitalFiles(activeProductID)
			.catch(() => {
				if (!cancelled) setDigitalFiles([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingDigitalFiles(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, activeProductID, refreshExistingAssets, refreshDigitalFiles]);

	const detectFileType = (file: File) => {
		if (file.type.startsWith("image/")) return "image";
		if (file.type.startsWith("video/")) return "video";
		return "doc";
	};

	const uploadFiles = async (productID: string) => {
		if (selectedFiles.length === 0) return;
		setUploading(true);
		setUploadProgress({ current: 0, total: selectedFiles.length });
		try {
			for (let i = 0; i < selectedFiles.length; i++) {
				const uploadFile = selectedFiles[i];
				const formData = new FormData();
				formData.append("file", uploadFile.file);
				formData.append("file_type", detectFileType(uploadFile.file));
				formData.append("is_main", String(uploadFile.isMain ?? false));
				formData.append("display_order", String(uploadFile.displayOrder ?? i));
				if (usageTag) {
					formData.append("usage_tag", usageTag);
				}
				await uploadMemberProductAsset(productID, formData);
				setUploadProgress({ current: i + 1, total: selectedFiles.length });
			}
			setSelectedFiles([]);
			setUploadProgress(null);
			await refreshExistingAssets(productID);
			notifySuccess("Product assets uploaded");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal upload assets");
		} finally {
			setUploading(false);
		}
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
			await refreshDigitalFiles(activeProductID);
			notifySuccess("Digital files uploaded");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal upload digital files");
		} finally {
			setDigitalUploading(false);
		}
	};

	const handleDeleteDigitalFile = async (fileID: string) => {
		if (!activeProductID) return;
		await deleteMemberDigitalFile(activeProductID, fileID);
		await refreshDigitalFiles(activeProductID);
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
		await refreshDigitalFiles(activeProductID);
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

		const saved = await onSubmit({
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

		// if creating mode and API returned product with id, keep modal open and reveal rest of UI
		if (mode === "create" && saved && (saved as Product).id) {
			setCreatedProductID((saved as Product).id);
		}

		if (selectedFiles.length > 0 && activeProductID) {
			const validationError = await validateMemberFilesAgainstUsageConfig(selectedFiles, usageTag, productAssetUsageConfig);
			if (validationError) {
				setError(validationError);
				return;
			}
			await uploadFiles(activeProductID);
		}
	};

	const toggleTag = (id: string) => {
		setForm((prev) => ({ ...prev, tag_ids: prev.tag_ids.includes(id) ? prev.tag_ids.filter((item) => item !== id) : [...prev.tag_ids, id] }));
	};

	const sectionNavItems = useMemo(() => {
		const items: { id: string; label: string; description: string }[] = [];

		// Always-visible sections
		items.push({ id: "product-basic", label: "Informasi Dasar", description: "SKU, nama, slug, dan harga" });
		items.push({ id: "product-classification", label: "Klasifikasi", description: "Kategori dan tag" });
		items.push({ id: "product-settings", label: "Settings", description: "Status dan opsi produk" });

		// Sections that require an existing product (or edit mode)
		if (mode === "edit" || activeProductID) {
			items.push({ id: "product-metadata", label: "Metadata", description: "SEO dan atribut" });
			items.push({ id: "product-tax", label: "Tax & Dimensions", description: "Pajak dan ukuran" });
			items.push({ id: "product-description", label: "Deskripsi", description: "Isi deskripsi produk" });
			items.push({ id: "product-assets", label: "Assets", description: "Gambar dan file" });
			if (form.product_type === "digital") {
				items.push({ id: "product-digital-files", label: "Digital Files", description: "File digital dan metadata" });
			}
		}

		return items;
	}, [activeProductID, form.product_type, mode]);

	const classificationCategoryPanel = (
		<div role="tabpanel" id="classification-category-panel" aria-labelledby="classification-tab-category" className="space-y-4">
			<div className="space-y-2 text-sm">
				<div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</span><span className="text-xs text-slate-400">{form.category_ids.length > 0 ? "1 selected" : "0 selected"}</span></div>
				<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
					<button type="button" className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200" onClick={() => setParentID("")}>Categories</button>
					{breadcrumbs.map((crumb) => (
						<button key={crumb.id} type="button" className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200" onClick={() => setParentID(crumb.id)}>/ {crumb.name}</button>
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
						<div className="space-y-2">
							{currentCategories.map((category) => (
								<div key={category.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
									<label className="flex items-center gap-2 text-sm text-slate-700">
										<input type="radio" name="member-category-single" checked={form.category_ids.includes(category.id)} onChange={() => selectCategory(category.id, category)} />
										<span>{category.name}</span>
										<span className="text-xs text-slate-400">({category.slug})</span>
									</label>
									<button type="button" onClick={() => setParentID(category.id)} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200">Subcategories</button>
								</div>
							))}
						</div>
					)}
				</div>
				{form.category_ids.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{form.category_ids.map((id) => {
							const item = categoriesByID.get(id);
							return (
								<span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
									{item ? item.name : (selectedPaths[id] || [id]).join(" > ")}
									<button type="button" onClick={clearCategorySelection} className="text-slate-400 hover:text-slate-600">×</button>
								</span>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);

	const classificationTagsPanel = (
		<div role="tabpanel" id="classification-tags-panel" aria-labelledby="classification-tab-tags" className="space-y-4">
			<div className="space-y-2 text-sm">
				<div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</span><span className="text-xs text-slate-400">{form.tag_ids.length} selected</span></div>
				<div className="rounded-xl border border-slate-200 bg-white p-3">
					<input className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} />
					<div className="max-h-56 overflow-y-auto space-y-2">
						{filteredTags.map((tag) => (
							<label key={tag.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
								<input type="checkbox" checked={form.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
								<span>{tag.name}</span>
								<span className="text-xs text-slate-400">({tag.slug})</span>
							</label>
						))}
						{filteredTags.length === 0 ? <div className="text-xs text-slate-500">Tidak ada tag yang cocok.</div> : null}
					</div>
				</div>
				{form.tag_ids.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{form.tag_ids.map((id) => {
							const item = tags.find((tag) => tag.id === id);
							return (
								<span key={id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
									{item ? item.name : id}
									<button type="button" onClick={() => toggleTag(id)} className="text-emerald-500 hover:text-emerald-700">×</button>
								</span>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);

	const scrollToSection = (sectionID: string) => {
		if (typeof document === "undefined") return;
		const target = document.getElementById(sectionID);
		if (!target) return;
		target.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<MemberModal open={open} onClose={onClose} title={mode === "create" ? "Create Product" : `Edit Product: ${initialData?.name || ""}`} maxWidth="2xl" footer={
			<>
				<button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100" disabled={submitting || uploading || digitalUploading}>Cancel</button>
				<button type="button" onClick={() => void handleSave()} disabled={submitting || uploading || digitalUploading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">
					{uploading && uploadProgress
						? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
						: submitting
						? "Saving..."
						: mode === "create" && !activeProductID
						? "Create & Continue"
						: "Save"}
				</button>
			</>
		}>
			<div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
				<aside className="lg:sticky lg:top-0 self-start lg:max-h-[calc(80vh-2rem)] lg:overflow-y-auto">
					<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Product Data</p>
							<h4 className="mt-1 text-sm font-semibold text-slate-900">Quick Navigation</h4>
							<p className="mt-1 text-xs text-slate-500">Klik menu untuk lompat ke section tanpa scroll panjang.</p>
						</div>
						<nav className="space-y-1.5">
							{sectionNavItems.map((item) => (
								<button key={item.id} type="button" onClick={() => scrollToSection(item.id)} className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
									<svg className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-600" viewBox="0 0 10 10" fill="none" aria-hidden="true">
								<path d="M3.5 2.5L6.5 5L3.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
									<span className="min-w-0">
										<span className="block text-sm font-medium text-slate-800">{item.label}</span>
										<span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
									</span>
								</button>
							))}
						</nav>
					</div>
				</aside>

				<div className="space-y-5">
					<div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Product Profile</p>
						<p className="text-sm text-slate-600">Lengkapi detail produk, kategori, tags, assets, dan metadata agar listing lebih rapi dan siap publish.</p>
					</div>

			{mode === "create" && !activeProductID ? (
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
					<p className="font-semibold">Hanya field dasar ditampilkan saat membuat produk.</p>
					<p className="mt-1 text-sm text-emerald-800">Isi minimal SKU, Name, Business, dan Short Description lalu tekan Create & Continue. Bagian Metadata, Tax, Deskripsi, dan Assets akan muncul setelah produk berhasil tersimpan.</p>
				</div>
			) : null}

			<section id="product-basic" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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
					<section id="product-classification" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
			<h4 className="mb-3 text-sm font-semibold text-slate-900">Klasifikasi</h4>
			<p className="mb-3 text-xs text-slate-500">Pilih satu kategori. Parent akan ikut terisi otomatis agar struktur tetap utuh.</p>
			<ClassificationTabs
				idPrefix="member-product-classification"
				categoryPanel={classificationCategoryPanel}
				tagsPanel={classificationTagsPanel}
			/>
		</section>
		<section id="product-settings" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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

					{(mode === "edit" || activeProductID) ? (
						<section id="product-metadata" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<h4 className="mb-3 text-sm font-semibold text-slate-900">Metadata</h4>
						<div className="space-y-4">
							<MemberSeoSegment
								value={parsedSeoContent}
								sourceTitle={form.name}
								sourceDescription={form.short_description}
								onChange={(next) => setForm((prev) => ({ ...prev, seo_content: next ? JSON.stringify(next, null, 2) : "" }))}
							/>
							<label className="space-y-1 text-sm"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attributes (JSON)</span><textarea className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm shadow-sm font-mono" value={form.attributes} onChange={(e) => setForm((prev) => ({ ...prev, attributes: e.target.value }))} placeholder='{"color":"blue"}' /></label>
						</div>
						</section>
					) : null}

					{(mode === "edit" || activeProductID) ? (
						<section id="product-tax" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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
					) : null}

					{(mode === "edit" || activeProductID) ? (
						<section id="product-description" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<h4 className="mb-1 text-sm font-semibold text-slate-900">Deskripsi Produk</h4>
						<p className="mb-4 text-xs text-slate-500">Tulis deskripsi yang informatif dan meyakinkan untuk listing member.</p>
						<MemberRichTextEditor value={descriptionValue.html} placeholder="Tulis deskripsi product" onChange={setDescriptionValue} />
						</section>
					) : null}

					{(mode === "edit" || activeProductID) ? (
						<section id="product-assets" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<MemberAssetBundleField
					title="Product Images & Assets"
					usageConfig={productAssetUsageConfig}
					usageTag={usageTag}
					onUsageTagChange={setUsageTag}
					enforceCrop
					selectedFiles={selectedFiles}
					onSelectedFilesChange={setSelectedFiles}
					existingAssets={existingAssets}
					loadingExisting={loadingExisting}
					showExisting={Boolean(activeProductID)}
					maxFiles={20}
					maxSizeMB={10}
					accept="image/*"
					onSetMainExisting={async (asset) => {
						if (!activeProductID) return;
						try {
							await updateMemberProductAsset(activeProductID, asset.id, { is_main: true, usage_tag: asset.usage_tag || "" });
							await refreshExistingAssets(activeProductID);
							notifySuccess("Set as main");
						} catch (err) {
							notifyError(err instanceof Error ? err.message : "Gagal set main");
						}
					}}
					onDeleteExisting={async (asset) => {
						if (!activeProductID) return;
						if (!confirm("Delete this asset?")) return;
						try {
							await deleteMemberProductAsset(activeProductID, asset.id);
							await refreshExistingAssets(activeProductID);
							notifySuccess("Deleted asset");
						} catch (err) {
							notifyError(err instanceof Error ? err.message : "Gagal hapus asset");
						}
					}}
					onUpdateExisting={async (asset, patch) => {
						if (!activeProductID) return;
						try {
							await updateMemberProductAsset(activeProductID, asset.id, {
								...(typeof patch.usage_tag !== "undefined" ? { usage_tag: patch.usage_tag } : {}),
								...(typeof patch.display_order !== "undefined" ? { display_order: patch.display_order } : {}),
							});
							setExistingAssets((prev) =>
								prev.map((it) =>
									it.id === asset.id
										? {
												...it,
												...(typeof patch.usage_tag !== "undefined" ? { usage_tag: patch.usage_tag } : {}),
												...(typeof patch.display_order !== "undefined" ? { display_order: patch.display_order } : {}),
											}
										: it,
								),
							);
							notifySuccess(typeof patch.display_order !== "undefined" ? "Order updated" : "Tag updated");
						} catch (err) {
							notifyError(typeof patch.display_order !== "undefined" ? "Gagal update order" : "Gagal update tag");
						}
					}}
						onCopyExistingLink={async (asset) => {
						if (asset.public_url) {
							await navigator.clipboard.writeText(asset.public_url);
							notifySuccess("Link copied");
						}
					}}
						/>
						</section>
					) : null}

					{form.product_type === "digital" && Boolean(activeProductID) ? (
						<section id="product-digital-files" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
						<div className="flex items-center justify-between gap-2">
							<h4 className="text-sm font-semibold text-slate-900">Digital Files</h4>
							<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{digitalFiles.length} files</span>
						</div>

						<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Upload File Digital</p>
							<input
								type="file"
								multiple
								onChange={(e) => setDigitalUploadFiles(e.target.files ? Array.from(e.target.files) : [])}
								className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
							/>
							{digitalUploadFiles.length > 0 ? (
								<div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
									{digitalUploadFiles.map((file) => (
										<div key={`${file.name}-${file.lastModified}`} className="truncate">{file.name}</div>
									))}
								</div>
							) : null}
							<div className="mt-3 flex justify-end">
								<button
									type="button"
									onClick={() => void handleUploadDigitalFile()}
									disabled={digitalUploading || digitalUploadFiles.length === 0}
									className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
								>
									{digitalUploading ? "Uploading..." : "Upload Digital Files"}
								</button>
							</div>
						</div>

						<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">File Tersimpan</p>
							{loadingDigitalFiles ? (
								<p className="text-sm text-slate-500">Loading files...</p>
							) : digitalFiles.length === 0 ? (
								<p className="text-sm text-slate-500">Belum ada digital file.</p>
							) : (
								<div className="space-y-2">
									{digitalFiles.map((file) => (
										<div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-slate-800">{file.file_name || file.file_path}</p>
												<p className="text-xs text-slate-500">{file.is_active ? "active" : "inactive"}</p>
											</div>
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={async () => {
														try {
															await updateMemberDigitalFile(activeProductID, file.id, { is_active: !file.is_active });
															await refreshDigitalFiles(activeProductID);
															notifySuccess(file.is_active ? "File dinonaktifkan" : "File diaktifkan");
														} catch (err) {
															notifyError(err instanceof Error ? err.message : "Gagal update status file");
														}
													}}
													className={`rounded px-2 py-1 text-xs font-medium ${file.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
												>
													{file.is_active ? "Active" : "Inactive"}
												</button>
												<button
													type="button"
													onClick={async () => {
														if (!confirm("Delete digital file ini?")) return;
														try {
															await handleDeleteDigitalFile(file.id);
															notifySuccess("Digital file dihapus");
														} catch (err) {
															notifyError(err instanceof Error ? err.message : "Gagal hapus digital file");
														}
													}}
													className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700"
												>
													Delete
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
						</section>
					) : null}
				</div>
			</div>
		</MemberModal>
	);
}
