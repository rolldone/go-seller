import type { Discount } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";

type Props = {
  discounts: Discount[];
  loading: boolean;
  error: string | null;
  onEdit: (discount: Discount) => void;
  onDelete: (discount: Discount) => void;
};

const shortID = (value: string) => value.slice(0, 8);

const copyID = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    notifySuccess("ID copied");
  } catch (err) {
    notifyError(err instanceof Error ? err.message : "Gagal copy ID");
  }
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export default function DiscountsTable({ discounts, loading, error, onEdit, onDelete }: Props) {
  if (loading) return <div className="text-sm text-slate-500">Loading discounts...</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (discounts.length === 0) return <div className="text-sm text-slate-500">Belum ada discount.</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Usage Limit</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {discounts.map((d) => (
            <tr key={d.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{shortID(d.id)}</span>
                  <button
                    type="button"
                    onClick={() => copyID(d.id)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-800">
                <div className="font-medium">{d.name}</div>
                {d.description ? <div className="text-xs text-slate-400">{d.description}</div> : null}
              </td>
              <td className="px-3 py-2">
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
                  {d.discount_type}
                </span>
              </td>
              <td className="px-3 py-2 font-semibold text-slate-700">{d.priority}</td>
              <td className="px-3 py-2 text-slate-700">
                {d.discount_type === "percentage" ? `${d.discount_value}%` : formatAmount(d.discount_value, { fractionDigits: 0 })}
                {d.max_discount_amount ? (
                  <div className="text-xs text-slate-400">max {formatAmount(d.max_discount_amount, { fractionDigits: 0 })}</div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-slate-700 text-xs">
                <div>{formatDate(d.start_at)}</div>
                <div className="text-slate-400">s/d {formatDate(d.end_at)}</div>
              </td>
              <td className="px-3 py-2 text-slate-700 text-xs">
                {d.usage_limit != null ? (
                  <div>Total: {d.usage_limit}</div>
                ) : (
                  <div className="text-xs text-slate-400">Unlimited</div>
                )}
                {d.usage_limit_per_user != null ? <div>Per user: {d.usage_limit_per_user}</div> : null}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    d.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {d.is_active ? "Active" : "Inactive"}
                </span>
                {d.per_user_only ? (
                  <div className="mt-0.5 text-xs text-slate-400">Per-user</div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(d)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(d)}
                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
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
  );
}
