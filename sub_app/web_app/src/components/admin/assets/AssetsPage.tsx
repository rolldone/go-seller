import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminDelete, adminGet } from "../entities/adminApi";
import AdminModal from "../ui/AdminModal";

type Asset = {
  id: string;
  product_id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  file_size?: number;
  original_name?: string;
  public_url?: string;
  is_main: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export default function AssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload form state
  const [productId, setProductId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isMain, setIsMain] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [usageTag, setUsageTag] = useState<string>("gallery");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGet<{ data: Asset[]; total: number }>(`/admin/catalog/assets?page=${page}&limit=${limit}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch assets";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !productId.trim()) {
      notifyError("Please select a file and enter product ID");
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      notifyError("File size exceeds 10MB limit");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("product_id", productId.trim());
      formData.append("is_main", isMain ? "true" : "false");
      formData.append("display_order", String(displayOrder));
      if (usageTag) {
        formData.append("usage_tag", usageTag);
      }

      const base = import.meta.env.PUBLIC_API_URL || "";
      const uploadUrl = `${base}/admin/catalog/assets/upload`;
      const response = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      notifySuccess("Asset uploaded successfully");
      setUploadOpen(false);
      resetUploadForm();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload asset";
      notifyError(message);
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setProductId("");
    setSelectedFile(null);
    setFilePreview(null);
    setIsMain(false);
    setDisplayOrder(0);
  };

  const handleDelete = (item: Asset) => {
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await adminDelete(`/admin/catalog/assets/${selected.id}`);
      notifySuccess("Asset deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete asset";
      notifyError(message);
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Assets</h3>
          <p className="text-sm text-slate-600">Kelola asset media produk</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Upload Asset
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-slate-600">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-600">No assets found</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Preview</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Product ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Main</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">Order</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {item.public_url && item.file_type === "image" ? (
                        <img src={item.public_url} alt={item.original_name || "Asset"} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                          {item.file_type}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{item.product_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="max-w-xs truncate">{item.original_name || item.file_path}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.file_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatFileSize(item.file_size)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.is_main ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.display_order}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {items.length} of {total} assets
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Upload Modal */}
      <AdminModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          resetUploadForm();
        }}
        title="Upload Asset"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="product_id" className="block text-sm font-medium text-slate-700 mb-1">
              Product ID *
            </label>
            <input
              type="text"
              id="product_id"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="Enter product UUID"
            />
          </div>

          <div>
            <label htmlFor="file" className="block text-sm font-medium text-slate-700 mb-1">
              File * (Max 10MB)
            </label>
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              required
              accept="image/*,video/*,.pdf"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-slate-600">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div>
            <label htmlFor="usage_tag" className="block text-sm font-medium text-slate-700 mb-1">
              Usage Tag
            </label>
            <select id="usage_tag" value={usageTag} onChange={(e) => setUsageTag(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">(none)</option>
              <option value="thumbnail">thumbnail</option>
              <option value="gallery">gallery</option>
              <option value="social_1_1">social_1_1</option>
              <option value="social_4_5">social_4_5</option>
              <option value="header">header</option>
              <option value="desktop_banner">desktop_banner</option>
            </select>
          </div>

          {filePreview && (
            <div>
              <p className="block text-sm font-medium text-slate-700 mb-1">Preview</p>
              <img src={filePreview} alt="Preview" className="max-w-full h-auto max-h-48 rounded-lg border border-slate-200" />
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isMain} onChange={(e) => setIsMain(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-700">Set as main image</span>
            </label>
          </div>

          <div>
            <label htmlFor="display_order" className="block text-sm font-medium text-slate-700 mb-1">
              Display Order
            </label>
            <input
              type="number"
              id="display_order"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={uploading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Modal */}
      <AdminModal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Asset">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this asset? This action cannot be undone.
          </p>
          {selected && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{selected.original_name || selected.file_path}</p>
              <p className="text-slate-600">Product: {selected.product_id}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
