import { useEffect, useMemo, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminDelete, adminGet, adminPost, adminPostForm, adminPut } from "../entities/adminApi";
import AssetBundleField, {
  type AssetRulesConfig,
  type ExistingAsset,
  type ExistingAssetFolder,
  validateFilesAgainstUsageConfig,
} from "../ui/AssetBundleField";
import type { UploadFile } from "../ui/FileUploadDropzone";

type Business = {
  id: string;
  name: string;
  slug: string;
};

type BusinessListResponse = {
  data: Business[];
};

type AssetListResponse = {
  data: ExistingAsset[];
};

type FolderListResponse = {
  data: ExistingAssetFolder[];
};

const businessAssetUsageConfig: AssetRulesConfig = {
  type: "business_asset",
  rules: {
    cover: {
      label: "Cover",
      helper: "Rasio 16:9. Minimal 1600x900 px.",
      minWidth: 1600,
      minHeight: 900,
      aspectRatio: 16 / 9,
      targetWidth: 1600,
      targetHeight: 900,
    },
    gallery: {
      label: "Gallery",
      helper: "Fleksibel. Minimal 1200x1200 px direkomendasikan.",
      minWidth: 1200,
      minHeight: 1200,
    },
    thumbnail: {
      label: "Thumbnail",
      helper: "Rasio 1:1. Minimal 600x600 px.",
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
      helper: "Rasio 4:5. Minimal 1080x1350 px.",
      minWidth: 1080,
      minHeight: 1350,
      aspectRatio: 4 / 5,
      targetWidth: 1080,
      targetHeight: 1350,
    },
    desktop_banner: {
      label: "Desktop Banner",
      helper: "Rasio 21:9. Minimal 1680x720 px.",
      minWidth: 1680,
      minHeight: 720,
      aspectRatio: 21 / 9,
      targetWidth: 1680,
      targetHeight: 720,
    },
  },
};

const detectFileType = (file: File) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return "file";
};

