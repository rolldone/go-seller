import React from "react";
import AdminModal from "../ui/AdminModal";
import type { PaymentProvider } from "./types";
import { buildPaymentFinishUrl, buildPaymentReturnPath } from "../../../lib/paymentRedirect";
import { notifyError, notifySuccess } from "../../../lib/notification";

type Props = {
  open: boolean;
  provider?: PaymentProvider | null;
  onClose: () => void;
};

function fullUrl(origin: string, path: string) {
  try {
    return new URL(path, origin).toString();
  } catch {
    return origin + path;
  }
}

function resolveServiceApiBase(): string {
  const envApi = (import.meta.env.PUBLIC_API_URL ?? "").toString().trim();
  if (envApi) {
    return envApi.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "https://your-service-api.example";
}

function resolveWebAppBase(): string {
  const envApp = (import.meta.env.PUBLIC_APP_URL ?? "").toString().trim();
  if (envApp) {
    return envApp.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "https://your-web-app.example";
}

export default function ProviderInfoModal({ open, provider, onClose }: Props) {
  const serviceApiBase = resolveServiceApiBase();
  const webAppBase = resolveWebAppBase();

  const providerKey = provider?.provider_key || "-";
  const webhookUrl = `${serviceApiBase}/webhooks/payment/${providerKey}`;

  const cfg: Record<string, unknown> = (provider && (provider.config as Record<string, unknown>)) || {};
  const callbackFromConfig = typeof cfg.callback_url === "string" ? (cfg.callback_url as string) : "";

  const finishUrl = buildPaymentFinishUrl(webAppBase);
  const unfinishUrl = fullUrl(webAppBase, buildPaymentReturnPath("unfinish" as any));
  const errorUrl = fullUrl(webAppBase, buildPaymentReturnPath("error" as any));
  const callbackUrl = callbackFromConfig || finishUrl;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess("Copied to clipboard");
    } catch (err) {
      notifyError("Failed to copy");
    }
  };

  return (
    <AdminModal open={open} onClose={onClose} title={provider ? `Provider Info — ${provider.name}` : "Provider Info"} maxWidth="2xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">Provider Key: <span className="font-mono ml-2 rounded bg-white px-2 py-0.5 text-xs">{providerKey}</span></p>
          <p className="mt-2 text-xs text-slate-500">Instruksi untuk mengintegrasikan payment gateway. Setiap endpoint jelas menunjukkan tujuannya (Service API vs Web App).</p>
        </div>

        {/* SERVICE API ENDPOINTS */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">📡 Service API — Backend Integration</p>
          <p className="mt-1 text-xs text-emerald-800">Endpoint di bawah digunakan oleh backend Anda untuk menerima webhook/callback dari provider.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Webhook Endpoint (POST)</p>
          <p className="mt-1 text-xs text-slate-500">Backend akan terima callback di endpoint ini.</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <code className="break-words text-xs text-slate-700">{webhookUrl}</code>
            <button type="button" onClick={() => void copy(webhookUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">✓ Daftarkan di dashboard {providerKey.toUpperCase()} sebagai Webhook/Callback URL</p>
        </div>

        {/* WEB APP ENDPOINTS */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-900">🌐 Web App — Redirect User</p>
          <p className="mt-1 text-xs text-blue-800">Endpoint di bawah digunakan untuk redirect user setelah proses payment (selesai/gagal/pending).</p>
        </div>

        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Finish URL (Success)</p>
            <p className="mt-1 text-xs text-slate-500">User redirect ke halaman ini jika pembayaran berhasil.</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{finishUrl}</code>
              <button type="button" onClick={() => void copy(finishUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Unfinish URL (Pending)</p>
            <p className="mt-1 text-xs text-slate-500">User redirect ke halaman ini jika pembayaran pending atau user kembali tanpa input data.</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{unfinishUrl}</code>
              <button type="button" onClick={() => void copy(unfinishUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Error URL (Gagal)</p>
            <p className="mt-1 text-xs text-slate-500">User redirect ke halaman ini jika pembayaran gagal atau error.</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{errorUrl}</code>
              <button type="button" onClick={() => void copy(errorUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>
        </div>

        {/* FIELD MAPPING */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-900">⚙️ Config Field Mapping</p>
          <div className="mt-2 text-xs text-orange-900 space-y-1">
            {provider?.provider_key === "xendit" ? (
              <>
                <p><span className="font-semibold">Callback URL:</span> field <code>callback_url</code> → gunakan Webhook Endpoint (Service API)</p>
              </>
            ) : provider?.provider_key === "midtrans" ? (
              <>
                <p><span className="font-semibold">Webhook URL:</span> daftarkan Webhook Endpoint (Service API) di Midtrans dashboard</p>
              </>
            ) : provider?.provider_key === "duitku" ? (
              <>
                <p><span className="font-semibold">Callback URL:</span> field <code>callback_url</code> → gunakan Webhook Endpoint (Service API)</p>
                <p><span className="font-semibold">Return URL:</span> field <code>return_url</code> → gunakan Finish URL (Web App) atau URL custom</p>
              </>
            ) : provider?.provider_key === "tripay" ? (
              <>
                <p><span className="font-semibold">Callback URL:</span> field <code>callback_url</code> → gunakan Webhook Endpoint (Service API)</p>
                <p><span className="font-semibold">Return URL:</span> field <code>return_url</code> → gunakan Finish URL (Web App) atau URL custom</p>
              </>
            ) : provider?.provider_key === "ipaymu" ? (
              <>
                <p><span className="font-semibold">Callback URL:</span> field <code>callback_url</code> → gunakan Webhook Endpoint (Service API) sebagai <code>notifyUrl</code></p>
                <p><span className="font-semibold">Return URL:</span> field <code>return_url</code> → gunakan Finish URL (Web App)</p>
                <p><span className="font-semibold">Success URL:</span> field <code>success_url</code> → gunakan Finish URL (Web App)</p>
                <p><span className="font-semibold">Cancel URL:</span> field <code>cancel_url</code> → gunakan Error URL (Web App)</p>
              </>
            ) : (
              <>
                <p><span className="font-semibold">Callback URL:</span> gunakan Webhook Endpoint (Service API)</p>
                <p><span className="font-semibold">Return URL:</span> gunakan Finish/Unfinish/Error URL sesuai kebutuhan (Web App)</p>
              </>
            )}
          </div>
        </div>

        {/* PROVIDER NOTES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Provider-Specific Notes</p>
          <div className="mt-2 text-xs text-slate-700 space-y-2">
            {provider?.provider_key === "xendit" ? (
              <>
                <p>• Webhook signature divalidasi melalui header <code>x-callback-token</code></p>
                <p>• Pastikan <code>webhook_token</code> disimpan di config provider</p>
              </>
            ) : provider?.provider_key === "midtrans" ? (
              <>
                <p>• Webhook signature divalidasi di payload dengan field <code>signature_key</code></p>
                <p>• Backend akan gunakan <code>server_key</code> untuk verifikasi</p>
              </>
            ) : provider?.provider_key === "duitku" ? (
              <>
                <p>• Callback format: <code>POST x-www-form-urlencoded</code></p>
                <p>• Signature: <code>MD5(merchantCode + amount + merchantOrderId + apiKey)</code></p>
                <p>• Jika pakai hosted page Duitku, biarkan payment method kosong agar user pilih di halaman Duitku</p>
              </>
            ) : provider?.provider_key === "tripay" ? (
              <>
                <p>• Callback format: <code>POST application/json</code></p>
                <p>• Signature header: <code>x-callback-signature = HMAC-SHA256(raw_body, private_key)</code></p>
                <p>• Request signature: <code>HMAC-SHA256(merchant_code + merchant_ref + amount, private_key)</code></p>
              </>
            ) : provider?.provider_key === "ipaymu" ? (
              <>
                <p>• Callback format: JSON atau <code>application/x-www-form-urlencoded</code></p>
                <p>• Callback signature: HMAC-SHA256 payload terurut (tanpa field <code>signature</code>) dengan secret VA</p>
                <p>• Request signature: HMAC-SHA256 over <code>METHOD:VA:sha256(body):api_key</code></p>
              </>
            ) : (
              <>
                <p>• Daftarkan Webhook Endpoint dan URL redirect sesuai kebutuhan di dashboard gateway</p>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
