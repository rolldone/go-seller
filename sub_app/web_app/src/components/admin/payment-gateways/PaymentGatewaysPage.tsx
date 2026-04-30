import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listGateways, activateGateway, deactivateGateway } from "./api";
import type { PaymentGatewayProvider } from "./types";
import PaymentGatewayForm from "./PaymentGatewayForm";
import GatewayLogsTable from "./GatewayLogsTable";

type Tab = "gateways" | "logs";

export default function PaymentGatewaysPage() {
  const [activeTab, setActiveTab] = useState<Tab>("gateways");
  const [items, setItems] = useState<PaymentGatewayProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<PaymentGatewayProvider | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listGateways());
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => { setModalMode("create"); setEditingItem(null); setModalOpen(true); };
  const openEdit = (item: PaymentGatewayProvider) => { setModalMode("edit"); setEditingItem(item); setModalOpen(true); };

  const handleToggle = async (item: PaymentGatewayProvider) => {
    setTogglingId(item.id);
    try {
      if (item.is_active) {
        await deactivateGateway(item.id);
        notifySuccess(`${item.name} dinonaktifkan`);
      } else {
        await activateGateway(item.id);
        notifySuccess(`${item.name} diaktifkan`);
      }
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Gagal mengubah status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Payment Gateways</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola integrasi payment gateway. Hanya super admin yang dapat mengakses halaman ini.
          </p>
        </div>
        {activeTab === "gateways" && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + Tambah Gateway
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200">
        {(["gateways", "logs"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "gateways" ? "Gateway Terdaftar" : "Transaction Logs"}
          </button>
        ))}
      </div>

      {activeTab === "logs" ? (
        <GatewayLogsTable />
      ) : (
        <>
          <PaymentGatewayForm
            open={modalOpen}
            mode={modalMode}
            initialData={editingItem}
            onClose={() => setModalOpen(false)}
            onSaved={() => void load()}
          />

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Daftar Gateway Terdaftar</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Reload
              </button>
            </div>

            {loading ? (
              <p className="px-4 py-6 text-sm text-slate-500">Memuat...</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-slate-500">Belum ada payment gateway yang ditambahkan.</p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  + Tambah Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Provider</th>
                      <th className="px-4 py-3 text-left">Nama</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Digunakan</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {item.provider_key}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-3">
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.is_used ? (
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Ya</span>
                          ) : (
                            <span className="text-xs text-slate-400">&#8212;</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggle(item)}
                              disabled={togglingId === item.id}
                              className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                                item.is_active
                                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {togglingId === item.id ? "..." : item.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">Cara kerja plugin gateway:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tambahkan gateway dan isi kredensial API-nya.</li>
              <li>Klik <strong>Validate</strong> untuk memverifikasi koneksi ke provider.</li>
              <li>Aktifkan gateway agar bisa digunakan saat checkout.</li>
              <li>
                Webhook URL otomatis:{" "}
                <code className="rounded bg-slate-200 px-1">/api/payment-gateway/webhook/:provider_key</code>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
