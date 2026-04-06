import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import AdminModal from "../ui/AdminModal";

type Product = {
  id: string;
  name: string;
  sku: string;
};

type ProductAsset = {
  id: string;
  product_id: string;
  file_path?: string;
  public_url?: string;
  usage_tag?: string;
  is_main?: boolean;
  display_order?: number;
};

const productLabel = (product: Product) => `${product.name} (${product.sku})`;

const usageTagLabel = (usageTag?: string) => {
  const value = (usageTag || "").trim();
  return value === "" ? "Tanpa tag" : value;
};

const assetDisplayLabel = (asset: ProductAsset) => asset.file_path || asset.id;

type Attribute = {
  id: string;
  attribute_group_id: string;
  name: string;
  slug: string;
};

type AttributeGroup = {
  id: string;
  name: string;
  attributes?: Attribute[];
};

type Variation = {
  id: string;
  product_id: string;
  sku: string;
  price: number;
  compare_price?: number | null;
  weight?: number | null;
  dimensions_length?: number | null;
  dimensions_width?: number | null;
  dimensions_height?: number | null;
  is_default: boolean;
  is_active: boolean;
  attributes?: Attribute[];
  assets?: ProductAsset[];
  updated_at: string;
};

type VariationFormState = {
  product_id: string;
  sku: string;
  price: string;
  compare_price: string;
  weight: string;
  dimensions_length: string;
  dimensions_width: string;
  dimensions_height: string;
  is_default: boolean;
  is_active: boolean;
  attribute_ids: string[];
};

const emptyForm = (): VariationFormState => ({
  product_id: "",
  sku: "",
  price: "",
  compare_price: "",
  weight: "",
  dimensions_length: "",
  dimensions_width: "",
  dimensions_height: "",
  is_default: false,
  is_active: true,
  attribute_ids: [],
});

