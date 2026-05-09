import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import { createPaymentMethod, updatePaymentMethod } from "./api";
import type { UpsertMethodPayload } from "./api";
import type { PaymentMethod, PaymentProvider } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

// ─── Method Config per provider_key ──────────────────────────────────────────

type MidtransMethodConfig = {
  bank: string;
  charge_type: string;
};

type XenditMethodConfig = {
  channel_code: string;
  type: string;
};

type DuitkuMethodConfig = {
  payment_method: string;
};

type TripayMethodConfig = {
  method: string;
};

type IPaymuMethodConfig = {
  payment_method: string;
  payment_channel: string;
};

type MethodConfig = MidtransMethodConfig | XenditMethodConfig | DuitkuMethodConfig | TripayMethodConfig | IPaymuMethodConfig | Record<string, string>;

function defaultMethodConfig(providerKey: string): MethodConfig {
  switch (providerKey) {
    case "midtrans":
      return { bank: "bca", charge_type: "bank_transfer" };
    case "xendit":
      return { channel_code: "BCA", type: "virtual_account" };
    case "duitku":
      return { payment_method: "BC" };
    case "tripay":
      return { method: "BRIVA" };
    case "ipaymu":
      return { payment_method: "va", payment_channel: "bca" };
    default:
      return {};
  }
}

