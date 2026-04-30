import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { listLogs, type LogListParams } from "./api";
import type { GatewayTransactionLog } from "./types";

const DIRECTIONS = [
  { label: "Semua", value: "" },
  { label: "Inbound", value: "inbound" },
  { label: "Outbound", value: "outbound" },
];

const EVENT_TYPES = [
  { label: "Semua", value: "" },
  { label: "Webhook", value: "webhook" },
  { label: "Create Payment", value: "create_payment" },
  { label: "Get Status", value: "get_status" },
  { label: "Refund", value: "refund" },
];

export default function GatewayLogsTable() {
  const [logs, setLogs] = useState<GatewayTransactionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LogListParams>({ per_page: 50 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await listLogs({ ...filters, page: p });
      setLogs(res.data ?? []);
      setTotal(res.total ?? 0);
      setPage(p);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Gagal memuat logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, [filters]);

  const totalPages = Math.ceil(total / (filters.per_page ?? 50));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Provider key..."
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={filters.provider_key ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, provider_key: e.target.value || undefined }))}
        />
        <input
          type="text"
          placeholder="Reference ID / Order ID..."
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={filters.reference_id ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, reference_id: e.target.value || undefined }))}
        />
        <select
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={filters.direction ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value || undefined }))}
        >
          {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={filters.event_type ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, event_type: e.target.value || undefined }))}
        >
          {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void load(1)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Reload
        </button>
        <span className="ml-auto text-xs text-slate-400">{total} entri</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Memuat logs...</p>
        ) : logs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada log transaksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Provider</th>
                  <th className="px-4 py-3 text-left">Arah</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Reference ID</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Error</th>
                  <th className="px-4 py-3 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <>
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {log.provider_key}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {log.direction === "inbound" ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">↓ inbound</span>
                        ) : (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">↑ outbound</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{log.event_type}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">
                        {log.reference_id ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {log.status ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{log.status}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-rose-500 max-w-[180px] truncate" title={log.error_message}>
                        {log.error_message ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          {expandedId === log.id ? "Tutup" : "Lihat"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-1">Request Payload</p>
                              <pre className="rounded bg-slate-800 text-slate-100 text-xs p-3 overflow-x-auto max-h-48">
                                {JSON.stringify(log.request_payload, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-1">Response Payload</p>
                              <pre className="rounded bg-slate-800 text-slate-100 text-xs p-3 overflow-x-auto max-h-48">
                                {JSON.stringify(log.response_payload, null, 2)}
                              </pre>
                            </div>
                          </div>
                          {log.ip_address && (
                            <p className="mt-2 text-xs text-slate-400">IP: <span className="font-mono">{log.ip_address}</span></p>
                          )}
                          {log.provider_transaction_id && (
                            <p className="text-xs text-slate-400">Provider Tx ID: <span className="font-mono">{log.provider_transaction_id}</span></p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void load(page - 1)}
            disabled={page <= 1}
            className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500">Halaman {page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => void load(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
