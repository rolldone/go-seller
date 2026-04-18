import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";

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
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
  onToggleCurrentPageSelection?: () => void;
};

const shortID = (value: string) => value.slice(0, 8);
const copyID = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    notifySuccess("ID copied");
  } catch (error) {
    notifyError(error instanceof Error ? error.message : "Gagal copy ID");
  }
};

export default function ProductsTable({ products, businessNameByID, categoryNameByID, tagNameByID, activeCategoryID, activeTagID, onCategoryClick, onTagClick, loading, error, onEdit, onDelete, onTogglePublish, onManageDiscounts, onManageTranslations, selectedIds = [], onToggleSelection, onToggleCurrentPageSelection, }: Props) {
  if (loading) {
    return <div className="mt-4 text-sm text-slate-500">Loading products...</div>;
  }

  if (error) {
    return <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>;
  }

  if (products.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        Belum ada product untuk filter ini.
      </div>
    );
  }
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  useEffect(() => {
    const onDocClick = () => setOpenMenuFor(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!openMenuFor) return;
    const update = () => {
      const btn = document.querySelector(`[data-menu-button="${openMenuFor}"]`) as HTMLElement | null;
      if (!btn) {
        setOpenMenuFor(null);
        setMenuCoords(null);
        return;
      }
      const rect = btn.getBoundingClientRect();
      const MENU_WIDTH = 160; // matches w-40
      const top = rect.bottom + window.scrollY + 8;
      const left = rect.right + window.scrollX - MENU_WIDTH;
      setMenuCoords({ top, left });
    };

    update();

    const onScroll = () => update();
    const onResize = () => update();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuFor(null);
        setMenuCoords(null);
      }
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuFor]);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2">
              <input
                type="checkbox"
                checked={products.length > 0 && products.every((p) => selectedIds.includes(p.id))}
                onChange={() => onToggleCurrentPageSelection && onToggleCurrentPageSelection()}
                aria-label="Select all current page"
              />
            </th>
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
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggleSelection && onToggleSelection(item.id)}
                  aria-label={`Select product ${item.name}`}
                />
              </td>
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
                {formatAmount(item.price, { fractionDigits: 0 })}
                {typeof item.sale_price === "number" ? (
                  <span className="ml-1 text-xs text-emerald-600">sale {formatAmount(item.sale_price, { fractionDigits: 0 })}</span>
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
                <div className="relative inline-block">
                  <button
                    data-menu-button={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const btn = e.currentTarget as HTMLElement;
                      if (openMenuFor === item.id) {
                        setOpenMenuFor(null);
                        setMenuCoords(null);
                        return;
                      }
                      const rect = btn.getBoundingClientRect();
                      const MENU_WIDTH = 160;
                      const top = rect.bottom + window.scrollY + 8;
                      const left = rect.right + window.scrollX - MENU_WIDTH;
                      setMenuCoords({ top, left });
                      setOpenMenuFor(item.id);
                    }}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    aria-haspopup="true"
                    aria-expanded={openMenuFor === item.id}
                  >
                    ⋯
                  </button>

                  {openMenuFor === item.id && menuCoords && typeof document !== "undefined"
                    ? createPortal(
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", top: menuCoords.top, left: menuCoords.left, width: 160 }}
                          className="z-50 rounded-lg border border-slate-200 bg-white shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onEdit(item);
                              setOpenMenuFor(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onTogglePublish(item);
                              setOpenMenuFor(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {item.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(item);
                              setOpenMenuFor(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onManageDiscounts(item);
                              setOpenMenuFor(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                          >
                            Discounts
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onManageTranslations(item);
                              setOpenMenuFor(null);
                              setMenuCoords(null);
                            }}
                            className="w-full text-left rounded-b px-3 py-2 text-sm text-sky-700 hover:bg-sky-50"
                          >
                            Translation
                          </button>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
