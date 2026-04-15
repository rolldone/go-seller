import { useEffect, useState } from "react";

import AdminModal from "../ui/AdminModal";
import type { UploadFile } from "../ui/FileUploadDropzone";
import AssetBundleField, { type AssetRulesConfig, type ExistingAssetFolder, validateFilesAgainstUsageConfig } from "../ui/AssetBundleField";
import RichTextEditor, { type RichTextValue } from "../ui/RichTextEditor";
import type { Business, BusinessPayload } from "./types";
import BusinessDisclaimersManager from "./BusinessDisclaimersManager";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import { notifyError, notifySuccess } from "../../../lib/notification";

const defaultForm = {
  name: "",
  slug: "",
  short_description: "",
  owner_name: "",
  owner_role: "",
  founded_year: "",
  address: "",
  chat_response_time: "",
  email: "",
  phone: "",
  highlights: "",
  operational_hours: "",
  show_contact_email: true,
  show_phone: true,
};

type FormState = typeof defaultForm;

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Business | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: BusinessPayload, businessID?: string) => Promise<Business>;
};

type ExistingAsset = {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  file_size?: number;
  original_name?: string;
  public_url?: string;
  is_main: boolean;
  display_order: number;
  usage_tag?: string;
  folder_id?: string | null;
};

const businessAssetUsageConfig: AssetRulesConfig = {
  type: "business_asset",
  rules: {
    logo: {
      label: "Logo",
      helper: "Rasio 1:1. Minimal 512x512 px. Gunakan gambar bersih agar tetap terbaca pada ukuran kecil.",
      minWidth: 512,
      minHeight: 512,
      aspectRatio: 1,
      targetWidth: 1024,
      targetHeight: 1024,
    },
    cover: {
      label: "Cover",
      helper: "Rasio 16:9. Minimal 1600x900 px untuk tampilan hero yang tajam.",
      minWidth: 1600,
      minHeight: 900,
      aspectRatio: 16 / 9,
      targetWidth: 1600,
      targetHeight: 900,
    },
    gallery: {
      label: "Gallery",
      helper: "Fleksibel. Minimal 1200x1200 px direkomendasikan untuk kualitas feed.",
      minWidth: 1200,
      minHeight: 1200,
    },
    thumbnail: {
      label: "Thumbnail",
      helper: "Rasio 1:1. Minimal 600x600 px. Ideal untuk card/listing.",
      minWidth: 600,
      minHeight: 600,
      aspectRatio: 1,
      targetWidth: 800,
      targetHeight: 800,
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

export default function BusinessFormModal({ open, mode, initialData, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [error, setError] = useState("");
  const [assetUploading, setAssetUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [usageTag, setUsageTag] = useState<string>("gallery");
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [existingAssets, setExistingAssets] = useState<ExistingAsset[]>([]);
  const [assetFolders, setAssetFolders] = useState<ExistingAssetFolder[]>([]);
  const [selectedFolderID, setSelectedFolderID] = useState<string>("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<Business | null>(null);
  const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({
    html: "",
    plain: "",
    blocks: { type: "doc", content: [] },
  });

  const activeBusinessID = createdBusiness?.id || initialData?.id || undefined;
  const showAdvancedSections = mode === "edit" || Boolean(createdBusiness?.id);
  const isEditMode = mode === "edit" || Boolean(createdBusiness?.id);

  useEffect(() => {
    if (!open) return;
    setError("");
    setAssetUploading(false);
    setSelectedFiles([]);
    setUploadProgress(null);
    setUsageTag("gallery");
    setCreatedBusiness(mode === "edit" ? initialData || null : null);
    setDescriptionValue({
      html: initialData?.description_html || initialData?.description || "",
      plain: initialData?.description_plain || "",
      blocks: (initialData?.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
    });
    setForm({
      ...defaultForm,
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      short_description: initialData?.short_description || "",
      owner_name: initialData?.owner_name || "",
      owner_role: initialData?.owner_role || "",
      founded_year: initialData?.founded_year ? String(initialData.founded_year) : "",
      address: initialData?.address || "",
      chat_response_time: initialData?.chat_response_time || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      highlights: (initialData?.highlights || []).filter(Boolean).join("\n"),
      operational_hours: initialData?.operational_hours ? JSON.stringify(initialData.operational_hours, null, 2) : "",
      show_contact_email: typeof initialData?.show_contact_email === "boolean" ? initialData?.show_contact_email : true,
      show_phone: typeof initialData?.show_phone === "boolean" ? initialData?.show_phone : true,
    });

    if (mode === "edit" && initialData?.id) {
      (async () => {
        setLoadingExisting(true);
        try {
          const res = await adminGet<{ data: ExistingAsset[] }>(`/admin/catalog/businesses/${initialData.id}/assets?limit=100`);
          setExistingAssets(res.data || []);
          const folderRes = await adminGet<{ data: ExistingAssetFolder[] }>(`/admin/catalog/businesses/${initialData.id}/asset-folders`);
          setAssetFolders(folderRes.data || []);
        } catch (err) {
          console.error("Failed to load business assets", err);
          setExistingAssets([]);
          setAssetFolders([]);
        } finally {
          setLoadingExisting(false);
        }
      })();
    } else {
      setExistingAssets([]);
      setAssetFolders([]);
    }
  }, [open, initialData, mode]);

  const setField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const textareaClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const SHORT_DESC_MAX = 160;

  const refreshExistingAssets = async (businessID: string) => {
    const folderQuery = selectedFolderID ? `&folder_id=${encodeURIComponent(selectedFolderID)}` : "&folder_id=root";
    const res = await adminGet<{ data: ExistingAsset[] }>(`/admin/catalog/businesses/${businessID}/assets?limit=100${folderQuery}`);
    setExistingAssets(res.data || []);
  };

  const refreshAssetFolders = async (businessID: string) => {
    const res = await adminGet<{ data: ExistingAssetFolder[] }>(`/admin/catalog/businesses/${businessID}/asset-folders`);
    setAssetFolders(res.data || []);
  };

  const uploadSelectedAssets = async (businessID: string) => {
    if (selectedFiles.length === 0) {
      return;
    }

    setUploadProgress({ current: 0, total: selectedFiles.length });

    for (let i = 0; i < selectedFiles.length; i++) {
      const uploadFile = selectedFiles[i];
      const formData = new FormData();
      formData.append("file", uploadFile.file);
      formData.append("file_type", "image");
      formData.append("is_main", String(uploadFile.isMain ?? false));
      formData.append("display_order", String(uploadFile.displayOrder ?? i));
      if (usageTag) {
        formData.append("usage_tag", usageTag);
      }
      if (selectedFolderID) {
        formData.append("folder_id", selectedFolderID);
      }

      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const base = import.meta.env.PUBLIC_API_URL || "";
      const uploadURL = `${base}/admin/catalog/businesses/${businessID}/assets/upload`;
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
    await refreshExistingAssets(businessID);
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.name.trim()) {
      setError("Name wajib diisi");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug wajib diisi");
      return;
    }
    let operational: unknown | undefined;
    if (form.operational_hours.trim()) {
      try {
        operational = JSON.parse(form.operational_hours);
      } catch (err) {
        setError("Operational hours harus JSON valid");
        return;
      }
    }

    const highlights = form.highlights
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const payload: BusinessPayload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      short_description: form.short_description.trim() ? form.short_description.trim().slice(0, SHORT_DESC_MAX) : undefined,
      description_html: descriptionValue.html || undefined,
      description_plain: descriptionValue.plain || undefined,
      description_blocks: descriptionValue.blocks,
      highlights: highlights.length > 0 ? highlights : undefined,
      owner_name: form.owner_name.trim() || undefined,
      owner_role: form.owner_role.trim() || undefined,
      founded_year: form.founded_year.trim() ? Number(form.founded_year.trim()) : undefined,
      address: form.address.trim() || undefined,
      operational_hours: operational,
      chat_response_time: form.chat_response_time.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      show_contact_email: form.show_contact_email,
      show_phone: form.show_phone,
    };

    try {
      if (mode === "create" && !createdBusiness?.id) {
        const created = await onSubmit(payload);
        setCreatedBusiness(created);
        setExistingAssets([]);
        return;
      }

      const saved = await onSubmit(payload, activeBusinessID);
      if (selectedFiles.length > 0 && saved?.id) {
        const validationError = await validateFilesAgainstUsageConfig(selectedFiles, usageTag, businessAssetUsageConfig);
        if (validationError) {
          setError(validationError);
          return;
        }
        setAssetUploading(true);
        try {
          await uploadSelectedAssets(saved.id);
          notifySuccess("Business assets uploaded");
        } finally {
          setAssetUploading(false);
        }
      }
      onClose();
    } catch (err) {
      setAssetUploading(false);
      setError(err instanceof Error ? err.message : "Gagal menyimpan business");
    }
  };

  return (
    <>
    <AdminModal
      open={open}
      title={isEditMode ? "Edit Business" : "Create Business"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
            disabled={submitting || assetUploading}
          >
            {submitting ? "Saving..." : assetUploading ? "Uploading assets..." : isEditMode ? "Save" : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Business Profile</p>
              <p className="text-sm text-slate-600">Lengkapi identitas, deskripsi, dan kontak agar tampilan publik lebih profesional.</p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Informasi Dasar</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="text-sm">
              <span className={labelClass}>Name</span>
              <input className={inputClass} value={form.name} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Slug</span>
              <input className={inputClass} value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className={labelClass}>Short Description</span>
              <textarea
                className={textareaClass}
                rows={2}
                maxLength={SHORT_DESC_MAX}
                value={form.short_description}
                onChange={(e) => setField("short_description", e.target.value.slice(0, SHORT_DESC_MAX))}
              />
              <div className="mt-1 text-xs text-slate-500">{form.short_description.length}/{SHORT_DESC_MAX} characters</div>
            </label>
            <label className="text-sm">
              <span className={labelClass}>Founded Year</span>
              <input type="number" min="1900" max="2100" className={inputClass} value={form.founded_year} onChange={(e) => setField("founded_year", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Pemilik</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="text-sm">
              <span className={labelClass}>Owner Name</span>
              <input className={inputClass} value={form.owner_name} onChange={(e) => setField("owner_name", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Owner Role</span>
              <input className={inputClass} value={form.owner_role} onChange={(e) => setField("owner_role", e.target.value)} />
            </label>
          </div>
        </section>

        {showAdvancedSections ? (
          <>
            <AssetBundleField
              title="Business Assets"
              usageConfig={businessAssetUsageConfig}
              usageTag={usageTag}
              onUsageTagChange={setUsageTag}
              selectedFiles={selectedFiles}
              onSelectedFilesChange={setSelectedFiles}
              existingAssets={existingAssets}
              folders={assetFolders}
              selectedFolderID={selectedFolderID}
              onSelectedFolderIDChange={async (value) => {
                setSelectedFolderID(value);
                if (activeBusinessID) {
                  const folderQuery = value ? `&folder_id=${encodeURIComponent(value)}` : "&folder_id=root";
                  const res = await adminGet<{ data: ExistingAsset[] }>(`/admin/catalog/businesses/${activeBusinessID}/assets?limit=100${folderQuery}`);
                  setExistingAssets(res.data || []);
                }
              }}
              onCreateFolder={async (name, parentID) => {
                if (!activeBusinessID) return;
                await adminPost(`/admin/catalog/businesses/${activeBusinessID}/asset-folders`, {
                  name,
                  parent_id: parentID || null,
                });
                await refreshAssetFolders(activeBusinessID);
                notifySuccess("Folder created");
              }}
              loadingExisting={loadingExisting}
              showExisting={Boolean(activeBusinessID)}
              maxFiles={20}
              maxSizeMB={10}
              accept="image/*"
              onCopyExistingLink={async (asset) => {
                const link = asset.public_url || asset.file_path;
                if (!link) return;
                await navigator.clipboard.writeText(link);
                notifySuccess("Link copied");
              }}
              onSetMainExisting={async (asset) => {
                if (!activeBusinessID) return;
                try {
                  await adminPut(`/admin/catalog/businesses/${activeBusinessID}/assets/${asset.id}`, { is_main: true, usage_tag: asset.usage_tag || "" });
                  await refreshExistingAssets(activeBusinessID);
                  notifySuccess("Set as main");
                } catch (err) {
                  console.error(err);
                  notifyError("Failed to set as main");
                }
              }}
              onDeleteExisting={async (asset) => {
                if (!activeBusinessID) return;
                if (!confirm("Delete this asset?")) return;
                try {
                  await adminDelete(`/admin/catalog/businesses/${activeBusinessID}/assets/${asset.id}`);
                  await refreshExistingAssets(activeBusinessID);
                  notifySuccess("Deleted asset");
                } catch (err) {
                  console.error(err);
                  notifyError("Failed to delete asset");
                }
              }}
              onUpdateExisting={async (asset, patch) => {
                if (!activeBusinessID) return;
                try {
                  await adminPut(`/admin/catalog/businesses/${activeBusinessID}/assets/${asset.id}`, patch);
                  setExistingAssets((prev) =>
                    prev.map((it) =>
                      it.id === asset.id
                        ? {
                            ...it,
                            ...(typeof patch.usage_tag !== "undefined" ? { usage_tag: patch.usage_tag } : {}),
                            ...(typeof patch.display_order !== "undefined" ? { display_order: patch.display_order } : {}),
                            ...(typeof patch.folder_id !== "undefined" ? { folder_id: patch.folder_id } : {}),
                          }
                        : it
                    )
                  );
                  notifySuccess(
                    typeof patch.display_order !== "undefined"
                      ? "Order updated"
                      : typeof patch.folder_id !== "undefined"
                      ? "Asset moved"
                      : "Tag updated"
                  );
                } catch (err) {
                  console.error(err);
                  notifyError(
                    typeof patch.display_order !== "undefined"
                      ? "Failed to update order"
                      : typeof patch.folder_id !== "undefined"
                      ? "Failed to move asset"
                      : "Failed to update tag"
                  );
                }
              }}
            />
            {assetUploading && uploadProgress ? (
              <p className="-mt-2 text-xs text-slate-600">Uploading {uploadProgress.current}/{uploadProgress.total}...</p>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Kontak & Operasional</h4>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="text-sm">
              <span className={labelClass}>Chat Response Time</span>
              <input className={inputClass} value={form.chat_response_time} onChange={(e) => setField("chat_response_time", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Email</span>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Phone</span>
              <input className={inputClass} value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </label>
            <label className="text-sm">
              <span className={labelClass}>Address</span>
              <textarea className={textareaClass} rows={2} value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className={labelClass}>Operational Hours (JSON)</span>
              <textarea rows={2} className={`${textareaClass} font-mono`} value={form.operational_hours} onChange={(e) => setField("operational_hours", e.target.value)} placeholder='{"mon":"09:00-22:00"}' />
            </label>
          </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Visibility</p>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 text-sm">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              <input type="checkbox" checked={form.show_contact_email} onChange={(e) => setField("show_contact_email", e.target.checked)} />
              Tampilkan email kontak
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              <input type="checkbox" checked={form.show_phone} onChange={(e) => setField("show_phone", e.target.checked)} />
              Tampilkan nomor telepon
            </label>
          </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Highlights</h4>
          <label className="text-sm block">
            <span className={labelClass}>Highlights (satu per baris)</span>
            <textarea rows={4} className={textareaClass} value={form.highlights} onChange={(e) => setField("highlights", e.target.value)} />
          </label>
            </section>

            <BusinessDisclaimersManager businessID={activeBusinessID} />

            <RichTextEditor
              value={descriptionValue.html}
              placeholder="Tulis cerita bisnis, keunggulan, atau highlight layanan"
              onChange={setDescriptionValue}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Klik <span className="font-semibold text-slate-900">Create</span> untuk membuat business terlebih dahulu. Setelah `id` tersedia, asset, kontak, highlight, dan story akan muncul.
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

    </AdminModal>
    </>
  );
}
