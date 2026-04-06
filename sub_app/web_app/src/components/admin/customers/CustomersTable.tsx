import type { Customer } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

type Props = {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  busyCustomerId: string | null;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onBan: (customer: Customer) => void;
  onUnban: (customer: Customer) => void;
  onRestore: (customer: Customer) => void;
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

export default function CustomersTable({
  customers,
  loading,
  error,
  busyCustomerId,
  onEdit,
  onDelete,
  onBan,
  onUnban,
  onRestore,
}: Props) {
  if (loading) {
    return <div className="text-sm text-slate-500">Loading customers...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  if (customers.length === 0) {
    return <div className="text-sm text-slate-500">Belum ada customer.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Locale</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Banned</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className={`border-t border-slate-100 ${customer.deleted_at ? "bg-slate-50" : ""}`}>
              <td className="px-3 py-2 text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{shortID(customer.id)}</span>
                  <button
                    type="button"
                    onClick={() => copyID(customer.id)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-slate-900">{customer.name}</div>
                  {customer.deleted_at ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      deleted
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">{customer.email}</div>
                <div className="text-xs text-slate-400">{customer.notes || "-"}</div>
              </td>
              <td className="px-3 py-2 text-slate-700">{customer.phone || "-"}</td>
              <td className="px-3 py-2 text-slate-700 uppercase">{customer.locale || "id"}</td>
              <td className="px-3 py-2 text-slate-700">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    customer.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {customer.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-700">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    customer.is_banned ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {customer.is_banned ? "Banned" : "Clear"}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-700">{new Date(customer.updated_at).toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(customer)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  {customer.is_banned ? (
                    <button
                      type="button"
                      onClick={() => onUnban(customer)}
                      disabled={busyCustomerId === customer.id}
                      className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-70"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBan(customer)}
                      disabled={busyCustomerId === customer.id}
                      className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 disabled:opacity-70"
                    >
                      Ban
                    </button>
                  )}
                  {customer.deleted_at ? (
                    <button
                      type="button"
                      onClick={() => onRestore(customer)}
                      disabled={busyCustomerId === customer.id}
                      className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-70"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDelete(customer)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}