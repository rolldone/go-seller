import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import AdminModal from "../ui/AdminModal";
import { createGateway, updateGateway, validateGateway } from "./api";
import type { UpsertGatewayPayload } from "./api";
import type { PaymentGatewayProvider } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

export type ProviderOption = { value: string; label: string };

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "midtrans", label: "Midtrans" },
  { value: "xendit", label: "Xendit" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "doku", label: "Doku" },
];

function defaultConfig(key: string): Record<string, unknown> {
  switch (key) {
    case "midtrans":
      return { server_key: "", client_key: "", merchant_id: "", snap_url: "", is_production: false };
    case "xendit":
      return { secret_key: "", webhook_token: "", callback_url: "" };
    case "paypal":
      return { client_id: "", client_secret: "", webhook_id: "" };
    case "stripe":
      return { secret_key: "", publishable_key: "", webhook_secret: "" };
    case "doku":
      return { client_id: "", secret_key: "", public_key: "", merchant_id: "" };
    default:
      return {};
  }
}

function mergeConfig(key: string, raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const base = defaultConfig(key);
  const src = raw || {};
  return Object.fromEntries(Object.keys(base).map((k) => [k, typeof src[k] === "string" ? src[k] : base[k]]));
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </label>
  );
}

function ConfigFields({
  providerKey,
  config,
  onChange,
}: {
  providerKey: string;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const set = (field: string, val: string) => onChange({ ...config, [field]: val });

  switch (providerKey) {
    case "midtrans":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Server Key" value={asStr(config.server_key)} onChange={(v) => set("server_key", v)} />
          <Field label="Client Key" value={asStr(config.client_key)} onChange={(v) => set("client_key", v)} />
          <Field label="Merchant ID" value={asStr(config.merchant_id)} onChange={(v) => set("merchant_id", v)} />
          <Field label="Snap URL" value={asStr(config.snap_url)} onChange={(v) => set("snap_url", v)} hint="e.g. https://app.sandbox.midtrans.com/snap/snap.js" />
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="midtrans_is_production"
              checked={config.is_production === true}
              onChange={(e) => onChange({ ...config, is_production: e.target.checked })}
              className="rounded border-slate-300"
            />
            <label htmlFor="midtrans_is_production" className="text-sm text-slate-700">Production mode</label>
          </div>
        </div>
      );
    case "xendit":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Secret Key" value={asStr(config.secret_key)} onChange={(v) => set("secret_key", v)} />
          <Field label="Webhook Token" value={asStr(config.webhook_token)} onChange={(v) => set("webhook_token", v)} />
          <div className="sm:col-span-2">
            <Field label="Callback URL" value={asStr(config.callback_url)} onChange={(v) => set("callback_url", v)} hint="URL yang akan dipanggil Xendit saat notifikasi pembayaran" />
          </div>
        </div>
      );
    case "paypal":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client ID" value={asStr(config.client_id)} onChange={(v) => set("client_id", v)} />
          <Field label="Client Secret" value={asStr(config.client_secret)} onChange={(v) => set("client_secret", v)} />
          <Field label="Webhook ID" value={asStr(config.webhook_id)} onChange={(v) => set("webhook_id", v)} />
        </div>
      );
    case "stripe":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Secret Key" value={asStr(config.secret_key)} onChange={(v) => set("secret_key", v)} />
          <Field label="Publishable Key" value={asStr(config.publishable_key)} onChange={(v) => set("publishable_key", v)} />
          <div className="sm:col-span-2">
            <Field label="Webhook Secret" value={asStr(config.webhook_secret)} onChange={(v) => set("webhook_secret", v)} hint="Dapatkan dari Stripe dashboard > Webhooks" />
          </div>
        </div>
      );
    case "doku":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client ID" value={asStr(config.client_id)} onChange={(v) => set("client_id", v)} />
          <Field label="Secret Key" value={asStr(config.secret_key)} onChange={(v) => set("secret_key", v)} />
          <Field label="Public Key" value={asStr(config.public_key)} onChange={(v) => set("public_key", v)} />
          <Field label="Merchant ID" value={asStr(config.merchant_id)} onChange={(v) => set("merchant_id", v)} />
        </div>
      );
    default:
      return <p className="text-xs text-slate-400">Tidak ada konfigurasi khusus untuk provider ini.</p>;
  }
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: PaymentGatewayProvider | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  provider_key: string;
  is_active: boolean;
  config: Record<string, unknown>;
};

export default function PaymentGatewayForm({ open, mode, initialData, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({ name: "", provider_key: "midtrans", is_active: false, config: defaultConfig("midtrans") });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mode === "edit" && initialData) {
      let cfg: Record<string, unknown> = {};
      const raw = (initialData as any).config;
      if (typeof raw === "string") {
        try { cfg = JSON.parse(atob(raw)); } catch { try { cfg = JSON.parse(raw); } catch { cfg = {}; } }
      } else if (raw && typeof raw === "object") {
        cfg = raw as Record<string, unknown>;
      }
      setForm({
        name: initialData.name,
        provider_key: initialData.provider_key,
        is_active: initialData.is_active,
        config: mergeConfig(initialData.provider_key, cfg),
      });
    } else {
      const key = "midtrans";
      setForm({ name: "Midtrans Primary", provider_key: key, is_active: false, config: defaultConfig(key) });
    }
  }, [open, mode, initialData?.id]);

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    const label = PROVIDER_OPTIONS.find((o) => o.value === key)?.label ?? key;
    setForm((prev) => ({
      ...prev,
      provider_key: key,
      name: prev.name.trim() ? prev.name : `${label} Primary`,
      config: mergeConfig(key, {}),
    }));
  };

  const buildPayload = (): UpsertGatewayPayload => ({
    name: form.name.trim(),
    provider_key: form.provider_key,
    is_active: form.is_active,
    config: form.config,
  });

  const handleValidate = async () => {
    setValidating(true);
    setError("");
    try {
      const res = await validateGateway({ provider_key: form.provider_key, credentials: form.config });
      if (res.valid) notifySuccess(res.message ?? "Konfigurasi valid");
      else setError(res.message ?? "Konfigurasi tidak valid");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validasi gagal");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Name wajib diisi"); return; }
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && initialData?.id) {
        await updateGateway(initialData.id, buildPayload());
      } else {
        await createGateway(buildPayload());
      }
      notifySuccess("Tersimpan");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title={mode === "edit" ? "Edit Payment Gateway" : "Tambah Payment Gateway"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <button type="button" onClick={handleValidate} disabled={validating} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {validating ? "Memvalidasi..." : "Validate"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</span>
            <select
              value={form.provider_key}
              onChange={handleProviderChange}
              disabled={mode === "edit"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none disabled:bg-slate-50"
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <Field label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="gw_is_active"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            className="rounded border-slate-300"
          />
          <label htmlFor="gw_is_active" className="text-sm text-slate-700">Aktif (tampil sebagai opsi pembayaran)</label>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Konfigurasi Kredensial</p>
          <ConfigFields
            providerKey={form.provider_key}
            config={form.config}
            onChange={(cfg) => setForm((p) => ({ ...p, config: cfg }))}
          />
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <strong>Catatan:</strong> Kredensial API disimpan terenkripsi di server dan tidak pernah ditampilkan kembali secara plaintext. Pastikan kamu telah menyalin nilai tersebut sebelum menyimpan ulang.
        </div>
      </div>
    </AdminModal>
  );
}
