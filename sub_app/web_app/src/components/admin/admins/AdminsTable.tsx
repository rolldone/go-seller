import type { Admin } from "./types";

type Props = {
  items: Admin[];
  loading: boolean;
  error: string | null;
  onEdit: (item: Admin) => void;
  onDelete: (item: Admin) => void;
  onChangePassword: (item: Admin) => void;
};

export default function AdminsTable({ items, loading, error, onEdit, onDelete, onChangePassword }: Props) {
  if (loading) return <div className="text-sm text-slate-500">Loading admins...</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (items.length === 0) return <div className="text-sm text-slate-500">Belum ada admin.</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            <th className="px-3 py-2">Username</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Roles</th>
            <th className="px-3 py-2">Activated</th>
            <th className="px-3 py-2">Banned</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-900">{item.username}</td>
              <td className="px-3 py-2 text-slate-800">{item.email}</td>
              <td className="px-3 py-2 text-slate-800">
                <div className="flex flex-wrap gap-2">
                  {item.roles && item.roles.length > 0 ? (
                    item.roles.map((r) => (
                      <span key={r.id} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
                        {r.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-slate-700">{item.is_activated_at ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-slate-700">{item.is_banned ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-slate-700">{new Date(item.updated_at).toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onEdit(item)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangePassword(item)}
                    className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200"
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
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
  );
}
