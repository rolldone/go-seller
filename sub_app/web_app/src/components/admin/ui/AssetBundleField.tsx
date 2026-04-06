import { useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import AdminModal from "./AdminModal";
import FileUploadDropzone, { type UploadFile } from "./FileUploadDropzone";
import FilePreviewGrid from "./FilePreviewGrid";

export type AssetRule = {
  label: string;
  helper: string;
  minWidth: number;
  minHeight: number;
  aspectRatio?: number;
  targetWidth?: number;
  targetHeight?: number;
};

export type AssetRulesConfig = {
  type: string;
  rules: Record<string, AssetRule>;
};

export type ExistingAsset = {
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

type Props = {
  title?: string;
  usageConfig: AssetRulesConfig;
  usageTag: string;
  onUsageTagChange: (value: string) => void;
  selectedFiles: UploadFile[];
  onSelectedFilesChange: (files: UploadFile[]) => void;
  existingAssets?: ExistingAsset[];
  loadingExisting?: boolean;
  showExisting?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  onSetMainExisting?: (asset: ExistingAsset) => Promise<void>;
  onDeleteExisting?: (asset: ExistingAsset) => Promise<void>;
  onUpdateExisting?: (asset: ExistingAsset, patch: { usage_tag?: string; display_order?: number }) => Promise<void>;
};

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const imageURL = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.src = imageURL;
    });
    return img;
  } finally {
    URL.revokeObjectURL(imageURL);
  }
}

async function createCroppedFile(
  sourceFile: File,
  croppedAreaPixels: Area,
  targetWidth?: number,
  targetHeight?: number
): Promise<File> {
  const img = await loadImageFromFile(sourceFile);
  const canvas = document.createElement("canvas");
  const outWidth = targetWidth || Math.round(croppedAreaPixels.width);
  const outHeight = targetHeight || Math.round(croppedAreaPixels.height);
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas tidak tersedia");
  }

  ctx.drawImage(
    img,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outWidth,
    outHeight
  );

  const mimeType = sourceFile.type && sourceFile.type.startsWith("image/") ? sourceFile.type : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Gagal menghasilkan hasil crop"));
      }
    }, mimeType, 0.92);
  });

  return new File([blob], sourceFile.name, { type: mimeType, lastModified: Date.now() });
}

export async function validateFilesAgainstUsageConfig(
  files: UploadFile[],
  usageTag: string,
  usageConfig: AssetRulesConfig
): Promise<string | null> {
  if (!usageTag) {
    return null;
  }
  const rule = usageConfig.rules[usageTag];
  if (!rule) {
    return null;
  }

  for (const uploadFile of files) {
    if (!uploadFile.file.type.startsWith("image/")) {
      continue;
    }

    const img = await loadImageFromFile(uploadFile.file);
    if (img.width < rule.minWidth || img.height < rule.minHeight) {
      return `${uploadFile.file.name}: minimal ${rule.minWidth}x${rule.minHeight}px (sekarang ${img.width}x${img.height}px)`;
    }

    if (rule.aspectRatio) {
      const actual = img.width / img.height;
      const tolerance = 0.02;
      if (Math.abs(actual - rule.aspectRatio) > tolerance) {
        return `${uploadFile.file.name}: rasio harus ${rule.aspectRatio.toFixed(2)} (sekarang ${actual.toFixed(2)}), gunakan Crop.`;
      }
    }
  }

  return null;
}

