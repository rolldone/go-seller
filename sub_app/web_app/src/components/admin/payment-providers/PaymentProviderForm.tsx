import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import AdminModal from "../ui/AdminModal";
import { adminGet } from "../entities/adminApi";
import { createPaymentProvider, updatePaymentProvider } from "./api";
import type { UpsertProviderPayload } from "./api";
import type { PaymentProvider } from "./types";
import { notifyError, notifySuccess } from "../../../lib/notification";

export type ProviderOption = {
  value: string;
  label: string;
};

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "paypal", label: "PayPal" },
  { value: "xendit", label: "Xendit" },
  { value: "midtrans", label: "Midtrans" },
  { value: "doku", label: "Doku" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
];

type ProviderFormState = {
  name: string;
  provider_key: string;
  is_active: boolean;
  is_used: boolean;
  credentials_encrypted: string;
  config: Record<string, unknown>;
};

type ModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialData?: PaymentProvider | null;
  onClose: () => void;
  onSaved: () => void;
};

export function defaultProviderConfig(providerKey: string): Record<string, unknown> {
  switch (providerKey) {
    case "paypal":
      return {
        client_id: "",
        client_secret: "",
        webhook_id: "",
      };
    case "xendit":
      return {
        secret_key: "",
        webhook_token: "",
        callback_url: "",
      };
    case "midtrans":
      return {
        server_key: "",
        client_key: "",
        merchant_id: "",
        snap_url: "",
      };
    case "doku":
      return {
        client_id: "",
        secret_key: "",
        public_key: "",
        merchant_id: "",
      };
    case "bank_transfer":
      return {
        bank_name: "",
        account_name: "",
        account_number: "",
        instructions: "",
      };
    case "cash":
      return {
        notes: "Bayar tunai di kasir",
      };
    default:
      return {};
  }
}

