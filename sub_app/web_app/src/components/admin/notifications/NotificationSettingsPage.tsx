import { useEffect, useMemo, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import { listSettings, upsertSetting } from "../settings/api";
import { testNotificationTemplate } from "./api";
import type { TestNotificationResponse } from "./api";
import type { SettingItem } from "../settings/types";
import AdminModal from "../ui/AdminModal";

type NotificationAudience = "admin" | "customer";
type Locale = "id" | "en";

type NotificationTemplate = {
  id: string;
  name: string;
  audience: NotificationAudience;
  description: string;
  enabled: boolean;
  recipients: string;
  subject: string;
  body: string;
};

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: "id", label: "Indonesia (id)" },
  { value: "en", label: "English (en)" },
];

const TEMPLATE_META: Array<Pick<NotificationTemplate, "id" | "name" | "audience" | "description">> = [
  {
    id: "new_order_admin",
    name: "New Order",
    audience: "admin",
    description: "Notifikasi saat order baru masuk.",
  },
  {
    id: "cancelled_order_admin",
    name: "Cancelled Order",
    audience: "admin",
    description: "Notifikasi saat order dibatalkan.",
  },
  {
    id: "failed_order_admin",
    name: "Failed Order",
    audience: "admin",
    description: "Notifikasi saat pembayaran gagal.",
  },
  {
    id: "processing_order_customer",
    name: "Processing Order",
    audience: "customer",
    description: "Notifikasi ke customer saat order diproses.",
  },
  {
    id: "completed_order_customer",
    name: "Completed Order",
    audience: "customer",
    description: "Notifikasi ke customer saat order selesai.",
  },
  {
    id: "customer_forgot_password",
    name: "Customer Forgot Password",
    audience: "customer",
    description: "Notifikasi reset password untuk customer.",
  },
  {
    id: "proof_uploaded_admin",
    name: "Proof Uploaded",
    audience: "admin",
    description: "Notifikasi saat bukti transfer diupload.",
  },
  {
    id: "subscription_confirmation_customer",
    name: "Subscription Confirmation",
    audience: "customer",
    description: "Notifikasi saat customer diminta mengonfirmasi langganan email.",
  },
];

const DEFAULTS_BY_LOCALE: Record<Locale, Record<string, Pick<NotificationTemplate, "enabled" | "recipients" | "subject" | "body">>> = {
  id: {
    new_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local, owner@goseller.local",
      subject: "[Order Baru] {{.order_number}} - {{.business_name}}",
      body: "Halo Admin, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
    },
    cancelled_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Order Dibatalkan] {{.order_number}}",
      body: "Order {{.order_number}} dibatalkan. Status order saat ini: {{.order_status}}.",
    },
    failed_order_admin: {
      enabled: true,
      recipients: "finance@goseller.local",
      subject: "[Payment Gagal] {{.order_number}}",
      body: "Payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
    },
    processing_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order kamu sedang diproses - {{.order_number}}",
      body: "Hi {{.customer_name}}, order {{.order_number}} sudah kami terima dan pembayaran sudah terverifikasi.",
    },
    completed_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order selesai - {{.order_number}}",
      body: "Hi {{.customer_name}}, order {{.order_number}} sudah selesai. Terima kasih sudah belanja.",
    },
    customer_forgot_password: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Reset password akun GoSeller",
      body: "Halo {{.customer_name}}, kami menerima permintaan reset password. Klik tautan berikut untuk melanjutkan: {{.reset_url}}. Tautan ini berlaku 15 menit.",
    },
    proof_uploaded_admin: {
      enabled: false,
      recipients: "admin@goseller.local",
      subject: "[Bukti Transfer Baru] {{.order_number}}",
      body: "Bukti transfer baru sudah diupload untuk order {{.order_number}}. Silakan cek panel admin.",
    },
    subscription_confirmation_customer: {
      enabled: true,
      recipients: "{{.email}}",
      subject: "Konfirmasi langganan - {{.business_name}}",
      body: "Hai {{.Name}},\n\nTerima kasih telah berlangganan {{.business_name}}{{if .ProductName}} - {{.ProductName}}{{end}}.\nSilakan klik tautan berikut untuk mengonfirmasi langganan Anda:\n{{.ConfirmLink}}\n\nTautan ini akan kedaluwarsa dalam {{.ExpiryMinutes}} menit.\n\nJika Anda tidak meminta ini, abaikan saja.",
    },
  },
  en: {
    new_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local, owner@goseller.local",
      subject: "[New Order] {{.order_number}} - {{.business_name}}",
      body: "Hello Admin, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
    },
    cancelled_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Order Cancelled] {{.order_number}}",
      body: "Order {{.order_number}} has been cancelled. Current order status: {{.order_status}}.",
    },
    failed_order_admin: {
      enabled: true,
      recipients: "finance@goseller.local",
      subject: "[Payment Failed] {{.order_number}}",
      body: "Payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
    },
    processing_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Your order is being processed - {{.order_number}}",
      body: "Hi {{.customer_name}}, your order {{.order_number}} has been received and your payment has been verified.",
    },
    completed_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order completed - {{.order_number}}",
      body: "Hi {{.customer_name}}, your order {{.order_number}} is completed. Thank you for shopping with us.",
    },
    customer_forgot_password: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Reset GoSeller account password",
      body: "Hi {{.customer_name}}, we received a password reset request for your account. Click this link to continue: {{.reset_url}}. This link is valid for 15 minutes.",
    },
    proof_uploaded_admin: {
      enabled: false,
      recipients: "admin@goseller.local",
      subject: "[New Transfer Proof] {{.order_number}}",
      body: "A new transfer proof has been uploaded for order {{.order_number}}. Please check the admin panel.",
    },
    subscription_confirmation_customer: {
      enabled: true,
      recipients: "{{.email}}",
      subject: "Subscription confirmation - {{.business_name}}",
      body: "Hi {{.Name}},\n\nThanks for subscribing to {{.business_name}}{{if .ProductName}} - {{.ProductName}}{{end}}.\nPlease click the link below to confirm your subscription:\n{{.ConfirmLink}}\n\nThis link will expire in {{.ExpiryMinutes}} minutes.\n\nIf you did not request this, please ignore this email.",
    },
  },
};