export default function BusinessAssetsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessID, setSelectedBusinessID] = useState("");
  const [folders, setFolders] = useState<ExistingAssetFolder[]>([]);
  const [selectedFolderID, setSelectedFolderID] = useState("");
  const [assets, setAssets] = useState<ExistingAsset[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [usageTag, setUsageTag] = useState("gallery");
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessID) || null,
    [businesses, selectedBusinessID],
  );

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderID) || null,
    [folders, selectedFolderID],
  );

  const loadBusinesses = async () => {
    setLoadingBusinesses(true);
    setError(null);
    try {
      const res = await adminGet<BusinessListResponse>("/admin/catalog/businesses?page=1&limit=200");
      const list = Array.isArray(res.data) ? res.data : [];
      setBusinesses(list);
      if (!selectedBusinessID && list[0]?.id) {
        setSelectedBusinessID(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar business");
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const loadFolders = async (businessID: string) => {
    const res = await adminGet<FolderListResponse>(`/admin/catalog/businesses/${businessID}/asset-folders`);
    setFolders(Array.isArray(res.data) ? res.data : []);
  };

  const loadAssets = async (businessID: string, folderID: string) => {
    setLoadingAssets(true);
    setError(null);
    try {
      const folderQuery = folderID ? `&folder_id=${encodeURIComponent(folderID)}` : "&folder_id=root";
      const res = await adminGet<AssetListResponse>(`/admin/catalog/businesses/${businessID}/assets?limit=200${folderQuery}`);
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat business assets");
    } finally {
      setLoadingAssets(false);
    }
  };

  const refreshScope = async (businessID: string, folderID: string) => {
    await Promise.all([loadFolders(businessID), loadAssets(businessID, folderID)]);
  };

  useEffect(() => {
    void loadBusinesses();
  }, []);

  useEffect(() => {
    if (!selectedBusinessID) return;
    setSelectedFolderID("");
    void refreshScope(selectedBusinessID, "");
  }, [selectedBusinessID]);

  const handleBusinessChange = async (businessID: string) => {
    setSelectedBusinessID(businessID);
    setSelectedFolderID("");
    setSelectedFiles([]);
  };

  const handleFolderChange = async (folderID: string) => {
    if (!selectedBusinessID) return;
    setSelectedFolderID(folderID);
    await loadAssets(selectedBusinessID, folderID);
  };

  const handleCreateFolder = async (name: string, parentID?: string) => {
    if (!selectedBusinessID) return;
    try {
      await adminPost(`/admin/catalog/businesses/${selectedBusinessID}/asset-folders`, {
        name,
        parent_id: parentID || null,
      });
      await loadFolders(selectedBusinessID);
      notifySuccess("Folder created");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  const handleRenameFolder = async (folder: ExistingAssetFolder, nextName: string) => {
    if (!selectedBusinessID) return;
    try {
      await adminPut(`/admin/catalog/businesses/${selectedBusinessID}/asset-folders/${folder.id}`, { name: nextName });
      await loadFolders(selectedBusinessID);
      notifySuccess("Folder renamed");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to rename folder");
    }
  };

  const handleDeleteFolder = async (folder: ExistingAssetFolder) => {
    if (!selectedBusinessID) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete folder "${folder.path}"?`)) {
      return;
    }
    try {
      await adminDelete(`/admin/catalog/businesses/${selectedBusinessID}/asset-folders/${folder.id}`);
      setSelectedFolderID("");
      await refreshScope(selectedBusinessID, "");
      notifySuccess("Folder deleted");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  const handleUpload = async () => {
    if (!selectedBusinessID) {
      notifyError("Pilih business dulu");
      return;
    }
    if (selectedFiles.length === 0) {
      notifyError("Pilih file terlebih dulu");
      return;
    }

    const validation = await validateFilesAgainstUsageConfig(selectedFiles, usageTag, businessAssetUsageConfig);
    if (validation) {
      notifyError(validation);
      return;
    }

    setUploading(true);
    try {
      for (const [index, uploadFile] of selectedFiles.entries()) {
        const formData = new FormData();
        formData.append("file", uploadFile.file);
        formData.append("file_type", detectFileType(uploadFile.file));
        formData.append("is_main", String(uploadFile.isMain ?? index === 0));
        formData.append("display_order", String(uploadFile.displayOrder ?? index));
        if (usageTag) {
          formData.append("usage_tag", usageTag);
        }
        if (selectedFolderID) {
          formData.append("folder_id", selectedFolderID);
        }

        await adminPostForm(`/admin/catalog/businesses/${selectedBusinessID}/assets/upload`, formData);
      }

      setSelectedFiles([]);
      await loadAssets(selectedBusinessID, selectedFolderID);
      notifySuccess("Assets uploaded");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal upload assets");
    } finally {
      setUploading(false);
    }
  };

  const handleSetMain = async (asset: ExistingAsset) => {
    if (!selectedBusinessID) return;
    try {
      await adminPut(`/admin/catalog/businesses/${selectedBusinessID}/assets/${asset.id}`, {
        is_main: true,
        usage_tag: asset.usage_tag || "",
      });
      await loadAssets(selectedBusinessID, selectedFolderID);
      notifySuccess("Set as main");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to set main asset");
    }
  };

  const handleDeleteAsset = async (asset: ExistingAsset) => {
    if (!selectedBusinessID) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete asset "${asset.original_name || asset.file_path}"?`)) {
      return;
    }
    try {
      await adminDelete(`/admin/catalog/businesses/${selectedBusinessID}/assets/${asset.id}`);
      await loadAssets(selectedBusinessID, selectedFolderID);
      notifySuccess("Asset deleted");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete asset");
    }
  };

  const handleUpdateAsset = async (
    asset: ExistingAsset,
    patch: { usage_tag?: string; display_order?: number; folder_id?: string | null },
  ) => {
    if (!selectedBusinessID) return;
    try {
      await adminPut(`/admin/catalog/businesses/${selectedBusinessID}/assets/${asset.id}`, patch);
      await loadAssets(selectedBusinessID, selectedFolderID);
      notifySuccess("Asset updated");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to update asset");
    }
  };

  const handleCopyLink = async (asset: ExistingAsset) => {
    try {
      const link = asset.public_url || asset.file_path;
      if (!link) return;
      await navigator.clipboard.writeText(link);
      notifySuccess("Link copied");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to copy link");
    }
  };

  const handleDuplicateAsset = async (asset: ExistingAsset) => {
    if (!selectedBusinessID) return;
    try {
      await adminPost(`/admin/catalog/businesses/${selectedBusinessID}/assets/${asset.id}/copy`, {
        folder_id: selectedFolderID || asset.folder_id || null,
      });
      await loadAssets(selectedBusinessID, selectedFolderID);
      notifySuccess("Asset copied");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to copy asset");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <p className="font-semibold">Business Assets</p>
        <p className="mt-1">
          Halaman ini khusus untuk aset publik per business. Product assets tetap ada di menu terpisah.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Business</span>
            <select
              value={selectedBusinessID}
              onChange={(event) => void handleBusinessChange(event.target.value)}
              disabled={loadingBusinesses}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Pilih business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} / {business.slug}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">{selectedBusiness ? selectedBusiness.name : "No business selected"}</div>
            <div className="text-xs text-slate-500">{selectedFolder ? selectedFolder.path : "Root folder"}</div>
          </div>
        </div>
      </div>

      {selectedBusinessID ? (
        <AssetBundleField
          title="Business Media Library"
          usageConfig={businessAssetUsageConfig}
          usageTag={usageTag}
          onUsageTagChange={setUsageTag}
          selectedFiles={selectedFiles}
          onSelectedFilesChange={setSelectedFiles}
          existingAssets={assets}
          folders={folders}
          selectedFolderID={selectedFolderID}
          onSelectedFolderIDChange={(value) => {
            void handleFolderChange(value);
          }}
          onCreateFolder={(name, parentID) => handleCreateFolder(name, parentID)}
          onRenameFolder={(folder, nextName) => handleRenameFolder(folder, nextName)}
          onDeleteFolder={(folder) => handleDeleteFolder(folder)}
          loadingExisting={loadingAssets}
          showExisting
          maxFiles={20}
          maxSizeMB={10}
          accept="image/*,video/*,.pdf"
          onSetMainExisting={(asset) => handleSetMain(asset)}
          onDeleteExisting={(asset) => handleDeleteAsset(asset)}
          onUpdateExisting={(asset, patch) => handleUpdateAsset(asset, patch)}
          onCopyExistingLink={(asset) => handleCopyLink(asset)}
          onDuplicateExisting={(asset) => handleDuplicateAsset(asset)}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Pilih business untuk melihat dan mengelola assets.
        </div>
      )}

      {selectedBusinessID ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || selectedFiles.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} Files` : "Selected Files"}`}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFiles([])}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear Selection
          </button>
          <div className="text-xs text-slate-500">
            Upload akan masuk ke folder aktif. Copy asset akan menduplikasi metadata asset ke folder yang sama.
          </div>
        </div>
      ) : null}
    </div>
  );
}
