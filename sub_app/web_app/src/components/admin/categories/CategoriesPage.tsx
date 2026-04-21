import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import CategoryFormModal from "./CategoryFormModal";
import CategoryTranslationsModal from "./CategoryTranslationsModal";

type Category = {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  icon_url?: string | null;
  seo_content?: Record<string, unknown> | null;
  sort_priority: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type ParentOption = {
  value: string;
  label: string;
};

const ROOT_KEY = "__root__";

const sortCategories = (items: Category[]) =>
  [...items].sort((a, b) => {
    if (a.sort_priority !== b.sort_priority) return a.sort_priority - b.sort_priority;
    return a.name.localeCompare(b.name);
  });

const collectDescendants = (items: Category[], rootID: string) => {
  const childrenByParent = new Map<string, Category[]>();
  for (const item of items) {
    const key = item.parent_id || ROOT_KEY;
    const next = childrenByParent.get(key) || [];
    next.push(item);
    childrenByParent.set(key, next);
  }

  const excluded = new Set<string>([rootID]);
  const stack = [rootID];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const child of childrenByParent.get(current) || []) {
      if (excluded.has(child.id)) continue;
      excluded.add(child.id);
      stack.push(child.id);
    }
  }

  return excluded;
};

const buildParentOptions = (items: Category[], excludeIDs: Set<string>) => {
  const childrenByParent = new Map<string, Category[]>();
  for (const item of items) {
    if (excludeIDs.has(item.id)) continue;
    const key = item.parent_id || ROOT_KEY;
    const next = childrenByParent.get(key) || [];
    next.push(item);
    childrenByParent.set(key, next);
  }

  for (const [key, list] of childrenByParent.entries()) {
    childrenByParent.set(key, sortCategories(list));
  }

  const options: ParentOption[] = [{ value: "", label: "Root category" }];
  const visit = (parentKey: string, trail: string[]) => {
    for (const item of childrenByParent.get(parentKey) || []) {
      const label = trail.length > 0 ? `${trail.join(" / ")} / ${item.name}` : item.name;
      options.push({ value: item.id, label });
      visit(item.id, [...trail, item.name]);
    }
  };

  visit(ROOT_KEY, []);
  return options;
};

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [parentID, setParentID] = useState<string>("");
  const [breadcrumbs, setBreadcrumbs] = useState<Category[]>([]);
  const [withDeleted, setWithDeleted] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [translationCategory, setTranslationCategory] = useState<Category | null>(null);

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
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("parent_id", parentID);
      if (withDeleted) {
        params.set("with_deleted", "true");
      }
      const res = await adminGet<{ data: Category[]; total: number }>(`/admin/catalog/categories?${params.toString()}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch categories";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadParentOptions = async () => {
    setParentOptionsLoading(true);
    try {
      const collected: Category[] = [];
      let currentPage = 1;
      let totalCount = Number.POSITIVE_INFINITY;

      while (collected.length < totalCount && currentPage <= 50) {
        const res = await adminGet<{ data: Category[]; total: number }>(`/admin/catalog/categories?page=${currentPage}&limit=100`);
        const batch = res.data || [];
        collected.push(...batch);
        totalCount = res.total || 0;
        if (batch.length === 0) break;
        currentPage += 1;
      }

      setAllCategories(collected);
    } catch (err) {
      console.error("Failed to load category parents", err);
      setAllCategories([]);
    } finally {
      setParentOptionsLoading(false);
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
  }, [page, limit, parentID, withDeleted]);

  useEffect(() => {
    loadBreadcrumbs();
  }, [parentID]);

  useEffect(() => {
    loadParentOptions();
  }, []);

  const initialValues = useMemo(
    () => ({
      name: selected?.name || "",
      slug: selected?.slug || "",
      parent_id: selected?.parent_id || parentID || "",
      icon_url: selected?.icon_url || "",
      seo_content: selected?.seo_content || null,
      sort_priority: selected?.sort_priority ?? 0,
    }),
    [selected, parentID],
  );

  const parentOptions = useMemo(() => {
    const activeCategories = allCategories.filter((item) => !item.deleted_at);
    const excludedIDs = selected ? collectDescendants(activeCategories, selected.id) : new Set<string>();
    return buildParentOptions(activeCategories, excludedIDs);
  }, [allCategories, selected]);

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

  const handleTranslations = (item: Category) => {
    setTranslationCategory(item);
    setTranslationOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const parentValue = String(values.parent_id || "").trim();
      const payload = {
        name: String(values.name || "").trim(),
        slug: String(values.slug || "").trim(),
        parent_id: parentValue || undefined,
        icon_url: String(values.icon_url || "").trim() || undefined,
        seo_content: values.seo_content || undefined,
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
      await loadParentOptions();
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

  const handleRestore = async (item: Category) => {
    setBusyCategoryId(item.id);
    try {
      await adminPost(`/admin/catalog/categories/${item.id}/restore`);
      notifySuccess("Category restored");
      await loadParentOptions();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore category";
      notifyError(message);
    } finally {
      setBusyCategoryId(null);
    }
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
  const showingDeleted = withDeleted;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Categories</h3>
          <p className="text-sm text-slate-600">Kelola kategori produk per level parent (gaya PrestaShop).</p>
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={withDeleted}
              onChange={(e) => {
                setPage(1);
                setWithDeleted(e.target.checked);
              }}
            />
            Show deleted categories
          </label>
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
        {showingDeleted ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Including deleted</span> : null}
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
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`border-t border-slate-100 ${item.deleted_at ? "bg-slate-50 text-slate-500" : ""}`}>
                  <td className="px-3 py-2 text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-800">{item.slug || "-"}</td>
                  <td className="px-3 py-2">
                    {item.deleted_at ? (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">Deleted</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{item.sort_priority}</td>
                  <td className="px-3 py-2 text-slate-800">{new Date(item.updated_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToParent(item.id)}
                        className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                        disabled={Boolean(item.deleted_at)}
                      >
                        Subcategories
                      </button>
                      {!item.deleted_at ? (
                        <>
                          <button type="button" onClick={() => handleEdit(item)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                            Edit / Move
                          </button>
                          <button type="button" onClick={() => handleTranslations(item)} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200">
                            Translations
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          disabled={busyCategoryId === item.id}
                          className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                        >
                          {busyCategoryId === item.id ? "Restoring..." : "Restore"}
                        </button>
                      )}
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

      <CategoryFormModal
        open={formOpen}
        mode={formMode}
        initialValues={initialValues}
        item={selected}
        parentOptions={parentOptions}
        parentOptionsLoading={parentOptionsLoading}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={handleSave}
      />

      <CategoryTranslationsModal
        open={translationOpen}
        category={translationCategory}
        onClose={() => {
          setTranslationOpen(false);
          setTranslationCategory(null);
        }}
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