export default function AssetBundleField({
  title = "Assets",
  usageConfig,
  usageTag,
  onUsageTagChange,
  selectedFiles,
  onSelectedFilesChange,
  existingAssets = [],
  loadingExisting = false,
  showExisting = false,
  maxFiles = 20,
  maxSizeMB = 10,
  accept = "image/*",
  onSetMainExisting,
  onDeleteExisting,
  onUpdateExisting,
}: Props) {
  const [cropFile, setCropFile] = useState<UploadFile | null>(null);
  const [cropImageURL, setCropImageURL] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropSaving, setCropSaving] = useState(false);
  const [cropError, setCropError] = useState("");

  const usageTagOptions = useMemo(() => Object.keys(usageConfig.rules), [usageConfig.rules]);
  const activeUsageRule = usageTag ? usageConfig.rules[usageTag] : undefined;

  const handleFilesAdded = (files: UploadFile[]) => {
    const combined = [...selectedFiles, ...files];
    if (!combined.some((f) => f.isMain) && combined.length > 0) {
      combined[0].isMain = true;
    }
    onSelectedFilesChange(combined.map((f, idx) => ({ ...f, displayOrder: idx })));
  };

  const handleRemoveFile = (id: string) => {
    const filtered = selectedFiles.filter((f) => f.id !== id);
    const removedMain = selectedFiles.find((f) => f.id === id)?.isMain;
    if (removedMain && filtered.length > 0) {
      filtered[0].isMain = true;
    }
    onSelectedFilesChange(filtered.map((f, idx) => ({ ...f, displayOrder: idx })));
  };

  const handleSetMainFile = (id: string) => {
    onSelectedFilesChange(selectedFiles.map((f) => ({ ...f, isMain: f.id === id })));
  };

  const groupedExistingAssets = existingAssets.reduce<Record<string, ExistingAsset[]>>((acc, asset) => {
    const tag = asset.usage_tag?.trim() || "untagged";
    if (!acc[tag]) {
      acc[tag] = [];
    }
    acc[tag].push(asset);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedExistingAssets).map(([tag, assets]) => [
    tag,
    [...assets].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    }),
  ] as const);

  const openCropper = (uploadFile: UploadFile) => {
    if (!uploadFile.file.type.startsWith("image/")) {
      return;
    }
    setCropError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropFile(uploadFile);
    setCropImageURL(URL.createObjectURL(uploadFile.file));
  };

  const closeCropper = () => {
    if (cropImageURL) {
      URL.revokeObjectURL(cropImageURL);
    }
    setCropImageURL("");
    setCropFile(null);
    setCropError("");
    setCropSaving(false);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const applyCrop = async () => {
    if (!cropFile || !croppedAreaPixels) {
      setCropError("Area crop belum dipilih");
      return;
    }

    setCropSaving(true);
    setCropError("");
    try {
      const croppedFile = await createCroppedFile(
        cropFile.file,
        croppedAreaPixels,
        activeUsageRule?.targetWidth,
        activeUsageRule?.targetHeight
      );
      const previewURL = URL.createObjectURL(croppedFile);
      onSelectedFilesChange(
        selectedFiles.map((f) => (f.id === cropFile.id ? { ...f, file: croppedFile, preview: previewURL } : f))
      );
      closeCropper();
    } catch (err) {
      setCropError(err instanceof Error ? err.message : "Gagal crop gambar");
      setCropSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>

      {showExisting ? (
        <div className="mb-4">
          <h5 className="mb-2 text-sm font-medium text-slate-700">Existing Assets</h5>
          {loadingExisting ? (
            <div className="text-sm text-slate-500">Loading assets...</div>
          ) : existingAssets.length === 0 ? (
            <div className="text-sm text-slate-500">No existing assets</div>
          ) : (
            <div className="space-y-4">
              {groupedEntries.map(([tag, assets]) => (
                <div key={tag} className="space-y-2">
                  <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{tag}</h6>
                  {assets.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded border p-2">
                      <div className="w-20 flex-shrink-0">
                        {a.public_url ? (
                          <img src={a.public_url} alt={a.original_name || a.file_path} className="h-16 w-20 rounded object-cover" />
                        ) : (
                          <div className="h-16 w-20 rounded bg-slate-100" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{a.original_name || a.file_path}</div>
                            <div className="text-xs text-slate-500">{a.file_type} • {a.file_size ? `${(a.file_size / 1024 / 1024).toFixed(2)} MB` : "-"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSetMainExisting?.(a)}
                              className={`text-xs font-medium ${a.is_main ? "text-slate-900" : "text-slate-700"}`}
                              disabled={!onSetMainExisting}
                            >
                              {a.is_main ? "Main" : "Set Main"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteExisting?.(a)}
                              className="text-xs text-red-600"
                              disabled={!onDeleteExisting}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <label className="text-xs text-slate-600">Usage Tag</label>
                          <select
                            value={a.usage_tag || ""}
                            onChange={(e) => onUpdateExisting?.(a, { usage_tag: e.target.value })}
                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                            disabled={!onUpdateExisting}
                          >
                            <option value="">(none)</option>
                            {usageTagOptions.map((tagOption) => (
                              <option key={tagOption} value={tagOption}>{tagOption}</option>
                            ))}
                          </select>

                          <label className="text-xs text-slate-600">Order</label>
                          <input
                            type="number"
                            defaultValue={a.display_order ?? 0}
                            onBlur={(e) => {
                              const next = Number((e.target as HTMLInputElement).value || 0);
                              onUpdateExisting?.(a, { display_order: next });
                            }}
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                            disabled={!onUpdateExisting}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="mb-3 max-w-xs">
        <label className="mb-1 block text-sm text-slate-700">Usage Tag (applies to all uploads)</label>
        <select value={usageTag} onChange={(e) => onUsageTagChange(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="">(none)</option>
          {usageTagOptions.map((tagOption) => (
            <option key={tagOption} value={tagOption}>{tagOption}</option>
          ))}
        </select>
        {activeUsageRule ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
            <strong>{activeUsageRule.label}:</strong> {activeUsageRule.helper}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Pilih usage tag agar aturan ukuran dan rasio bisa divalidasi.</p>
        )}
      </div>

      <FileUploadDropzone onFilesAdded={handleFilesAdded} maxFiles={maxFiles} maxSizeMB={maxSizeMB} accept={accept} />
      <FilePreviewGrid files={selectedFiles} onRemove={handleRemoveFile} onSetMain={handleSetMainFile} onEditFile={openCropper} editLabel="Crop" />

      <AdminModal
        open={Boolean(cropFile)}
        title="Crop Image"
        onClose={closeCropper}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeCropper}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              disabled={cropSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCrop}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
              disabled={cropSaving}
            >
              {cropSaving ? "Saving..." : "Apply Crop"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {activeUsageRule ? (
            <p className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              {activeUsageRule.helper}
            </p>
          ) : null}
          <div className="relative h-[380px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            {cropImageURL ? (
              <Cropper
                image={cropImageURL}
                crop={crop}
                zoom={zoom}
                aspect={activeUsageRule?.aspectRatio || 1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          {cropError ? <p className="text-sm text-rose-600">{cropError}</p> : null}
        </div>
      </AdminModal>
    </section>
  );
}
