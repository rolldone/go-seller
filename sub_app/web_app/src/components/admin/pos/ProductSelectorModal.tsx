import { useEffect, useMemo, useState } from "react";

import AdminModal from "../ui/AdminModal";
import { listProducts } from "../products/api";
import type { Product } from "../products/types";
import { formatAmount } from "../../../lib/amountFormat";

type Props = {
  open: boolean;
  businessID?: string;
  businessNameByID: Record<string, string>;
  currentProductID?: string;
  onClose: () => void;
  onSelect: (product: Product) => void;
};

export default function ProductSelectorModal({ open, businessID, businessNameByID, currentProductID, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [businessFilter, setBusinessFilter] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setBusinessFilter(businessID || "");
  }, [open, businessID]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listProducts({
          q: query || undefined,
          status: "published",
          business_id: businessFilter || undefined,
          page,
          limit,
        });
        setItems(res.data || []);
        setTotal(res.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengambil produk");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [open, query, businessFilter, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [query, businessFilter, limit]);

  return (
    <AdminModal open={open} onClose={onClose} title="Select Product" maxWidth="xl">
      <div className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[2fr,1fr,160px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product ID, name, or SKU"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={businessFilter}
            onChange={(e) => setBusinessFilter(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All businesses</option>
            {Object.entries(businessNameByID).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading products...</div>
          ) : error ? (
            <div className="p-4 text-sm text-rose-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Tidak ada product ditemukan.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">ID</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">SKU</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Product</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Business</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Price</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => {
                  const selected = currentProductID === item.id;
                  return (
                    <tr key={item.id} className={selected ? "bg-slate-50" : undefined}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.id}</td>
                      <td className="px-3 py-2 text-slate-700">{item.sku || "-"}</td>
                      <td className="px-3 py-2 text-slate-800">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">/{item.slug}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{item.business_id ? businessNameByID[item.business_id] || item.business_id : "-"}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{formatAmount(item.sale_price ?? item.price, { fractionDigits: 0 })}</td>
                      <td className="px-3 py-2 text-slate-700">{item.status}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onSelect(item)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          {selected ? "Selected" : "Choose"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} products</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
