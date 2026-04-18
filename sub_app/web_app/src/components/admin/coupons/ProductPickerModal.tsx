import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "../products/types";
import { listProducts } from "../products/api";
import { formatAmount } from "../../../lib/amountFormat";

type Props = {
  open: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
};

const ProductPickerModal = ({ open, selectedIds, onChange, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);

  const loadProducts = useCallback(async () => {
    if (!open) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listProducts({
        q: query,
        page,
        limit,
      });
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil produk");
    } finally {
      setLoading(false);
    }
  }, [limit, open, page, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    loadProducts();
  }, [loadProducts, open]);

  useEffect(() => {
    setPage(1);
  }, [limit, query]);

  if (!open) return null;

  const handleToggle = (product: Product) => {
    const exists = selectedIds.includes(product.id);
    const next = exists ? selectedIds.filter((value) => value !== product.id) : [...selectedIds, product.id];
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Explore Products</h3>
            <p className="text-xs text-slate-500">Cari dan pilih produk untuk dihubungkan dengan coupon.</p>
          </div>
          <button onClick={onClose} className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className="flex-1 min-w-[200px] rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            placeholder="Search by name or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
            {[5, 10, 20].map((value) => (
              <option key={value} value={value}>{value} / page</option>
            ))}
          </select>
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded border border-slate-200">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading products...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">Error: {error}</div>
          ) : products.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Tidak ada produk yang sesuai.</div>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{product.sku}</td>
                    <td className="px-3 py-2 text-slate-700">{product.name}</td>
                    <td className="px-3 py-2 text-slate-700">{formatAmount(product.price, { fractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{product.status}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{product.stock_status}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(product)}
                        className={`rounded px-2 py-1 text-xs font-medium ${selectedIds.includes(product.id) ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}
                      >
                        {selectedIds.includes(product.id) ? "Remove" : "Add"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>{total} products</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded bg-slate-100 px-3 py-1 text-xs font-medium hover:bg-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded bg-slate-100 px-3 py-1 text-xs font-medium hover:bg-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPickerModal;
