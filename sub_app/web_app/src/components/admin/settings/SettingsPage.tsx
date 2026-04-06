import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { deleteSetting, listSettings, upsertSetting } from "./api";
import SettingFormModal from "./SettingFormModal";
import type { SettingItem } from "./types";

export default function SettingsPage() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<SettingItem | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSettings({ q, scope, page, limit });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [q, scope, page, limit]);

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (item: SettingItem) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Settings</h3>
          <p className="text-sm text-slate-600">Kelola konfigurasi aplikasi by key dan scope.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Setting
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search key"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />

        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Scope (global)"
          value={scope}
          onChange={(e) => {
            setPage(1);
            setScope(e.target.value);
          }}
        />

        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => {
            setPage(1);
            setLimit(Number(e.target.value));
          }}
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setPage(1);
            setQ("");
            setScope("");
          }}
          className="rounded bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Reset
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? <div className="p-4 text-sm text-slate-500">Loading settings...</div> : null}
        {error ? <div className="p-4 text-sm text-rose-600">{error}</div> : null}
        {!loading && !error ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Key</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Scope</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Value</th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Updated</th>
                <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.scope}:${item.key}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.key}</td>
                    <td className="px-3 py-2 text-slate-700">{item.scope}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <pre className="max-w-[520px] overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs">
                        {JSON.stringify(item.value, null, 2)}
                      </pre>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{new Date(item.updated_at).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Hapus setting ${item.key} (${item.scope})?`)) return;
                            setSubmitting(true);
                            try {
                              await deleteSetting(item.key, item.scope);
                              notifySuccess("Setting dihapus");
                              await loadData();
                            } catch (err) {
                              notifyError(err instanceof Error ? err.message : "Gagal hapus setting");
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Total: <span className="font-medium text-slate-900">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <SettingFormModal
        open={formOpen}
        mode={formMode}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={async (payload) => {
          setSubmitting(true);
          try {
            await upsertSetting(payload.key, {
              scope: payload.scope,
              value: payload.value,
              description: payload.description,
            });
            notifySuccess(formMode === "create" ? "Setting created" : "Setting updated");
            setFormOpen(false);
            setSelected(null);
            await loadData();
          } catch (err) {
            notifyError(err instanceof Error ? err.message : "Failed to save setting");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