export function normalizeProviderConfig(providerKey: string, raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const base = defaultProviderConfig(providerKey);
  const source = raw || {};
  const normalized: Record<string, unknown> = { ...base };

  Object.keys(base).forEach((key) => {
    const val = source[key];
    normalized[key] = typeof val === "string" ? val : (base[key] as string);
  });

  return normalized;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function ConfigInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
}) {
  const baseClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

  return (
    <label className="text-sm">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {multiline ? (
        <textarea className={baseClass} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={baseClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function ProviderConfigSwitch({
  providerKey,
  config,
  onConfigChange,
}: {
  providerKey: string;
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  const setConfigField = (field: string, nextValue: string) => {
    onConfigChange({
      ...config,
      [field]: nextValue,
    });
  };

  switch (providerKey) {
    case "paypal":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <ConfigInput label="Client ID" value={asString(config.client_id)} onChange={(v) => setConfigField("client_id", v)} />
          <ConfigInput label="Client Secret" value={asString(config.client_secret)} onChange={(v) => setConfigField("client_secret", v)} />
          <ConfigInput label="Webhook ID" value={asString(config.webhook_id)} onChange={(v) => setConfigField("webhook_id", v)} />
        </div>
      );
    case "xendit":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <ConfigInput label="Secret Key" value={asString(config.secret_key)} onChange={(v) => setConfigField("secret_key", v)} />
          <ConfigInput label="Webhook Token" value={asString(config.webhook_token)} onChange={(v) => setConfigField("webhook_token", v)} />
          <ConfigInput label="Callback URL" value={asString(config.callback_url)} onChange={(v) => setConfigField("callback_url", v)} />
        </div>
      );
    case "midtrans":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <ConfigInput label="Server Key" value={asString(config.server_key)} onChange={(v) => setConfigField("server_key", v)} />
          <ConfigInput label="Client Key" value={asString(config.client_key)} onChange={(v) => setConfigField("client_key", v)} />
          <ConfigInput label="Merchant ID" value={asString(config.merchant_id)} onChange={(v) => setConfigField("merchant_id", v)} />
          <ConfigInput label="Snap URL" value={asString(config.snap_url)} onChange={(v) => setConfigField("snap_url", v)} />
        </div>
      );
    case "doku":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <ConfigInput label="Client ID" value={asString(config.client_id)} onChange={(v) => setConfigField("client_id", v)} />
          <ConfigInput label="Secret Key" value={asString(config.secret_key)} onChange={(v) => setConfigField("secret_key", v)} />
          <ConfigInput label="Public Key" value={asString(config.public_key)} onChange={(v) => setConfigField("public_key", v)} />
          <ConfigInput label="Merchant ID" value={asString(config.merchant_id)} onChange={(v) => setConfigField("merchant_id", v)} />
        </div>
      );
    case "bank_transfer":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <ConfigInput label="Bank Name" value={asString(config.bank_name)} onChange={(v) => setConfigField("bank_name", v)} />
          <ConfigInput label="Account Name" value={asString(config.account_name)} onChange={(v) => setConfigField("account_name", v)} />
          <ConfigInput label="Account Number" value={asString(config.account_number)} onChange={(v) => setConfigField("account_number", v)} />
          <div className="md:col-span-2">
            <ConfigInput
              label="Payment Instructions"
              value={asString(config.instructions)}
              onChange={(v) => setConfigField("instructions", v)}
              multiline
            />
          </div>
        </div>
      );
    case "cash":
      return (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <ConfigInput label="Cash Notes" value={asString(config.notes)} onChange={(v) => setConfigField("notes", v)} multiline />
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function PaymentProviderModal({ open, mode, initialData, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<ProviderFormState>({
    name: "",
    provider_key: "bank_transfer",
    is_active: false,
    is_used: false,
    credentials_encrypted: "",
    config: defaultProviderConfig("bank_transfer"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mode === "edit" && initialData?.id) {
      setLoadingData(true);
      void (async () => {
        try {
          const res = await adminGet<{ data: PaymentProvider }>(`/admin/order/payment-providers/${initialData.id}`);
          const p = res.data;
          // backend serializes JSONB []byte as base64 string; decode if necessary
          let cfg: Record<string, unknown> = {};
          const raw = (p as any).config;
          if (typeof raw === "string") {
            try {
              // try base64 -> json
              const decoded = atob(raw);
              cfg = JSON.parse(decoded);
            } catch {
              try {
                // maybe plain JSON string
                cfg = JSON.parse(raw);
              } catch {
                cfg = {};
              }
            }
          } else if (raw && typeof raw === "object") {
            cfg = raw as Record<string, unknown>;
          }

          setForm({
            name: p.name,
            provider_key: p.provider_key || "bank_transfer",
            is_active: !!p.is_active,
            is_used: !!p.is_used,
            credentials_encrypted: p.credentials_encrypted || "",
            config: normalizeProviderConfig(p.provider_key || "bank_transfer", cfg),
          });
        } catch {
          notifyError("Gagal memuat data provider");
          onClose();
        } finally {
          setLoadingData(false);
        }
      })();
    } else {
      setForm({
        name: "",
        provider_key: "bank_transfer",
        is_active: false,
        is_used: false,
        credentials_encrypted: "",
        config: defaultProviderConfig("bank_transfer"),
      });
    }
  }, [open, mode, initialData?.id]);

  const setField = (patch: Partial<ProviderFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleProviderSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const providerKey = e.target.value;
    const label = PROVIDER_OPTIONS.find((opt) => opt.value === providerKey)?.label || providerKey;
    setForm((prev) => ({
      ...prev,
      provider_key: providerKey,
      name: prev.name.trim() ? prev.name : `${label} Primary`,
      config: normalizeProviderConfig(providerKey, {}),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Name wajib diisi"); return; }
    if (!form.provider_key) { setError("Provider key wajib diisi"); return; }
    setSaving(true);
    setError("");
    try {
      const payload: UpsertProviderPayload = {
        name: form.name.trim(),
        provider_key: form.provider_key,
        is_active: form.is_active,
        is_used: form.is_used,
        config: form.config,
        credentials_encrypted: form.credentials_encrypted.trim() || undefined,
      };
      if (mode === "edit" && initialData?.id) {
        await updatePaymentProvider(initialData.id, payload);
        notifySuccess("Provider diperbarui");
      } else {
        await createPaymentProvider(payload);
        notifySuccess("Provider dibuat");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan provider");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title={mode === "edit" ? "Edit Payment Provider" : "Create Payment Provider"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || loadingData}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {saving ? "Saving..." : mode === "edit" ? "Save" : "Create"}
          </button>
        </>
      }
    >
      {loadingData ? (
        <p className="py-8 text-center text-sm text-slate-500">Memuat data provider...</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Payment Provider Profile</p>
            <p className="text-sm text-slate-600">Pilih provider, isi kredensial sesuai tipe provider, lalu sistem simpan sebagai JSON config.</p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Informasi Dasar</h4>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <label className="text-sm">
                <span className={labelClass}>Provider Name</span>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setField({ name: e.target.value })}
                  placeholder="Contoh: Xendit Production"
                />
              </label>
              <label className="text-sm">
                <span className={labelClass}>Provider Key</span>
                <select className={inputClass} value={form.provider_key} onChange={handleProviderSelect}>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className={labelClass}>Encrypted Credential (Optional)</span>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={form.credentials_encrypted}
                  onChange={(e) => setField({ credentials_encrypted: e.target.value })}
                  placeholder="Isi blob terenkripsi dari external secrets manager"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Provider Config</h4>
            <ProviderConfigSwitch
              providerKey={form.provider_key}
              config={form.config || {}}
              onConfigChange={(nextConfig) => setField({ config: nextConfig })}
            />
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-emerald-300">Generated JSON Config</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(form.config || {}, null, 2)}</pre>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Status</h4>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex flex-1 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm min-w-[200px]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField({ is_active: e.target.checked })}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-semibold text-slate-800">Is Active</p>
                  <p className="text-xs text-slate-500">Provider ini tersedia dan bisa dipilih saat membuat payment</p>
                </div>
              </label>
              <label className="inline-flex flex-1 items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm min-w-[200px]">
                <input
                  type="checkbox"
                  checked={form.is_used}
                  onChange={(e) => setField({ is_used: e.target.checked })}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-semibold text-emerald-800">Is Used (Default Global)</p>
                  <p className="text-xs text-emerald-600">Satu provider yang sedang digunakan. Jika dipilih, yang lain akan di-unset otomatis.</p>
                </div>
              </label>
            </div>
          </section>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div> : null}
        </div>
      )}
    </AdminModal>
  );
}
