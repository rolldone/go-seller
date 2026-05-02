import { useEffect, useState } from "react";
import { deletePaymentMethod, listPaymentMethods } from "./api";
import type { PaymentMethod, PaymentProvider } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";
import PaymentMethodModal, { METHOD_CATEGORIES } from "./PaymentMethodForm";

type Props = {
  providers: PaymentProvider[];
};

export default function PaymentMethodsSection({ providers }: Props) {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPaymentMethods({ include_inactive: true });
      setItems(data);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat metode pembayaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: PaymentMethod) => {
    setModalMode("edit");
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: PaymentMethod) => {
    if (!confirm(`Hapus metode "${item.name}"?`)) return;
    try {
      await deletePaymentMethod(item.id);
      notifySuccess("Metode pembayaran dihapus");
      void load();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const categoryLabel = (cat: string) =>
    METHOD_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Payment Methods</h4>
          <p className="text-xs text-slate-500">Metode pembayaran yang ditampilkan ke pelanggan, dipetakan ke provider.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={providers.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            + Tambah Metode
          </button>
        </div>
      </div>

      {providers.length === 0 && (
        <p className="text-sm text-amber-600">Tambah payment provider terlebih dahulu sebelum membuat metode pembayaran.</p>
      )}

      <PaymentMethodModal
        open={modalOpen}
        mode={modalMode}
        initialData={editing}
        providers={providers}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Belum ada metode pembayaran.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Aktif</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.code}</td>
                  <td className="px-3 py-2 text-slate-600">{categoryLabel(item.category)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {item.provider ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono text-xs">{item.provider.provider_key}</span>
                        <span className="text-slate-400">({item.provider.name})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {item.is_active ? "Aktif" : "Non-aktif"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-center">{item.sort_order}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
