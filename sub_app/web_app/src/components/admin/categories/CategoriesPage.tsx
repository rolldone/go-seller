import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import EntityFormModal from "../entities/EntityFormModal";

type Category = {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  icon_url?: string | null;
  sort_priority: number;
  created_at: string;
  updated_at: string;
};

const fields = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text" },
  { key: "icon_url", label: "Icon URL", type: "text" },
  { key: "sort_priority", label: "Sort Priority", type: "number" },
];

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [parentID, setParentID] = useState<string>("");
  const [breadcrumbs, setBreadcrumbs] = useState<Category[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setParentID(params.get("parent_id") || "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (parentID) {
      params.set("parent_id", parentID);
    } else {
      params.delete("parent_id");
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [parentID]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const path = parentID
        ? `/admin/catalog/categories?page=${page}&limit=${limit}&parent_id=${encodeURIComponent(parentID)}`
        : `/admin/catalog/categories?page=${page}&limit=${limit}&parent_id=`;
      const res = await adminGet<{ data: Category[]; total: number }>(path);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch categories";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadBreadcrumbs = async () => {
    if (!parentID) {
      setBreadcrumbs([]);
      return;
    }

    try {
      const chain: Category[] = [];
      let currentID: string | null = parentID;
      let guard = 0;

      while (currentID && guard < 20) {
        guard += 1;
        const current: Category = await adminGet<Category>(`/admin/catalog/categories/${currentID}`);
        chain.unshift(current);
        currentID = current.parent_id || null;
      }

      setBreadcrumbs(chain);
    } catch {
      setBreadcrumbs([]);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit, parentID]);

  useEffect(() => {
    loadBreadcrumbs();
  }, [parentID]);

  const initialValues = useMemo(
    () => ({
      name: selected?.name || "",
      slug: selected?.slug || "",
      icon_url: selected?.icon_url || "",
      sort_priority: selected?.sort_priority ?? 0,
    }),
    [selected],
  );

  const activeParentName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : "Root";

  const handleCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const handleEdit = (item: Category) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload = {
        name: String(values.name || "").trim(),
        slug: String(values.slug || "").trim(),
        parent_id: formMode === "create" ? parentID || undefined : selected?.parent_id || undefined,
        icon_url: String(values.icon_url || "").trim() || undefined,
        sort_priority: Number(values.sort_priority || 0),
      };

      if (formMode === "create") {
        await adminPost<Category>("/admin/catalog/categories", payload);
        notifySuccess("Category created");
      } else if (selected) {
        await adminPut<Category>(`/admin/catalog/categories/${selected.id}`, payload);
        notifySuccess("Category updated");
      }

      setFormOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save category";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: Category) => {
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await adminDelete(`/admin/catalog/categories/${selected.id}`);
      notifySuccess("Category deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToParent = (nextParentID: string) => {
    setPage(1);
    setParentID(nextParentID);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Categories</h3>
          <p className="text-sm text-slate-600">Kelola kategori produk per level parent (gaya PrestaShop).</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
              onClick={() => navigateToParent("")}
            >
              Categories
            </button>
            {breadcrumbs.map((crumb) => (
              <button
                key={crumb.id}
                type="button"
                className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
                onClick={() => navigateToParent(crumb.id)}
              >
                / {crumb.name}
              </button>
            ))}
          </div>
          {parentID ? (
            <div className="mt-2">
              <button
                type="button"
                className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                onClick={() => {
                  const parentOfActive = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].parent_id || "" : "";
                  navigateToParent(parentOfActive || "");
                }}
              >
                Back to parent
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Category
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
        Active level: <span className="font-medium text-slate-900">{activeParentName}</span>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
      {error ? <div className="text-sm text-red-600">Error: {error}</div> : null}
      {!loading && !error && items.length === 0 ? <div className="text-sm text-slate-500">Belum ada data.</div> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-800">{item.slug || "-"}</td>
                  <td className="px-3 py-2 text-slate-800">{item.sort_priority}</td>
                  <td className="px-3 py-2 text-slate-800">{new Date(item.updated_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToParent(item.id)}
                        className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200"
                      >
                        Subcategories
                      </button>
                      <button type="button" onClick={() => handleEdit(item)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Total: <span className="font-medium text-slate-900">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Next
          </button>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      <EntityFormModal
        open={formOpen}
        mode={formMode}
        title="Category"
        fields={fields}
        initialValues={initialValues}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={handleSave}
      />

      <EntityDeleteModal
        open={deleteOpen}
        title="Category"
        itemName={selected?.name || selected?.id || ""}
        submitting={submitting}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
