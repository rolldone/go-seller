import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { Discount } from "./types";
import { listDiscounts } from "./api";

type Props = {
  open: boolean;
  productID?: string | null;
  onClose: () => void;
  onSelect: (discount: Discount) => void;
  pageSize?: number;
};

export default function DiscountSelector({ open, productID, onClose, onSelect, pageSize = 100 }: Props) {
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAvailableDiscounts([]);
    setError(null);
    if (!productID) {
      setError("Product ID is required");
      return;
    }
    setLoading(true);
    listDiscounts({ product_id: productID, is_active: "true", page: 1, limit: pageSize })
      .then((res) => setAvailableDiscounts(res.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat discount"))
      .finally(() => setLoading(false));
  }, [open, productID, pageSize]);

  return (
    <AdminModal open={open} onClose={onClose} title="Select Discount" maxWidth="lg">
      <div className="space-y-3">
        {productID ? <div className="text-xs text-slate-500">Product: {productID}</div> : null}
        {loading ? (
          <div className="text-sm text-slate-500">Loading discounts...</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error}</div>
        ) : availableDiscounts.length === 0 ? (
          <div className="text-sm text-slate-500">Tidak ada discount aktif untuk produk ini.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Type</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Priority</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Value</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {availableDiscounts.map((discount) => (
                  <tr key={discount.id}>
                    <td className="px-3 py-2 text-slate-800">{discount.name}</td>
                    <td className="px-3 py-2 text-slate-700 capitalize">{discount.discount_type}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{discount.priority}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {discount.discount_type === "percentage" ? `${discount.discount_value}%` : discount.discount_value.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect(discount)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminModal>
  );
}