const placeholders = [
  "{{.order_number}}",
  "{{.customer_name}}",
  "{{.customer_email}}",
  "{{.business_name}}",
  "{{.payment_status}}",
  "{{.grand_total}}",
  "{{.currency}}",
  "{{.order_link}}",
  "{{.reset_url}}",
  "{{.reset_token}}",
  "{{.ConfirmLink}}",
  "{{.ExpiryMinutes}}",
  "{{.Name}}",
  "{{.business_name}}",
  "{{.ProductName}}",
];

const DEFAULT_TEST_VARS = {
  order_number: "TEST-1001",
  order_status: "processing",
  payment_status: "paid",
  grand_total: "123.45",
  currency: "IDR",
  customer_name: "Test Customer",
  customer_email: "test@example.com",
  business_name: "Go Seller",
  order_link: "/admin/orders",
  reset_token: "TEST-RESET-TOKEN",
  reset_url: `${(import.meta.env.PUBLIC_APP_URL ?? "https://example.com").replace(/\/+$/, "")}/customer/auth/reset-password?token=TEST-RESET-TOKEN`,
  ConfirmLink: `${(import.meta.env.PUBLIC_APP_URL ?? "https://example.com").replace(/\/+$/, "")}/subscribe/confirm?token=TEST-CONFIRM-TOKEN`,
  ExpiryMinutes: "1440",
  Name: "Test Customer",
  ProductName: "",
  app_name: "Go Seller",
};
const DEFAULT_TEST_VARS_STRING = JSON.stringify(DEFAULT_TEST_VARS, null, 2);
const DEFAULT_TEST_RECIPIENT = import.meta.env.PUBLIC_TEST_EMAIL_TO ?? "";

const SCOPE = "global";
const KEY_PREFIX = "notifications.";

