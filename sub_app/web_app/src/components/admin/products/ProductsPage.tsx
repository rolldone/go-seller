import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import {
  createProduct,
  deleteProduct,
  listProducts,
  publishProduct,
  unpublishProduct,
  updateProduct,
} from "./api";
import ProductDeleteModal from "./ProductDeleteModal";
import ProductFormModal from "./ProductFormModal";
import ProductsTable from "./ProductsTable";
import ProductDiscountsModal from "./ProductDiscountsModal";
import ProductTranslationsModal from "./ProductTranslationsModal";
import type { Product, ProductPayload } from "./types";
import { adminGet } from "../entities/adminApi";

type CategoryOption = {
  id: string;
  name: string;
};

type TagOption = {
  id: string;
  name: string;
};

type BusinessOption = {
  id: string;
  name: string;
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [businessNameByID, setBusinessNameByID] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryNameByID, setCategoryNameByID] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<TagOption[]>([]);
  const [tagNameByID, setTagNameByID] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [businessID, setBusinessID] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [tagID, setTagID] = useState("");
  const [productType, setProductType] = useState("");
  const [visible, setVisible] = useState<"" | "true" | "false">("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [discountsOpen, setDiscountsOpen] = useState(false);
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [translationProduct, setTranslationProduct] = useState<Product | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProducts({
        q,
        status,
        stock_status: stockStatus,
        business_id: businessID,
        category_id: categoryID,
        tag_id: tagID,
        product_type: productType,
        is_visible: visible,
        page,
        limit,
      });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch products";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize category/tag filter from URL query on first load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bid = params.get("business_id") || "";
    const cid = params.get("category_id") || "";
    const tid = params.get("tag_id") || "";
    const pt = params.get("product_type") || "";
    if (bid) setBusinessID(bid);
    if (cid) setCategoryID(cid);
    if (tid) setTagID(tid);
    if (pt) setProductType(pt);
  }, []);

  // Keep category/tag query string so filter persists on refresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (businessID) {
      params.set("business_id", businessID);
    } else {
      params.delete("business_id");
    }
    if (categoryID) {
      params.set("category_id", categoryID);
    } else {
      params.delete("category_id");
    }
    if (tagID) {
      params.set("tag_id", tagID);
    } else {
      params.delete("tag_id");
    }
    if (productType) {
      params.set("product_type", productType);
    } else {
      params.delete("product_type");
    }
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [businessID, categoryID, tagID, productType]);

  useEffect(() => {
    loadData();
  }, [page, limit, q, status, stockStatus, businessID, categoryID, tagID, productType, visible]);

  useEffect(() => {
    setSelectedIds([]);
  }, [businessID, categoryID, tagID, productType, q, status, stockStatus, visible, limit]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  };

  const toggleCurrentPageSelection = () => {
    const currentPageIds = items.map((it) => it.id);
    setSelectedIds((current) => {
      if (currentPageIds.length > 0 && currentPageIds.every((id) => current.includes(id))) {
        return current.filter((id) => !currentPageIds.includes(id));
      }
      const next = new Set(current);
      for (const id of currentPageIds) next.add(id);
      return Array.from(next);
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await adminGet<{ data: BusinessOption[] }>("/admin/catalog/businesses?page=1&limit=500");
        const map: Record<string, string> = {};
        for (const business of res.data || []) {
          map[business.id] = business.name;
        }
        setBusinesses(res.data || []);
        setBusinessNameByID(map);
      } catch {
        setBusinesses([]);
        setBusinessNameByID({});
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminGet<{ data: CategoryOption[] }>("/admin/catalog/categories?page=1&limit=500");
        const map: Record<string, string> = {};
        for (const c of res.data || []) {
          map[c.id] = c.name;
        }
        setCategories(res.data || []);
        setCategoryNameByID(map);
      } catch {
        setCategories([]);
        setCategoryNameByID({});
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminGet<{ data: TagOption[] }>("/admin/catalog/tags?page=1&limit=500");
        const map: Record<string, string> = {};
        for (const t of res.data || []) {
          map[t.id] = t.name;
        }
        setTags(res.data || []);
        setTagNameByID(map);
      } catch {
        setTags([]);
        setTagNameByID({});
      }
    })();
  }, []);

  const handleCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const handleEdit = (item: Product) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  const handleSubmit = async (payload: ProductPayload, productID?: string): Promise<Product> => {
    setSubmitting(true);
    try {
      let product: Product;
      if (productID) {
        product = await updateProduct(productID, payload);
        notifySuccess("Product updated");
      } else if (formMode === "create") {
        product = await createProduct(payload);
        notifySuccess("Product created");
      } else if (selected) {
        product = await updateProduct(selected.id, payload);
        notifySuccess("Product updated");
      } else {
        throw new Error("No product selected for update");
      }
      await loadData();
      return product;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save product";
      notifyError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: Product) => {
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleManageDiscounts = (product: Product) => {
    setDiscountProduct(product);
    setDiscountsOpen(true);
  };

  const handleManageTranslations = (product: Product) => {
    setTranslationProduct(product);
    setTranslationsOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteProduct(selected.id);
      notifySuccess("Product deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete product";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (item: Product) => {
    setSubmitting(true);
    try {
      if (item.status === "published") {
        await unpublishProduct(item.id);
        notifySuccess("Product unpublished");
      } else {
        await publishProduct(item.id);
        notifySuccess("Product published");
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update publish state";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryBadgeClick = (id: string) => {
    setPage(1);
    setCategoryID(id);
  };

  const handleTagBadgeClick = (id: string) => {
    setPage(1);
    setTagID(id);
  };

  const selectedBusinessLabel = businessID ? businessNameByID[businessID] || businessID : "All businesses";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Products</h3>
          <p className="text-sm text-slate-600">Kelola data products dari API catalog admin.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Target: <span className="font-semibold text-slate-900">{selectedBusinessLabel}</span>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + New Product
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Search</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Search q"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">All status</option>
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Stock</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={stockStatus}
                onChange={(e) => {
                  setPage(1);
                  setStockStatus(e.target.value);
                }}
              >
                <option value="">All stock</option>
                <option value="instock">instock</option>
                <option value="outofstock">outofstock</option>
                <option value="backorder">backorder</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Business</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={businessID}
                onChange={(e) => {
                  setPage(1);
                  setBusinessID(e.target.value);
                }}
              >
                <option value="">All businesses</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Category</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={categoryID}
                onChange={(e) => {
                  setPage(1);
                  setCategoryID(e.target.value);
                }}
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Type</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={productType}
                onChange={(e) => {
                  setPage(1);
                  setProductType(e.target.value);
                }}
              >
                <option value="">All types</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="digital">Digital</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Tag</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={tagID}
                onChange={(e) => {
                  setPage(1);
                  setTagID(e.target.value);
                }}
              >
                <option value="">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Visibility</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={visible}
                onChange={(e) => {
                  setPage(1);
                  setVisible(e.target.value as "" | "true" | "false");
                }}
              >
                <option value="">All visibility</option>
                <option value="true">Visible</option>
                <option value="false">Hidden</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Per halaman</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              setQ("");
              setStatus("");
              setStockStatus("");
              setBusinessID("");
              setCategoryID("");
              setTagID("");
              setProductType("");
              setVisible("");
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Product list</h4>
            <p className="text-xs text-slate-500">Total {total} product untuk filter aktif saat ini.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Dipilih: {selectedIds.length}</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Clear selection
            </button>
            {loading ? <span className="text-xs text-slate-500">Loading...</span> : null}
          </div>
        </div>

        <ProductsTable
          products={items}
          businessNameByID={businessNameByID}
          categoryNameByID={categoryNameByID}
          tagNameByID={tagNameByID}
          activeCategoryID={categoryID}
          activeTagID={tagID}
          onCategoryClick={handleCategoryBadgeClick}
          onTagClick={handleTagBadgeClick}
          loading={loading}
          error={error}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTogglePublish={handleTogglePublish}
          onManageDiscounts={handleManageDiscounts}
          onManageTranslations={handleManageTranslations}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleCurrentPageSelection={toggleCurrentPageSelection}
        />
      </div>

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
        </div>
      </div>

      <ProductFormModal
        open={formOpen}
        mode={formMode}
        initialData={selected}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={handleSubmit}
      />

      <ProductDeleteModal
        open={deleteOpen}
        product={selected}
        submitting={submitting}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <ProductDiscountsModal
        open={discountsOpen}
        product={discountProduct}
        onClose={() => {
          setDiscountsOpen(false);
          setDiscountProduct(null);
        }}
      />

      <ProductTranslationsModal
        open={translationsOpen}
        product={translationProduct}
        onClose={() => {
          setTranslationsOpen(false);
          setTranslationProduct(null);
        }}
      />
    </div>
  );
}
