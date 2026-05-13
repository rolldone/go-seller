import type { Order } from "./types";
import { formatAmount } from "../../../lib/amountFormat";

type Props = {
  items: Order[];
  loading: boolean;
  error: string | null;
  onView: (item: Order) => void;
};

const fmt = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
};

const money = (currency: string, amount: number) => {
  const c = currency || "USD";
  try {
    return `${c} ${formatAmount(amount || 0, { fractionDigits: 2 })}`;
  } catch {
    return `${c} ${formatAmount(amount || 0, { fractionDigits: 2 })}`;
  }
};

const normalizeOrderStatus = (status?: string | null) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "confirmed" ? "processing" : normalized;
};

const badgeClass = (status: string) => {
  const s = normalizeOrderStatus(status);
  if (s === "completed" || s === "delivered") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "paid") return "bg-teal-50 text-teal-700 border-teal-200";
  if (s === "processing") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "shipped" || s === "in_transit" || s === "partially_shipped") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (s === "ready_to_ship") return "bg-sky-50 text-sky-700 border-sky-200";
  if (s === "waiting_customer_confirmation") return "bg-sky-50 text-sky-700 border-sky-200";
  if (s === "in_dispute" || s === "exception") return "bg-rose-50 text-rose-700 border-rose-200";
  if (s === "refunded" || s === "returned") return "bg-purple-50 text-purple-700 border-purple-200";
  if (s === "pending" || s === "unpaid" || s === "not_applicable") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "expired") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

const badgeLabel = (status?: string | null) => normalizeOrderStatus(status) || "-";

export default function OrdersTable({ items, loading, error, onView }: Props) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading orders...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  }

  if (items.length === 0) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No orders found.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Business</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Payment</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Delivery</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Channel</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Grand Total</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Created</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.order_number}</p>
                </div>
                <p className="text-xs text-slate-500">{item.id}</p>
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">{item.business_id || "-"}</td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {item.customer ? (
                  <div>
                    <div className="font-medium">{item.customer.name || item.customer.id}</div>
                    {item.customer.email ? <div className="text-xs text-slate-500">{item.customer.email}</div> : null}
                  </div>
                ) : (
                  (item.user_id || item.customer_id) || "-"
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.status)}`}>{badgeLabel(item.status)}</span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.payment_status)}`}>{badgeLabel(item.payment_status)}</span>
              </td>
              <td className="px-4 py-3 text-sm">
                {item.fulfillment_type?.toLowerCase() === "delivery" ? (
                  <a
                    href={`/admin/orders/${item.id}/delivery`}
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 ${badgeClass(item.delivery_status || "pending")}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {badgeLabel(item.delivery_status || "pending")}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">{item.channel || "-"}</td>
              <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{money(item.currency, item.grand_total)}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{fmt(item.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onView(item)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.payment_status && item.payment_status.toLowerCase() !== "paid" && String(item.status || "").toLowerCase() !== "expired" && String(item.payment_status || "").toLowerCase() !== "expired" ? "Open / Edit" : "View"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