const getSettingKey = (id: string, locale: Locale) => `${KEY_PREFIX}${id}.${locale}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const buildDefaults = (locale: Locale): NotificationTemplate[] => {
  return TEMPLATE_META.map((meta) => {
    const defaults = DEFAULTS_BY_LOCALE[locale][meta.id];
    return {
      ...meta,
      enabled: defaults.enabled,
      recipients: defaults.recipients,
      subject: defaults.subject,
      body: defaults.body,
    };
  });
};

const coerceTemplate = (fallback: NotificationTemplate, item?: SettingItem): NotificationTemplate => {
  if (!item || !isRecord(item.value)) return fallback;

  return {
    ...fallback,
    enabled: typeof item.value.enabled === "boolean" ? item.value.enabled : fallback.enabled,
    recipients: typeof item.value.recipients === "string" ? item.value.recipients : fallback.recipients,
    subject: typeof item.value.subject === "string" ? item.value.subject : fallback.subject,
    body: typeof item.value.body === "string" ? item.value.body : fallback.body,
  };
};

export default function NotificationSettingsPage() {
  const [locale, setLocale] = useState<Locale>("id");
  const [templatesByLocale, setTemplatesByLocale] = useState<Record<Locale, NotificationTemplate[]>>({
    id: buildDefaults("id"),
    en: buildDefaults("en"),
  });
  const [savedByLocale, setSavedByLocale] = useState<Record<Locale, NotificationTemplate[]>>({
    id: buildDefaults("id"),
    en: buildDefaults("en"),
  });
  const [query, setQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<"all" | NotificationAudience>("all");
  const [selectedID, setSelectedID] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTemplate, setTestTemplate] = useState<NotificationTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState(DEFAULT_TEST_RECIPIENT);
  const [testVarsInput, setTestVarsInput] = useState(DEFAULT_TEST_VARS_STRING);
  const [testLocale, setTestLocale] = useState<Locale>(locale);
  const [testLoading, setTestLoading] = useState(false);
  const [testPreview, setTestPreview] = useState<TestNotificationResponse | null>(null);

  const templates = templatesByLocale[locale] || [];
  const savedTemplates = savedByLocale[locale] || [];

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedID) || null,
    [templates, selectedID],
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      if (audienceFilter !== "all" && item.audience !== audienceFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)
      );
    });
  }, [templates, query, audienceFilter]);

  const isDirty = useMemo(
    () => JSON.stringify(templates) !== JSON.stringify(savedTemplates),
    [templates, savedTemplates],
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await listSettings({ q: KEY_PREFIX, scope: SCOPE, page: 1, limit: 200 });
      const settingMap = new Map(res.data.map((item) => [item.key, item]));

      const nextByLocale: Record<Locale, NotificationTemplate[]> = {
        id: buildDefaults("id").map((template) =>
          coerceTemplate(template, settingMap.get(getSettingKey(template.id, "id"))),
        ),
        en: buildDefaults("en").map((template) =>
          coerceTemplate(template, settingMap.get(getSettingKey(template.id, "en"))),
        ),
      };

      setTemplatesByLocale(nextByLocale);
      setSavedByLocale(nextByLocale);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat notification settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    setTestLocale(locale);
  }, [locale]);

  const updateTemplate = (id: string, patch: Partial<NotificationTemplate>) => {
    setTemplatesByLocale((prev) => ({
      ...prev,
      [locale]: (prev[locale] || []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const resetChanges = () => {
    setTemplatesByLocale((prev) => ({
      ...prev,
      [locale]: savedByLocale[locale] || buildDefaults(locale),
    }));
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      await Promise.all(
        templates.map((template) =>
          upsertSetting(getSettingKey(template.id, locale), {
            scope: SCOPE,
            description: `${template.description} (${locale})`,
            value: {
              enabled: template.enabled,
              recipients: template.recipients,
              subject: template.subject,
              body: template.body,
              audience: template.audience,
              name: template.name,
            },
          }),
        ),
      );
      setSavedByLocale((prev) => ({
        ...prev,
        [locale]: templates,
      }));
      notifySuccess(`Notification templates (${locale}) tersimpan`);
      setSelectedID("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan notification settings");
    } finally {
      setSaving(false);
    }
  };

  const openTestModal = (template: NotificationTemplate) => {
    setTestTemplate(template);
    setTestPreview(null);
    setTestVarsInput(DEFAULT_TEST_VARS_STRING);
    setTestLocale(locale);
  };

  const closeTestModal = () => {
    setTestTemplate(null);
    setTestPreview(null);
    setTestLoading(false);
  };

  const handleSendTest = async () => {
    if (!testTemplate) return;
    const recipient = testRecipient.trim();
    if (!recipient) {
      notifyError("Recipient wajib diisi untuk test email");
      return;
    }
    let parsedVars: Record<string, string> = {};
    const trimmedVars = testVarsInput.trim();
    if (trimmedVars) {
      try {
        const parsed = JSON.parse(trimmedVars);
        if (!isRecord(parsed)) {
          throw new Error("Vars harus berupa objek JSON");
        }
        Object.entries(parsed).forEach(([key, value]) => {
          if (!key.trim()) return;
          parsedVars[key] = value === null ? "" : String(value);
        });
      } catch (err) {
        notifyError(err instanceof Error ? err.message : "Vars harus berupa objek JSON");
        return;
      }
    }

    setTestLoading(true);
    try {
      const response = await testNotificationTemplate(testTemplate.id, {
        to: recipient,
        locale: testLocale,
        vars: parsedVars,
      });
      setTestPreview(response);
      notifySuccess(`Test email terkirim ke ${response.sent_to}`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal mengirim test email");
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Notification Settings</h3>
          <p className="text-sm text-slate-600">Memuat konfigurasi notifikasi...</p>
        </div>
        <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
          <div className="space-y-3">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Notification Settings</h3>
          <p className="text-sm text-slate-600">Kelola template notifikasi per bahasa (id / en).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loading || saving}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={resetChanges}
            disabled={!isDirty || saving}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={saveTemplates}
            disabled={!isDirty || saving}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : `Save ${locale.toUpperCase()}`}
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value as Locale);
            setSelectedID("");
          }}
        >
          {LOCALES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search notification"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value as "all" | NotificationAudience)}
        >
          <option value="all">All audiences</option>
          <option value="admin">Admin</option>
          <option value="customer">Customer</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setAudienceFilter("all");
          }}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Reset Filter
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Email</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Audience</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Description</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Enabled</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  Tidak ada template yang cocok.
                </td>
              </tr>
            ) : (
              filteredTemplates.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.audience === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {item.audience}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.description}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.enabled}
                      onClick={() => updateTemplate(item.id, { enabled: !item.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        item.enabled ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          item.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openTestModal(item)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedID(item.id)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={Boolean(selected)}
        onClose={() => setSelectedID("")}
        title={selected ? `Manage (${locale.toUpperCase()}): ${selected.name}` : "Manage Notification"}
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectedID("")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveTemplates}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        {!selected ? null : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500">Recipients</p>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={selected.recipients}
                  onChange={(e) => updateTemplate(selected.id, { recipients: e.target.value })}
                  placeholder="admin@domain.com"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500">Status</p>
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {selected.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Email Subject</p>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={selected.subject}
                onChange={(e) => updateTemplate(selected.id, { subject: e.target.value })}
                placeholder="Subject email"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Email Body</p>
              <textarea
                className="min-h-[180px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={selected.body}
                onChange={(e) => updateTemplate(selected.id, { body: e.target.value })}
                placeholder="Body template"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">Available Placeholders</p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((token) => (
                  <span key={token} className="rounded bg-white px-2 py-1 text-xs text-slate-700 border border-slate-200">
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={Boolean(testTemplate)}
        onClose={closeTestModal}
        title={testTemplate ? `Test: ${testTemplate.name}` : "Test Notification"}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeTestModal}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testLoading || !testTemplate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {testLoading ? "Sending..." : "Send Test"}
            </button>
          </>
        }
      >
        {!testTemplate ? null : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase text-slate-500">Recipient</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="you@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase text-slate-500">Locale</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={testLocale}
                  onChange={(e) => setTestLocale(e.target.value as Locale)}
                >
                  {LOCALES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold uppercase text-slate-500">Template Variables (JSON)</span>
              <textarea
                className="h-[180px] w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                spellCheck={false}
                value={testVarsInput}
                onChange={(e) => setTestVarsInput(e.target.value)}
              />
              <p className="text-xs text-slate-500">Use placeholders: {placeholders.join(", ")}</p>
            </label>

            {testPreview ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Preview</p>
                <div>
                  <p className="text-xs font-semibold text-slate-600">Subject</p>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {testPreview.subject}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">Body</p>
                  <pre className="overflow-x-auto rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {testPreview.body}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">HTML Preview</p>
                  <div className="overflow-hidden rounded border border-slate-200 bg-white px-3 py-2">
                    <div
                      className="prose max-w-none text-slate-800"
                      dangerouslySetInnerHTML={{ __html: testPreview.html_body }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Sent to {testPreview.sent_to} at {testPreview.timestamp ? new Date(testPreview.timestamp).toLocaleString() : "unknown"}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
