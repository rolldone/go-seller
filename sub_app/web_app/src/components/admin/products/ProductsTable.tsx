import type { Product } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

type Props = {
  products: Product[];
  businessNameByID: Record<string, string>;
  categoryNameByID: Record<string, string>;
  tagNameByID: Record<string, string>;
  activeCategoryID?: string;
  activeTagID?: string;
  onCategoryClick: (categoryID: string) => void;
  onTagClick: (tagID: string) => void;
  loading: boolean;
  error: string | null;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onTogglePublish: (product: Product) => void;
  onManageDiscounts: (product: Product) => void;
  onManageTranslations: (product: Product) => void;
};

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const shortID = (value: string) => value.slice(0, 8);
const copyID = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    notifySuccess("ID copied");
  } catch (error) {
    notifyError(error instanceof Error ? error.message : "Gagal copy ID");
  }
};

export default function ProductsTable({ products, businessNameByID, categoryNameByID, tagNameByID, activeCategoryID, activeTagID, onCategoryClick, onTagClick, loading, error, onEdit, onDelete, onTogglePublish, onManageDiscounts, onManageTranslations }: Props) {
  if (loading) {
    return <div className="text-sm text-slate-500">Loading products...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  if (products.length === 0) {
    return <div className="text-sm text-slate-500">Belum ada product.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Business</th>
            <th className="px-3 py-2">Categories</th>
            <th className="px-3 py-2">Tags</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Negotiable</th>
            <th className="px-3 py-2">Visible</th>
            <th className="px-3 py-2">Tax</th>
            <th className="px-3 py-2">Override</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{shortID(item.id)}</span>
                  <button
                    type="button"
                    onClick={() => copyID(item.id)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </td>
              <td className="px-3 py-2 font-medium text-slate-900">{item.sku}</td>
              <td className="px-3 py-2 text-slate-800">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">/{item.slug}</div>
              </td>
              <td className="px-3 py-2 text-slate-800">
                {money.format(item.price)}
                {typeof item.sale_price === "number" ? (
                  <span className="ml-1 text-xs text-emerald-600">sale {money.format(item.sale_price)}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-slate-700">
                <span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-800 capitalize">{item.product_type || 'product'}</span>
              </td>
              <td className="px-3 py-2 text-slate-700">
                {item.business_id ? (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{businessNameByID[item.business_id] || item.business_id}</span>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {item.category_ids && item.category_ids.length > 0 ? (
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {item.category_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onCategoryClick(id)}
                        className={`rounded px-2 py-0.5 text-xs ${
                          id === activeCategoryID
                            ? "bg-slate-300 font-medium text-slate-900 ring-2 ring-slate-400"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {categoryNameByID[id] || id}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {item.tag_ids && item.tag_ids.length > 0 ? (
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {item.tag_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onTagClick(id)}
                        className={`rounded px-2 py-0.5 text-xs ${
                          id === activeTagID
                            ? "bg-emerald-300 font-medium text-emerald-900 ring-2 ring-emerald-500"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        }`}
                      >
                        {tagNameByID[id] || id}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{item.status}</span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.is_negotiate ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.is_negotiate ? "Start from" : "Fixed"}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-700">{item.is_visible ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-slate-700">
                {item.custom_tax ? (
                  <span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-800">
                    {(item.tax_type === "include" ? "Inc" : "Ex") + " " + (typeof item.tax_rate === "number" ? `${item.tax_rate}%` : "-")}
                  </span>
                ) : (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Global</span>
                )}
              </td>

              <td className="px-3 py-2 text-slate-700">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.price_override_enabled ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {item.price_override_enabled ? "Yes" : "No"}
                </span>
              </td>

              <td className="px-3 py-2 text-slate-700">{new Date(item.updated_at).toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePublish(item)}
                    className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
                  >
                    {item.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => onManageDiscounts(item)}
                    className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                  >
                    Discounts
                  </button>
                  <button
                    type="button"
                    onClick={() => onManageTranslations(item)}
                    className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-200"
                  >
                    Translation
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