function MethodConfigSwitch({
  providerKey,
  config,
  onChange,
}: {
  providerKey: string;
  config: Record<string, string>;
  onChange: (cfg: Record<string, string>) => void;
}) {
  const set = (key: string, value: string) => onChange({ ...config, [key]: value });

  if (providerKey === "midtrans") {
    return (
      <div className="space-y-3 border border-slate-200 rounded p-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konfigurasi Midtrans</p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipe Charge</label>
          <select
            value={config.charge_type ?? "bank_transfer"}
            onChange={(e) => set("charge_type", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="bank_transfer">Bank Transfer / VA</option>
            <option value="gopay">GoPay</option>
            <option value="shopeepay">ShopeePay</option>
            <option value="qris">QRIS</option>
            <option value="cstore">Convenience Store</option>
          </select>
        </div>
        {(config.charge_type === "bank_transfer" || !config.charge_type) && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bank</label>
            <select
              value={config.bank ?? "bca"}
              onChange={(e) => set("bank", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="bca">BCA</option>
              <option value="bni">BNI</option>
              <option value="bri">BRI</option>
              <option value="mandiri">Mandiri Bill</option>
              <option value="permata">Permata</option>
              <option value="cimb">CIMB</option>
            </select>
          </div>
        )}
        {config.charge_type === "cstore" && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gerai</label>
            <select
              value={config.bank ?? "alfamart"}
              onChange={(e) => set("bank", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="alfamart">Alfamart</option>
              <option value="indomaret">Indomaret</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  if (providerKey === "xendit") {
    return (
      <div className="space-y-3 border border-slate-200 rounded p-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konfigurasi Xendit</p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipe Pembayaran</label>
          <select
            value={config.type ?? "virtual_account"}
            onChange={(e) => set("type", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="virtual_account">Virtual Account</option>
            <option value="ewallet">E-Wallet</option>
            <option value="qr_code">QR Code / QRIS</option>
          </select>
        </div>
        {(config.type === "virtual_account" || !config.type) && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Channel (Bank)</label>
            <select
              value={config.channel_code ?? "BCA"}
              onChange={(e) => set("channel_code", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="BCA">BCA</option>
              <option value="BNI">BNI</option>
              <option value="BRI">BRI</option>
              <option value="MANDIRI">Mandiri</option>
              <option value="PERMATA">Permata</option>
              <option value="BSI">BSI</option>
            </select>
          </div>
        )}
        {config.type === "ewallet" && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Channel E-Wallet</label>
            <select
              value={config.channel_code ?? "OVO"}
              onChange={(e) => set("channel_code", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="OVO">OVO</option>
              <option value="DANA">DANA</option>
              <option value="LINKAJA">LinkAja</option>
              <option value="SHOPEEPAY">ShopeePay</option>
              <option value="JENIUSPAY">Jenius Pay</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  if (providerKey === "duitku") {
    return (
      <div className="space-y-3 border border-slate-200 rounded p-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konfigurasi Duitku</p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
          <select
            value={config.payment_method ?? "BC"}
            onChange={(e) => set("payment_method", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Hosted Page Duitku (pilih metode di halaman Duitku)</option>
            <option value="BC">BCA Virtual Account</option>
            <option value="M2">Mandiri Virtual Account</option>
            <option value="I1">BNI Virtual Account</option>
            <option value="BR">BRIVA</option>
            <option value="BT">Permata Virtual Account</option>
            <option value="IR">Indomaret</option>
            <option value="OV">OVO</option>
            <option value="DA">DANA</option>
            <option value="SA">ShopeePay Apps</option>
            <option value="SP">QRIS ShopeePay</option>
            <option value="NQ">QRIS Nobu</option>
            <option value="GQ">QRIS Gudang Voucher</option>
            <option value="SQ">QRIS Nusapay</option>
            <option value="DN">Indodana</option>
            <option value="AT">ATOME</option>
            <option value="JP">Jenius Pay</option>
          </select>
        </div>
      </div>
    );
  }

  if (providerKey === "tripay") {
    return (
      <div className="space-y-3 border border-slate-200 rounded p-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konfigurasi Tripay</p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
          <select
            value={config.method ?? "BRIVA"}
            onChange={(e) => set("method", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="BRIVA">BRIVA</option>
            <option value="BNIVA">BNI VA</option>
            <option value="MANDIRIVA">Mandiri VA</option>
            <option value="BCAVA">BCA VA</option>
            <option value="PERMATAVA">Permata VA</option>
            <option value="BSIVA">BSI VA</option>
            <option value="ALFAMART">Alfamart</option>
            <option value="INDOMARET">Indomaret</option>
            <option value="QRIS">QRIS</option>
            <option value="DANA">DANA</option>
            <option value="OVO">OVO</option>
            <option value="SHOPEEPAY">ShopeePay</option>
          </select>
        </div>
      </div>
    );
  }

  if (providerKey === "ipaymu") {
    return (
      <div className="space-y-3 border border-slate-200 rounded p-3 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Konfigurasi iPaymu</p>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
          <select
            value={config.payment_method ?? "va"}
            onChange={(e) => set("payment_method", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="va">Virtual Account</option>
            <option value="cstore">Convenience Store</option>
            <option value="qris">QRIS</option>
            <option value="cc">Credit Card</option>
            <option value="paylater">Paylater</option>
            <option value="cod">COD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Channel</label>
          <input
            value={config.payment_channel ?? "bca"}
            onChange={(e) => set("payment_channel", e.target.value)}
            placeholder="bca, bri, cimb, indomaret, qris, dll"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Form state ───────────────────────────────────────────────────────────────

type MethodFormState = {
  provider_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  config: Record<string, string>;
};

type ModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: PaymentMethod | null;
  providers: PaymentProvider[];
  onClose: () => void;
  onSaved: () => void;
};

const defaultForm = (providers: PaymentProvider[]): MethodFormState => {
  const firstProvider = providers[0];
  return {
    provider_id: firstProvider?.id ?? "",
    name: "",
    is_active: true,
    sort_order: 0,
    config: defaultMethodConfig(firstProvider?.provider_key ?? "") as Record<string, string>,
  };
};

export default function PaymentMethodModal({ open, mode, initialData, providers, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<MethodFormState>(defaultForm(providers));
  const [saving, setSaving] = useState(false);

  const selectedProvider = providers.find((p) => p.id === form.provider_id);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setForm({
          provider_id: initialData.provider_id,
          name: initialData.name,
          is_active: initialData.is_active,
          sort_order: initialData.sort_order ?? 0,
          config: (initialData.config as Record<string, string>) ?? defaultMethodConfig(initialData.provider?.provider_key ?? "") as Record<string, string>,
        });
      } else {
        setForm(defaultForm(providers));
      }
    }
  }, [open, mode, initialData, providers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    // When provider_id changes, reset config to defaults for new provider
    if (name === "provider_id") {
      const newProvider = providers.find((p) => p.id === value);
      setForm((prev) => ({
        ...prev,
        provider_id: value,
        config: defaultMethodConfig(newProvider?.provider_key ?? "") as Record<string, string>,
      }));
      return;
    }
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
        is_active: form.is_active,
        sort_order: form.sort_order,
        config: Object.keys(form.config).length > 0 ? form.config : undefined,
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

        {/* Provider-driven method config section */}
        {selectedProvider && (selectedProvider.provider_key === "midtrans" || selectedProvider.provider_key === "xendit" || selectedProvider.provider_key === "duitku" || selectedProvider.provider_key === "tripay" || selectedProvider.provider_key === "ipaymu") && (
          <MethodConfigSwitch
            providerKey={selectedProvider.provider_key}
            config={form.config}
            onChange={(cfg) => setForm((prev) => ({ ...prev, config: cfg }))}
          />
        )}

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
