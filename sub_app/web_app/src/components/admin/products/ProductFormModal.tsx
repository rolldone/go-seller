import { useEffect, useMemo, useState } from "react";

import AdminModal from "../ui/AdminModal";
import type { UploadFile } from "../ui/FileUploadDropzone";
import AssetBundleField, { type AssetRulesConfig, validateFilesAgainstUsageConfig } from "../ui/AssetBundleField";
import RichTextEditor, { type RichTextValue } from "../ui/RichTextEditor";
import type { Product, ProductPayload } from "./types";
import { adminDelete, adminGet, adminPut } from "../entities/adminApi";
import { notifyError, notifySuccess } from "../../../lib/notification";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Product | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductPayload, productID?: string) => Promise<Product>;
};

type FormState = {
  sku: string;
  name: string;
  slug: string;
  short_description: string;
  price: string;
  sale_price: string;
  status: string;
  stock_status: string;
  product_type: string;
  business_id: string;
  is_visible: boolean;
  is_negotiate: boolean;
  seo_content: string;
  attributes: string;
  tax_type: string;
  tax_rate: string;
  custom_tax: boolean;
  price_override_enabled: boolean;
  weight: string;
  dimensions_length: string;
  dimensions_width: string;
  dimensions_height: string;
};

type ExistingAsset = {
  id: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  original_name?: string;
  public_url?: string;
  is_main: boolean;
  display_order: number;
  usage_tag?: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type TagOption = {
  id: string;
  name: string;
  slug: string;
};

type BusinessOption = {
  id: string;
  name: string;
  slug: string;
};

const defaultForm: FormState = {
  sku: "",
  name: "",
  slug: "",
  short_description: "",
  price: "0",
  sale_price: "",
  status: "draft",
  stock_status: "instock",
  product_type: "product",
  business_id: "",
  is_visible: true,
  is_negotiate: false,
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

const productAssetUsageConfig: AssetRulesConfig = {
  type: "product_asset",
  rules: {
    thumbnail: {
      label: "Thumbnail",
      helper: "Rasio 1:1. Minimal 600x600 px. Ideal untuk card/listing.",
      minWidth: 600,
      minHeight: 600,
      aspectRatio: 1,
      targetWidth: 800,
      targetHeight: 800,
    },
    gallery: {
      label: "Gallery",
      helper: "Fleksibel. Minimal 1200x1200 px direkomendasikan untuk kualitas feed.",
      minWidth: 1200,
      minHeight: 1200,
    },
    social_1_1: {
      label: "Social 1:1",
      helper: "Rasio 1:1. Minimal 1080x1080 px.",
      minWidth: 1080,
      minHeight: 1080,
      aspectRatio: 1,
      targetWidth: 1080,
      targetHeight: 1080,
    },
    social_4_5: {
      label: "Social 4:5",
      helper: "Rasio 4:5. Minimal 1080x1350 px untuk feed portrait.",
      minWidth: 1080,
      minHeight: 1350,
      aspectRatio: 4 / 5,
      targetWidth: 1080,
      targetHeight: 1350,
    },
    header: {
      label: "Header",
      helper: "Rasio 16:5. Minimal 1920x600 px untuk area judul halaman.",
      minWidth: 1920,
      minHeight: 600,
      aspectRatio: 16 / 5,
      targetWidth: 1920,
      targetHeight: 600,
    },
    desktop_banner: {
      label: "Desktop Banner",
      helper: "Rasio 3:1. Minimal 1920x640 px untuk banner desktop.",
      minWidth: 1920,
      minHeight: 640,
      aspectRatio: 3,
      targetWidth: 1920,
      targetHeight: 640,
    },
  },
};

export default function ProductFormModal({ open, mode, initialData, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [error, setError] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [usageTag, setUsageTag] = useState<string>("gallery");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [existingAssets, setExistingAssets] = useState<ExistingAsset[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIDs, setSelectedCategoryIDs] = useState<string[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTagIDs, setSelectedTagIDs] = useState<string[]>([]);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");
  const [createdProduct, setCreatedProduct] = useState<Product | null>(null);
  const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({
    html: "",
    plain: "",
    blocks: { type: "doc", content: [] },
  });

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      setForm({
        sku: initialData.sku || "",
        name: initialData.name || "",
        slug: initialData.slug || "",
        short_description: initialData.short_description || "",
        price: String(initialData.price ?? 0),
        sale_price: typeof initialData.sale_price === "number" ? String(initialData.sale_price) : "",
        status: initialData.status || "draft",
        stock_status: initialData.stock_status || "instock",
        product_type: initialData.product_type || "product",
        business_id: initialData.business_id || "",
        is_visible: initialData.is_visible ?? true,
        is_negotiate: initialData.is_negotiate ?? false,
        seo_content: initialData.seo_content ? JSON.stringify(initialData.seo_content, null, 2) : "",
        attributes: initialData.attributes ? JSON.stringify(initialData.attributes, null, 2) : "",
        tax_type: (initialData as any).tax_type || "exclude",
        tax_rate: String((initialData as any).tax_rate ?? 0),
        custom_tax: (initialData as any).custom_tax ?? false,
        price_override_enabled: (initialData as any).price_override_enabled ?? false,
        weight: typeof initialData.weight === "number" ? String(initialData.weight) : "",
        dimensions_length: typeof initialData.dimensions_length === "number" ? String(initialData.dimensions_length) : "",
        dimensions_width: typeof initialData.dimensions_width === "number" ? String(initialData.dimensions_width) : "",
        dimensions_height: typeof initialData.dimensions_height === "number" ? String(initialData.dimensions_height) : "",
      });
      setSelectedCategoryIDs(initialData.category_ids || []);
      setSelectedTagIDs(initialData.tag_ids || []);
      setDescriptionValue({
        html: initialData.description_html || initialData.description || "",
        plain: initialData.description_plain || "",
        blocks: (initialData.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
      });
      setCreatedProduct(initialData);
    } else {
      setForm(defaultForm);
      setSelectedCategoryIDs([]);
      setSelectedTagIDs([]);
      setDescriptionValue({ html: "", plain: "", blocks: { type: "doc", content: [] } });
      setCreatedProduct(null);
    }

    setTagSearch("");
    setError("");
    setSelectedFiles([]);
    setUploading(false);
    setUploadProgress(null);
    setUsageTag("gallery");

    if (mode === "edit" && initialData?.id) {
      (async () => {
        setLoadingExisting(true);
        try {
          const res = await adminGet<{ data: ExistingAsset[] }>(`/admin/catalog/assets?product_id=${initialData.id}&limit=100`);
          setExistingAssets(res.data || []);
        } catch (err) {
          console.error("Failed to load existing assets", err);
          setExistingAssets([]);
        } finally {
          setLoadingExisting(false);
        }
      })();
    } else {
      setExistingAssets([]);
    }

    (async () => {
      try {
        const res = await adminGet<{ data: CategoryOption[] }>(`/admin/catalog/categories?page=1&limit=200`);
        setCategories(res.data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
        setCategories([]);
      }
    })();

    (async () => {
      try {
        const res = await adminGet<{ data: TagOption[] }>(`/admin/catalog/tags?page=1&limit=200`);
        setTags(res.data || []);
      } catch (err) {
        console.error("Failed to load tags", err);
        setTags([]);
      }
    })();

    (async () => {
      try {
        const res = await adminGet<{ data: BusinessOption[] }>(`/admin/catalog/businesses?page=1&limit=200`);
        setBusinesses(res.data || []);
      } catch (err) {
        console.error("Failed to load businesses", err);
        setBusinesses([]);
      }
    })();
  }, [open, mode, initialData]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIDs((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const toggleTag = (id: string) => {
    setSelectedTagIDs((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const filteredTags = useMemo(() => {
    const needle = tagSearch.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(needle) || tag.slug.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const setField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const refreshExistingAssets = async (productID: string) => {
    const res = await adminGet<{ data: ExistingAsset[] }>(`/admin/catalog/assets?product_id=${productID}&limit=100`);
    setExistingAssets(res.data || []);
  };

  const activeProductID = createdProduct?.id || initialData?.id || undefined;
  const showAdvancedSections = mode === "edit" || Boolean(createdProduct?.id);
  const isEditMode = mode === "edit" || Boolean(createdProduct?.id);

  const uploadFiles = async (productID: string) => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const uploadFile = selectedFiles[i];
        const formData = new FormData();
        formData.append("file", uploadFile.file);
        formData.append("product_id", productID);
        formData.append("is_main", String(uploadFile.isMain ?? false));
        formData.append("display_order", String(uploadFile.displayOrder ?? i));
        if (usageTag) {
          formData.append("usage_tag", usageTag);
        }

        const token = localStorage.getItem("access_token");
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const base = import.meta.env.PUBLIC_API_URL || "";
        const uploadURL = `${base}/admin/catalog/assets/upload`;
        const res = await fetch(uploadURL, {
          method: "POST",
          body: formData,
          credentials: "include",
          headers,
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = (payload && (payload.error || payload.message)) || "Upload asset gagal";
          throw new Error(message);
        }

        setUploadProgress({ current: i + 1, total: selectedFiles.length });
      }

      setSelectedFiles([]);
      setUploadProgress(null);
      await refreshExistingAssets(productID);
      notifySuccess("Product assets uploaded");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    const price = Number(form.price);
    const salePrice = form.sale_price.trim() ? Number(form.sale_price) : undefined;

    if (!form.sku.trim() || !form.name.trim()) {
      setError("SKU dan Name wajib diisi");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Price harus angka >= 0");
      return;
    }
    if (typeof salePrice === "number" && (!Number.isFinite(salePrice) || salePrice < 0)) {
      setError("Sale price harus angka >= 0");
      return;
    }

    let seoContent: unknown;
    let attributes: unknown;

    try {
      seoContent = form.seo_content.trim() ? JSON.parse(form.seo_content) : undefined;
    } catch {
      setError("SEO Content harus JSON valid");
      return;
    }

    try {
      attributes = form.attributes.trim() ? JSON.parse(form.attributes) : undefined;
    } catch {
      setError("Attributes harus JSON valid");
      return;
    }

    const payload: ProductPayload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: descriptionValue.plain || undefined,
      description_html: descriptionValue.html || undefined,
      description_plain: descriptionValue.plain || undefined,
      description_blocks: descriptionValue.blocks,
      short_description: form.short_description.trim() || undefined,
      price,
      sale_price: salePrice,
      status: form.status.trim() || "draft",
      stock_status: form.stock_status.trim() || "instock",
      is_visible: form.is_visible,
      seo_content: seoContent,
      attributes,
      business_id: form.business_id || undefined,
      category_ids: selectedCategoryIDs,
      tag_ids: selectedTagIDs,
      is_negotiate: form.is_negotiate,
      product_type: form.product_type,
      tax_type: (form.tax_type as any) || undefined,
      tax_rate: form.tax_rate.trim() ? Number(form.tax_rate) : undefined,
      custom_tax: form.custom_tax,
      price_override_enabled: form.price_override_enabled,
      weight: form.weight.trim() ? Number(form.weight) : undefined,
      dimensions_length: form.dimensions_length.trim() ? Number(form.dimensions_length) : undefined,
      dimensions_width: form.dimensions_width.trim() ? Number(form.dimensions_width) : undefined,
      dimensions_height: form.dimensions_height.trim() ? Number(form.dimensions_height) : undefined,
    };

    try {
      if (mode === "create" && !createdProduct?.id) {
        const created = await onSubmit(payload);
        setCreatedProduct(created);
        setExistingAssets([]);
        return;
      }

      const validationError = await validateFilesAgainstUsageConfig(selectedFiles, usageTag, productAssetUsageConfig);
      if (validationError) {
        setError(validationError);
        return;
      }

      const saved = await onSubmit(payload, activeProductID);
      if (selectedFiles.length > 0 && saved?.id) {
        await uploadFiles(saved.id);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan product");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const textareaClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <AdminModal
      open={open}
      title={isEditMode ? "Edit Product" : "Create Product"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            disabled={submitting || uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {uploading && uploadProgress
              ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
              : submitting
              ? "Saving..."
              : isEditMode
              ? "Save"
              : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Product Profile</p>
          <p className="text-sm text-slate-600">Lengkapi detail produk, kategori, tags, dan assets agar listing lebih rapi dan siap publish.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Informasi Dasar</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="text-sm">
              <span className={labelClass}>SKU</span>
              <input className={inputClass} value={form.sku} onChange={(e) => setField("sku", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Name</span>
              <input className={inputClass} value={form.name} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Slug</span>
              <input className={inputClass} value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Business</span>
              <select className={inputClass} value={form.business_id} onChange={(e) => setField("business_id", e.target.value)}>
                <option value="">No business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className={labelClass}>Price</span>
              <input type="number" min="0" className={inputClass} value={form.price} onChange={(e) => setField("price", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Sale Price</span>
              <input type="number" min="0" className={inputClass} value={form.sale_price} onChange={(e) => setField("sale_price", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Status</span>
              <select className={inputClass} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <label className="text-sm">
              <span className={labelClass}>Stock Status</span>
              <select className={inputClass} value={form.stock_status} onChange={(e) => setField("stock_status", e.target.value)}>
                <option value="instock">instock</option>
                <option value="outofstock">outofstock</option>
                <option value="backorder">backorder</option>
              </select>
            </label>
            <label className="text-sm">
              <span className={labelClass}>Product Type</span>
              <select className={inputClass} value={form.product_type} onChange={(e) => setField("product_type", e.target.value)}>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="digital">Digital</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className={labelClass}>Short Description</span>
              <textarea className={textareaClass} rows={2} value={form.short_description} onChange={(e) => setField("short_description", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Shipping Data</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="text-sm">
              <span className={labelClass}>Weight (kg)</span>
              <input
                type="number"
                min="0"
                step="0.001"
                className={inputClass}
                value={form.weight}
                onChange={(e) => setField("weight", e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Length (cm)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.dimensions_length}
                onChange={(e) => setField("dimensions_length", e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Width (cm)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.dimensions_width}
                onChange={(e) => setField("dimensions_width", e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Height (cm)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.dimensions_height}
                onChange={(e) => setField("dimensions_height", e.target.value)}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Used as fallback shipping data for products without variations.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Klasifikasi</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <div className="text-sm">
              <span className={labelClass}>Categories</span>
              {categories.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No categories available</div>
              ) : (
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={selectedCategoryIDs.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
                      <span>{cat.name}</span>
                      <span className="text-xs text-slate-500">({cat.slug})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="text-sm">
              <span className={labelClass}>Tags</span>
              {tags.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No tags available</div>
              ) : (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                  />
                  <div className="max-h-32 space-y-2 overflow-y-auto">
                    {filteredTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={selectedTagIDs.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                        <span>{tag.name}</span>
                        <span className="text-xs text-slate-500">({tag.slug})</span>
                      </label>
                    ))}
                    {filteredTags.length === 0 ? <div className="text-xs text-slate-500">Tidak ada tag yang cocok.</div> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {showAdvancedSections ? (
          <>
            <AssetBundleField
              title="Product Images & Assets"
              usageConfig={productAssetUsageConfig}
              usageTag={usageTag}
              onUsageTagChange={setUsageTag}
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
                  await adminPut(`/admin/catalog/assets/${asset.id}`, { is_main: true, usage_tag: asset.usage_tag || "" });
                  await refreshExistingAssets(activeProductID);
                  notifySuccess("Set as main");
                } catch (err) {
                  console.error(err);
                  notifyError("Failed to set as main");
                }
              }}
              onDeleteExisting={async (asset) => {
                if (!activeProductID) return;
                if (!confirm("Delete this asset?")) return;
                try {
                  await adminDelete(`/admin/catalog/assets/${asset.id}`);
                  await refreshExistingAssets(activeProductID);
                  notifySuccess("Deleted asset");
                } catch (err) {
                  console.error(err);
                  notifyError("Failed to delete asset");
                }
              }}
              onUpdateExisting={async (asset, patch) => {
                try {
                  await adminPut(`/admin/catalog/assets/${asset.id}`, patch);
                  setExistingAssets((prev) =>
                    prev.map((it) =>
                      it.id === asset.id
                        ? {
                            ...it,
                            ...(typeof patch.usage_tag !== "undefined" ? { usage_tag: patch.usage_tag } : {}),
                            ...(typeof patch.display_order !== "undefined" ? { display_order: patch.display_order } : {}),
                          }
                        : it
                    )
                  );
                  notifySuccess(typeof patch.display_order !== "undefined" ? "Order updated" : "Tag updated");
                } catch (err) {
                  console.error(err);
                  notifyError(typeof patch.display_order !== "undefined" ? "Failed to update order" : "Failed to update tag");
                }
              }}
            />

            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Settings</h4>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 text-sm">
                <label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={form.is_visible} onChange={(e) => setField("is_visible", e.target.checked)} />
                  <span>Visible</span>
                </label>
                <label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={form.is_negotiate} onChange={(e) => setField("is_negotiate", e.target.checked)} />
                  <span>Negotiable price</span>
                </label>
                <label className="text-sm">
                  <span className={labelClass}>Tax Type</span>
                  <select className={inputClass} value={form.tax_type} onChange={(e) => setField("tax_type", e.target.value)}>
                    <option value="exclude">Exclude (tax added on top)</option>
                    <option value="include">Include (tax included in price)</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className={labelClass}>Tax Rate (%)</span>
                  <input type="number" min="0" step="0.01" className={inputClass} value={form.tax_rate} onChange={(e) => setField("tax_rate", e.target.value)} />
                </label>

                <label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={form.custom_tax} onChange={(e) => setField("custom_tax", e.target.checked)} />
                  <span>Custom tax (use product tax settings)</span>
                </label>

                <label className="inline-flex items-start gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                  <input type="checkbox" checked={form.price_override_enabled} onChange={(e) => setField("price_override_enabled", e.target.checked)} />
                  <span>Allow price override at POS</span>
                </label>

                <div className="md:col-span-2 text-xs text-slate-500">
                  <p>
                    <strong>Custom tax:</strong> jika dicentang, sistem akan menggunakan <em>tax type</em> dan <em>tax rate</em> yang Anda set di produk ini. Jika tidak dicentang, pajak akan diambil dari pengaturan global toko.
                  </p>
                  <p className="mt-1">
                    <strong>Allow price override:</strong> jika diaktifkan, kasir di POS dapat mengubah harga per item saat menambah ke order (butuh permission terpisah untuk kontrol akses).
                  </p>
                </div>
              </div>
            </section>

            <RichTextEditor
              value={descriptionValue.html}
              placeholder="Tulis deskripsi produk yang informatif dan meyakinkan"
              onChange={setDescriptionValue}
            />

            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Metadata JSON</h4>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <label className="text-sm">
                  <span className={labelClass}>SEO Content (JSON)</span>
                  <textarea className={`${textareaClass} font-mono`} rows={4} value={form.seo_content} onChange={(e) => setField("seo_content", e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className={labelClass}>Attributes (JSON)</span>
                  <textarea className={`${textareaClass} font-mono`} rows={4} value={form.attributes} onChange={(e) => setField("attributes", e.target.value)} />
                </label>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Klik <span className="font-semibold text-slate-900">Create</span> untuk membuat product terlebih dahulu. Setelah `id` tersedia, assets, editor description, dan metadata JSON akan muncul.
          </div>
        )}

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div> : null}
      </div>
    </AdminModal>
  );
}
