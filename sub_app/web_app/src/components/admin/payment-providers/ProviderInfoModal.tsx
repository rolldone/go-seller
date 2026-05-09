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

export default function ProviderInfoModal({ open, provider, onClose }: Props) {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://your-domain.example";

  const providerKey = provider?.provider_key || "-";
  const webhookUrl = `${origin}/webhooks/payment/${providerKey}`;

  const cfg: Record<string, unknown> = (provider && (provider.config as Record<string, unknown>)) || {};
  const callbackFromConfig = typeof cfg.callback_url === "string" ? (cfg.callback_url as string) : "";

  const finishUrl = buildPaymentFinishUrl(origin);
  const unfinishUrl = fullUrl(origin, buildPaymentReturnPath("unfinish" as any));
  const errorUrl = fullUrl(origin, buildPaymentReturnPath("error" as any));
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">Provider Key: <span className="font-mono ml-2 rounded bg-white px-2 py-0.5 text-xs">{providerKey}</span></p>
          <p className="mt-2 text-xs text-slate-500">Gunakan informasi di bawah untuk mengisi pengaturan webhook / callback pada dashboard gateway.</p>
        </div>

        <div className="grid gap-3 grid-cols-1">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Webhook Endpoint</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{webhookUrl}</code>
              <button type="button" onClick={() => void copy(webhookUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Endpoint yang harus didaftarkan pada dashboard gateway (method: POST).</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Callback / Return URL</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{callbackUrl}</code>
              <button type="button" onClick={() => void copy(callbackUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">URL redirect selesai pembayaran (finish). Jika gateway punya field khusus, isi dengan nilai di atas.</p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Finish URL</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{finishUrl}</code>
              <button type="button" onClick={() => void copy(finishUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Unfinish URL</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{unfinishUrl}</code>
              <button type="button" onClick={() => void copy(unfinishUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-600">Error URL</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="break-words text-xs text-slate-700">{errorUrl}</code>
              <button type="button" onClick={() => void copy(errorUrl)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">Copy</button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Provider Notes</p>
          <div className="mt-2 text-xs text-slate-700">
            {provider?.provider_key === "xendit" ? (
              <>
                <p>Untuk Xendit, daftarkan <strong>Webhook Endpoint</strong> di dashboard Xendit.</p>
                <p className="mt-2">Xendit menggunakan header <code>x-callback-token</code> untuk verifikasi. Jika Anda memasukkan <strong>Webhook Token</strong> pada config provider, sistem akan memvalidasi header tersebut pada setiap webhook.</p>
                {cfg.webhook_token ? <p className="mt-2 text-xs text-slate-600">Contoh header: <code>x-callback-token: {String(cfg.webhook_token)}</code></p> : null}
              </>
            ) : provider?.provider_key === "midtrans" ? (
              <>
                <p>Midtrans mengirim signature di payload webhook (field <code>signature_key</code>).</p>
                <p className="mt-2">Pastikan URL webhook terdaftar dan dapat diakses dari internet. Sistem akan memverifikasi signature menggunakan server key Anda.</p>
              </>
            ) : provider?.provider_key === "duitku" ? (
              <>
                <p>Untuk Duitku, gunakan <strong>Callback URL</strong> untuk server-to-server notification dan <strong>Return URL</strong> untuk redirect pelanggan.</p>
                <p className="mt-2">Callback dikirim sebagai <code>POST x-www-form-urlencoded</code> dan signature diverifikasi dengan formula <code>MD5(merchantCode + amount + merchantOrderId + apiKey)</code>.</p>
                <p className="mt-2">Jika memakai hosted page Duitku, Anda bisa membiarkan payment method kosong di level metode pembayaran agar pelanggan memilih metode di halaman Duitku.</p>
              </>
            ) : provider?.provider_key === "tripay" ? (
              <>
                <p>Untuk Tripay, callback dikirim sebagai <code>POST application/json</code> dengan header <code>x-callback-signature</code>.</p>
                <p className="mt-2">Sistem memverifikasi signature callback dengan <code>HMAC-SHA256(raw_body, private_key)</code>.</p>
                <p className="mt-2">Request transaksi Tripay menggunakan signature <code>HMAC-SHA256(merchant_code + merchant_ref + amount, private_key)</code> dan method bisa dipilih di level payment method.</p>
              </>
            ) : provider?.provider_key === "ipaymu" ? (
              <>
                <p>Untuk iPaymu, request direct payment dikirim ke API iPaymu dengan header <code>va</code>, <code>signature</code>, dan <code>timestamp</code>.</p>
                <p className="mt-2">Callback iPaymu bisa berupa JSON atau form-urlencoded; signature callback diverifikasi menggunakan HMAC-SHA256 payload terurut (tanpa field <code>signature</code>) dengan secret VA.</p>
                <p className="mt-2">Isi <strong>Callback URL</strong> sebagai <code>notifyUrl</code> server-to-server, dan <strong>Return/Success/Cancel URL</strong> untuk redirect pelanggan.</p>
              </>
            ) : (
              <>
                <p>Daftarkan <strong>Webhook Endpoint</strong> dan <strong>Callback URL</strong> sesuai nilai di atas pada dashboard gateway.</p>
                <p className="mt-2">Jika gateway memerlukan token/header khusus, isi nilai tersebut pada bagian <em>Provider Config</em> di halaman edit provider.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