export default function VariationsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);

  const [selectedProductID, setSelectedProductID] = useState<string>("");
  const [productPickerOpen, setProductPickerOpen] = useState<boolean>(false);
  const [productPickerTarget, setProductPickerTarget] = useState<"main" | "form">("main");
  const [productPickerQuery, setProductPickerQuery] = useState<string>("");
  const [productPickerItems, setProductPickerItems] = useState<Product[]>([]);
  const [productPickerTotal, setProductPickerTotal] = useState<number>(0);
  const [productPickerLoading, setProductPickerLoading] = useState<boolean>(false);
  const [productPickerError, setProductPickerError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Variation | null>(null);
  const [form, setForm] = useState<VariationFormState>(emptyForm());

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetModalVariation, setAssetModalVariation] = useState<Variation | null>(null);
  const [assetItems, setAssetItems] = useState<ProductAsset[]>([]);
  const [assetDraftIDs, setAssetDraftIDs] = useState<string[]>([]);
  const [assetSelectedIDs, setAssetSelectedIDs] = useState<string[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetView, setAssetView] = useState<"selected" | "available">("selected");


  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const attributeMap = useMemo(() => {
    const map = new Map<string, Attribute & { group_name: string }>();
    groups.forEach((group) => {
      (group.attributes || []).forEach((attribute) => {
        map.set(attribute.id, { ...attribute, group_name: group.name });
      });
    });
    return map;
  }, [groups]);

  const loadProducts = async () => {
    const res = await adminGet<{ data: Product[] }>("/admin/catalog/products?page=1&limit=200");
    const items = res.data || [];
    setProducts(items);
    if (items.length > 0) {
      setSelectedProductID((prev) => prev || items[0].id);
    }
  };

  const loadGroups = async () => {
    const data = await adminGet<AttributeGroup[]>("/admin/catalog/attribute-groups?include_inactive=true");
    setGroups(data || []);
  };

  const loadVariations = async (productID: string) => {
    if (!productID) {
      setVariations([]);
      return;
    }
    const data = await adminGet<Variation[]>(`/admin/catalog/variations?product_id=${encodeURIComponent(productID)}`);
    setVariations(data || []);
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadProducts(), loadGroups()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProductID) return;
    loadVariations(selectedProductID).catch((err) => {
      const message = err instanceof Error ? err.message : "Failed to load variations";
      setError(message);
    });
  }, [selectedProductID]);

  useEffect(() => {
    if (!productPickerOpen) return;

    const timer = window.setTimeout(async () => {
      setProductPickerLoading(true);
      setProductPickerError(null);
      try {
        const query = new URLSearchParams();
        query.set("page", "1");
        query.set("limit", "30");
        if (productPickerQuery.trim()) {
          query.set("q", productPickerQuery.trim());
        }
        const res = await adminGet<{ data: Product[]; total: number }>(`/admin/catalog/products?${query.toString()}`);
        const items = res.data || [];
        setProductPickerItems(items);
        setProductPickerTotal(res.total || items.length);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to search products";
        setProductPickerError(message);
        setProductPickerItems([]);
        setProductPickerTotal(0);
      } finally {
        setProductPickerLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [productPickerOpen, productPickerQuery]);

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setForm({ ...emptyForm(), product_id: selectedProductID, is_active: true });
    setFormOpen(true);
  };

  const openEdit = (item: Variation) => {
    setFormMode("edit");
    setSelected(item);
    setForm({
      product_id: item.product_id,
      sku: item.sku || "",
      price: String(item.price ?? ""),
      compare_price: item.compare_price != null ? String(item.compare_price) : "",
      weight: item.weight != null ? String(item.weight) : "",
      dimensions_length: item.dimensions_length != null ? String(item.dimensions_length) : "",
      dimensions_width: item.dimensions_width != null ? String(item.dimensions_width) : "",
      dimensions_height: item.dimensions_height != null ? String(item.dimensions_height) : "",
      is_default: Boolean(item.is_default),
      is_active: Boolean(item.is_active),
      attribute_ids: (item.attributes || []).map((attribute) => attribute.id),
    });
    setFormOpen(true);
  };

  const upsertProducts = (newItems: Product[]) => {
    if (newItems.length === 0) return;
    setProducts((prev) => {
      const map = new Map<string, Product>();
      prev.forEach((item) => map.set(item.id, item));
      newItems.forEach((item) => map.set(item.id, item));
      return Array.from(map.values());
    });
  };

  const openProductPicker = (target: "main" | "form") => {
    setProductPickerTarget(target);
    setProductPickerQuery("");
    setProductPickerOpen(true);
  };

  const selectProductFromPicker = (product: Product) => {
    upsertProducts([product]);
    if (productPickerTarget === "main") {
      setSelectedProductID(product.id);
    } else {
      setForm((prev) => ({ ...prev, product_id: product.id }));
    }
    setProductPickerOpen(false);
  };

  const toggleAttribute = (attributeID: string) => {
    setForm((prev) => {
      const exists = prev.attribute_ids.includes(attributeID);
      return {
        ...prev,
        attribute_ids: exists
          ? prev.attribute_ids.filter((id) => id !== attributeID)
          : [...prev.attribute_ids, attributeID],
      };
    });
  };

  const handleSave = async () => {
    if (!form.product_id || !form.sku.trim() || !form.price.trim()) {
      notifyError("product, sku, dan price wajib diisi");
      return;
    }

    const payload = {
      product_id: form.product_id,
      sku: form.sku.trim(),
      price: Number(form.price),
      compare_price: form.compare_price.trim() ? Number(form.compare_price) : null,
      weight: form.weight.trim() ? Number(form.weight) : null,
      dimensions_length: form.dimensions_length.trim() ? Number(form.dimensions_length) : null,
      dimensions_width: form.dimensions_width.trim() ? Number(form.dimensions_width) : null,
      dimensions_height: form.dimensions_height.trim() ? Number(form.dimensions_height) : null,
      is_default: form.is_default,
      is_active: form.is_active,
      attribute_ids: form.attribute_ids,
    };

    setSubmitting(true);
    try {
      if (formMode === "create") {
        await adminPost<Variation>("/admin/catalog/variations", payload);
        notifySuccess("Variation created");
      } else if (selected) {
        await adminPut<Variation>(`/admin/catalog/variations/${selected.id}`, payload);
        notifySuccess("Variation updated");
      }

      setFormOpen(false);
      setSelected(null);
      await loadVariations(selectedProductID);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save variation";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (item: Variation) => {
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selected) return;

    setSubmitting(true);
    try {
      await adminDelete(`/admin/catalog/variations/${selected.id}`);
      notifySuccess("Variation deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadVariations(selectedProductID);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete variation";
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAssetModal = async (item: Variation) => {
    setAssetModalVariation(item);
    setAssetModalOpen(true);
    setAssetSelectedIDs((item.assets || []).map((asset) => asset.id));
    setAssetView("selected");
    setAssetItems([]);
    setAssetLoading(true);

    try {
      const res = await adminGet<{ data: ProductAsset[] }>(
        `/admin/catalog/assets?product_id=${encodeURIComponent(item.product_id)}&page=1&limit=200`,
      );
      setAssetItems(res.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load product assets";
      notifyError(message);
    } finally {
      setAssetLoading(false);
    }
  };

  // When switching to available view, initialize draft from currently selected assets
  // (intentionally no auto-init of draft from selected)
  useEffect(() => { setAssetDraftIDs([]); }, [assetView]);

  const toggleAsset = (assetID: string) => {
    setAssetDraftIDs((prev) => {
      const exists = prev.includes(assetID);
      return exists ? prev.filter((id) => id !== assetID) : [...prev, assetID];
    });
  };

  const addSelectedAssets = () => {
    if (assetDraftIDs.length === 0) return;

    setAssetSelectedIDs((prev) => {
      const next = [...prev];
      assetDraftIDs.forEach((assetID) => {
        if (!next.includes(assetID)) {
          next.push(assetID);
        }
      });
      return next;
    });

    setAssetDraftIDs([]);
    setAssetView("selected");
  };

  const removeSelectedAsset = (assetID: string) => {
    setAssetSelectedIDs((prev) => prev.filter((id) => id !== assetID));
  };

  const moveSelectedAsset = (assetID: string, direction: -1 | 1) => {
    setAssetSelectedIDs((prev) => {
      const index = prev.indexOf(assetID);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const groupedAssetItems = useMemo(() => {
    const groupMap = new Map<string, ProductAsset[]>();

    assetItems.forEach((asset) => {
      const key = usageTagLabel(asset.usage_tag);
      const items = groupMap.get(key) || [];
      items.push(asset);
      groupMap.set(key, items);
    });

    return Array.from(groupMap.entries())
      .sort(([left], [right]) => left.localeCompare(right, "id"))
      .map(([label, items]) => ({ label, items }));
  }, [assetItems]);

  const selectedAssetMap = useMemo(() => {
    const map = new Map<string, ProductAsset>();
    assetItems.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assetItems]);

  const saveVariationAssets = async () => {
    if (!assetModalVariation) return;
    setAssetSaving(true);
    try {
      await adminPut<Variation>(`/admin/catalog/variations/${assetModalVariation.id}/assets`, {
        asset_ids: assetSelectedIDs,
      });
      notifySuccess("Variation assets updated");
      setAssetModalOpen(false);
      setAssetModalVariation(null);
      await loadVariations(selectedProductID);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update variation assets";
      notifyError(message);
    } finally {
      setAssetSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Variations</h3>
          <p className="text-sm text-slate-600">Kelola variasi per produk dengan kombinasi atribut.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!selectedProductID}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          + New Variation
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <p className="mb-1 block text-sm text-slate-700">Product</p>
            <div className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800">
              {productMap.get(selectedProductID) ? productLabel(productMap.get(selectedProductID) as Product) : "Belum dipilih"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openProductPicker("main")}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Search & Select Product
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">Error: {error}</div> : null}

      {!error && variations.length === 0 ? <div className="text-sm text-slate-500">Belum ada variation pada produk ini.</div> : null}

      {!error && variations.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Attributes</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variations.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-700">{productMap.get(item.product_id)?.name || item.product_id}</td>
                  <td className="px-3 py-2 text-slate-700">{Number(item.price || 0).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div className="flex flex-wrap gap-1">
                      {(item.attributes || []).map((attribute) => {
                        const mapped = attributeMap.get(attribute.id);
                        return (
                          <span key={attribute.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                            {mapped ? `${mapped.group_name}: ${mapped.name}` : attribute.name}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{new Date(item.updated_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssetModal(item)}
                        className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200"
                      >
                        Assets
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(item)}
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

      <AdminModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        title={formMode === "create" ? "Create Variation" : "Edit Variation"}
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setSelected(null);
              }}
              className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            >
              {submitting ? "Saving..." : formMode === "create" ? "Create" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-700">Product</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[260px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-800">
                {productMap.get(form.product_id) ? productLabel(productMap.get(form.product_id) as Product) : "Belum dipilih"}
              </div>
              <button
                type="button"
                onClick={() => openProductPicker("form")}
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Search & Select Product
              </button>
            </div>
          </div>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">SKU</span>
            <input
              type="text"
              value={form.sku}
              onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Price</span>
            <input
              type="number"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Compare Price</span>
            <input
              type="number"
              value={form.compare_price}
              onChange={(event) => setForm((prev) => ({ ...prev, compare_price: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Weight</span>
            <input
              type="number"
              value={form.weight}
              onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Length</span>
            <input
              type="number"
              value={form.dimensions_length}
              onChange={(event) => setForm((prev) => ({ ...prev, dimensions_length: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Width</span>
            <input
              type="number"
              value={form.dimensions_width}
              onChange={(event) => setForm((prev) => ({ ...prev, dimensions_width: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Height</span>
            <input
              type="number"
              value={form.dimensions_height}
              onChange={(event) => setForm((prev) => ({ ...prev, dimensions_height: event.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(event) => setForm((prev) => ({ ...prev, is_default: event.target.checked }))}
            />
            Is Default
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Is Active
          </label>

          <div className="sm:col-span-2 space-y-3">
            <p className="text-sm font-medium text-slate-800">Attributes</p>
            {groups.length === 0 ? <p className="text-xs text-slate-500">Belum ada attribute group.</p> : null}
            {groups.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">{group.name}</p>
                <div className="flex flex-wrap gap-2">
                  {(group.attributes || []).map((attribute) => {
                    const checked = form.attribute_ids.includes(attribute.id);
                    return (
                      <label key={attribute.id} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                        <input type="checkbox" checked={checked} onChange={() => toggleAttribute(attribute.id)} />
                        {attribute.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="Select Product"
        maxWidth="xl"
      >
        <div className="space-y-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Search Product</span>
            <input
              type="text"
              value={productPickerQuery}
              onChange={(event) => setProductPickerQuery(event.target.value)}
              placeholder="Cari berdasarkan nama atau SKU..."
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          {productPickerLoading ? <div className="text-sm text-slate-500">Searching...</div> : null}
          {productPickerError ? <div className="text-sm text-red-600">Error: {productPickerError}</div> : null}

          {!productPickerLoading && !productPickerError ? (
            <>
              <div className="text-xs text-slate-500">Total result: {productPickerTotal}</div>
              <div className="max-h-72 overflow-auto rounded border border-slate-200 bg-white">
                {productPickerItems.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Product tidak ditemukan.</div>
                ) : (
                  productPickerItems.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProductFromPicker(product)}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </AdminModal>

      <AdminModal
        open={assetModalOpen}
        onClose={() => {
          setAssetModalOpen(false);
          setAssetModalVariation(null);
          setAssetView("selected");
        }}
        title={`Variation Assets${assetModalVariation ? ` - ${assetModalVariation.sku}` : ""}`}
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setAssetModalOpen(false);
                setAssetModalVariation(null);
                setAssetView("selected");
              }}
              className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveVariationAssets}
              disabled={assetSaving}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            >
              {assetSaving ? "Saving..." : "Save Assets"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Pilih asset produk dari grup <span className="font-medium">use</span>. Daftar selected selalu tampil, lalu buka daftar available asset untuk menambah item baru.
          </p>

          {assetLoading ? <div className="text-sm text-slate-500">Loading assets...</div> : null}

          {!assetLoading && assetItems.length === 0 ? (
            <div className="text-sm text-slate-500">Belum ada asset pada produk ini.</div>
          ) : null}

          {!assetLoading ? (
            <div className="space-y-4">
              {assetView === "selected" ? (
                <div className="rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">Selected assets</p>
                    <span className="text-xs text-slate-500">Urutan disimpan sesuai list ini</span>
                  </div>

                  {assetSelectedIDs.length === 0 ? (
                    <div className="mt-3 rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                      Belum ada asset yang dipilih.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {assetSelectedIDs.map((assetID, index) => {
                        const asset = selectedAssetMap.get(assetID);
                        if (!asset) return null;

                        return (
                          <div
                            key={assetID}
                            className="flex items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                              {index + 1}
                            </div>
                            {asset.public_url ? (
                              <img src={asset.public_url} alt="asset" className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-slate-100" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-slate-800">{assetDisplayLabel(asset)}</p>
                              <p className="text-xs text-slate-500">
                                {usageTagLabel(asset.usage_tag)} {asset.is_main ? "• main" : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveSelectedAsset(assetID, -1)}
                                disabled={index === 0}
                                className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSelectedAsset(assetID, 1)}
                                disabled={index === assetSelectedIDs.length - 1}
                                className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 disabled:opacity-40"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSelectedAsset(assetID)}
                                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setAssetView("available")}
                      className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Add available asset
                    </button>
                  </div>
                </div>
              ) : null}

              {assetView === "available" ? (
                <div className="rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Available assets</p>
                      <p className="text-xs text-slate-500">Pilih item dari grup use, lalu klik Add selected.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAssetView("selected")}
                        className="rounded bg-slate-100 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-200"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={addSelectedAssets}
                        disabled={assetDraftIDs.length === 0}
                        className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        Add selected
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 max-h-[24rem] space-y-3 overflow-auto pr-1">
                    {groupedAssetItems.map((group) => (
                      <div key={group.label} className="rounded border border-slate-200 bg-slate-50/60 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{group.label}</p>
                          <span className="text-xs text-slate-500">{group.items.length} item</span>
                        </div>
                        <div className="space-y-2">
                          {group.items.map((asset) => {
                            const checked = assetDraftIDs.includes(asset.id);
                            const alreadySelected = assetSelectedIDs.includes(asset.id);
                            const labelClass = `flex ${alreadySelected ? "" : "cursor-pointer"} items-center gap-3 rounded border px-3 py-2 text-sm transition ${
                              checked ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
                            }`;
                            return (
                              <label key={asset.id} className={labelClass}>
                                {/* Hide checkbox if asset already selected; keep spacing */}
                                {alreadySelected ? (
                                  <div className="w-4" />
                                ) : (
                                  <input type="checkbox" checked={checked} onChange={() => toggleAsset(asset.id)} />
                                )}
                                {asset.public_url ? (
                                  <img src={asset.public_url} alt="asset" className="h-10 w-10 rounded object-cover" />
                                ) : (
                                  <div className="h-10 w-10 rounded bg-slate-100" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-slate-800">{assetDisplayLabel(asset)}</p>
                                  <p className="text-xs text-slate-500">
                                    {usageTagLabel(asset.usage_tag)} {asset.is_main ? "• main" : ""}
                                  </p>
                                  {alreadySelected ? (
                                    <div className="mt-1">
                                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Selected</span>
                                    </div>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </AdminModal>

      <AdminModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        title="Delete Variation"
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setSelected(null);
              }}
              className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Hapus variation <span className="font-medium text-slate-900">{selected?.sku}</span>?
        </p>
      </AdminModal>
    </div>
  );
}
