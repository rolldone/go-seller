import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { getPaymentReconciliationReport, listPaymentProviders } from "./api";
import type { PaymentProvider, PaymentReconciliationItem, PaymentReconciliationSummary } from "./types";
import PaymentProviderModal, { PROVIDER_OPTIONS } from "./PaymentProviderForm";
import { formatAmount } from "../../../lib/amountFormat";

export default function PaymentProvidersPage() {
  const [items, setItems] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProvider, setEditingProvider] = useState<PaymentProvider | null>(null);

  const [reportRows, setReportRows] = useState<PaymentReconciliationItem[]>([]);
  const [reportSummary, setReportSummary] = useState<PaymentReconciliationSummary>({
    total: 0,
    mismatch_count: 0,
    paid_count: 0,
    pending_count: 0,
    failed_count: 0,
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [providerKeyFilter, setProviderKeyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await listPaymentProviders(true);
      setItems(data);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat provider");
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    try {
      const res = await getPaymentReconciliationReport({
        provider_key: providerKeyFilter || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 20,
      });
      setReportRows(res.data || []);
      setReportSummary(res.summary || reportSummary);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat report");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
    void loadReport();
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setEditingProvider(null);
    setModalOpen(true);
  };

  const openEdit = (item: PaymentProvider) => {
    setModalMode("edit");
    setEditingProvider(item);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Payment Providers</h3>
          <p className="text-sm text-slate-500">Kelola gateway dan metode pembayaran yang tersedia.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          + New Provider
        </button>
      </div>

      <PaymentProviderModal
        open={modalOpen}
        mode={modalMode}
        initialData={editingProvider}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadProviders()}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Provider List</h4>
          <button
            type="button"
            onClick={() => void loadProviders()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Reload
          </button>
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-500">Loading...</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Provider Key</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">In Use</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{item.provider_key}</span>
                    </td>
                    <td className="px-3 py-2">
                      {item.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.is_used ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">In Use</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => openEdit(item)} className="text-xs font-medium text-slate-700 hover:text-slate-900">Edit</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">Belum ada provider.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Gateway Reconciliation Report</h4>
          <div className="flex gap-2">
            <select
              value={providerKeyFilter}
              onChange={(e) => setProviderKeyFilter(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Gateway (exclude bank_transfer, cash/cash_money)</option>
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">all status</option>
              <option value="pending">pending</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
            </select>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Filter
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-1">total: {reportSummary.total}</span>
          <span className="rounded bg-rose-100 px-2 py-1 text-rose-700">mismatch: {reportSummary.mismatch_count}</span>
          <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">paid: {reportSummary.paid_count}</span>
          <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">pending: {reportSummary.pending_count}</span>
          <span className="rounded bg-slate-200 px-2 py-1">failed: {reportSummary.failed_count}</span>
        </div>

        {reportLoading ? <p className="mt-3 text-sm text-slate-500">Loading report...</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left">Order</th>
                  <th className="px-2 py-2 text-left">Provider</th>
                  <th className="px-2 py-2 text-left">Payment Status</th>
                  <th className="px-2 py-2 text-left">Order Payment</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-left">Mismatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportRows.map((row) => (
                  <tr key={row.payment_id}>
                    <td className="px-2 py-2">{row.order_number}</td>
                    <td className="px-2 py-2">{row.provider_key || "-"}</td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="px-2 py-2">{row.order_payment_status}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(row.amount, { fractionDigits: 0 })} {row.currency}</td>
                    <td className="px-2 py-2">{row.is_mismatch ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
