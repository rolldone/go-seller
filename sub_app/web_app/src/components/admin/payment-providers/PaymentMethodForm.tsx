import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import { createPaymentMethod, updatePaymentMethod } from "./api";
import type { UpsertMethodPayload } from "./api";
import type { PaymentMethod, PaymentProvider } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

export const METHOD_CATEGORIES = [
  { value: "bank_transfer", label: "Bank Transfer / VA" },
  { value: "e_wallet", label: "E-Wallet" },
  { value: "qris", label: "QRIS" },
  { value: "credit_card", label: "Kartu Kredit/Debit" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Lainnya" },
];

type MethodFormState = {
  provider_id: string;
  name: string;
  code: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  icon_url: string;
};

type ModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: PaymentMethod | null;
  providers: PaymentProvider[];
  onClose: () => void;
  onSaved: () => void;
};

const defaultForm = (providers: PaymentProvider[]): MethodFormState => ({
  provider_id: providers[0]?.id ?? "",
  name: "",
  code: "",
  category: "bank_transfer",
  is_active: true,
  sort_order: 0,
  icon_url: "",
});

export default function PaymentMethodModal({ open, mode, initialData, providers, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<MethodFormState>(defaultForm(providers));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setForm({
          provider_id: initialData.provider_id,
          name: initialData.name,
          code: initialData.code,
          category: initialData.category || "bank_transfer",
          is_active: initialData.is_active,
          sort_order: initialData.sort_order ?? 0,
          icon_url: initialData.icon_url ?? "",
        });
      } else {
        setForm(defaultForm(providers));
      }
    }
  }, [open, mode, initialData, providers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : (name === "sort_order" ? Number(value) : value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: UpsertMethodPayload = {
        provider_id: form.provider_id,
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category,
        is_active: form.is_active,
        sort_order: form.sort_order,
        icon_url: form.icon_url.trim() || undefined,
      };
      if (mode === "edit" && initialData) {
        await updatePaymentMethod(initialData.id, payload);
        notifySuccess("Metode pembayaran berhasil diperbarui");
      } else {
        await createPaymentMethod(payload);
        notifySuccess("Metode pembayaran berhasil dibuat");
      }
      onSaved();
      onClose();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal open={open} onClose={onClose} title={mode === "edit" ? "Edit Metode Pembayaran" : "Tambah Metode Pembayaran"}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Provider Gateway</label>
          <select
            name="provider_id"
            value={form.provider_id}
            onChange={handleChange}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.provider_key})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="VA BCA, OVO, dsb"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
            <input
              name="code"
              value={form.code}
              onChange={handleChange}
              required
              placeholder="bca_va, ovo, dsb"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {METHOD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sort Order</label>
            <input
              name="sort_order"
              type="number"
              value={form.sort_order}
              onChange={handleChange}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Icon URL (opsional)</label>
          <input
            name="icon_url"
            value={form.icon_url}
            onChange={handleChange}
            placeholder="https://..."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="method_is_active"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
            className="rounded border-slate-300 text-emerald-600"
          />
          <label htmlFor="method_is_active" className="text-sm text-slate-700">Aktif</label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
