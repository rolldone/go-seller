/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "../../../i18n";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { getCustomerProfile } from "../../customer/auth/authApi";
import { rememberCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";

type Props = {
  open: boolean;
  onClose: () => void;
  businessId: string;
  productId?: string | null;
  locale?: string;
};

const BASE = import.meta.env.PUBLIC_API_URL || "";

export default function SubscribeModal({ open, onClose, businessId, productId, locale }: Props) {
  const t = useTranslations("business", locale);
  const tAuth = useTranslations("auth", locale);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const profile = getCustomerProfile();
    if (profile && profile.email) {
      setEmail(profile.email || "");
      if (!autoSubmitted) {
        (async () => {
          setSubmitting(true);
          try {
            const body: Record<string, unknown> = {
              businessId,
              email: profile.email,
              consent,
              customerId: profile.id,
              customerLocale: locale || "id",
            };
            if (productId) body.productId = productId;

            const res = await fetch(`${BASE}/api/marketing/subscribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
              const message = payload?.error || payload?.message || `HTTP ${res.status}`;
              notifyError(message);
            } else {
              notifySuccess(t("subscribeSuccess", "Permintaan berlangganan berhasil. Periksa email untuk konfirmasi."));
              onClose();
            }
          } catch (err) {
            notifyError(err instanceof Error ? err.message : String(err));
          } finally {
            setSubmitting(false);
            setAutoSubmitted(true);
          }
        })();
      }
    } else {
      setEmail("");
      setAutoSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleLogin = () => {
    if (typeof window === "undefined") return;
    const loginUrl = rememberCustomerAuthNextPath(`${window.location.pathname}${window.location.search}`);
    window.location.href = loginUrl;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = String(email || "").trim();
    if (!trimmed) {
      notifyError(t("enterEmail", "Masukkan email"));
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const profile = getCustomerProfile();
      const body: Record<string, unknown> = {
        businessId,
        email: trimmed,
        consent: !!consent,
        customerLocale: locale || "id",
      };
      if (productId) body.productId = productId;
      if (profile && profile.id) body.customerId = profile.id;

      const res = await fetch(`${BASE}/api/marketing/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = payload?.error || payload?.message || `HTTP ${res.status}`;
        notifyError(message);
        return;
      }
      notifySuccess(t("subscribeSuccess", "Permintaan berlangganan berhasil. Periksa email untuk konfirmasi."));
      setEmail("");
      onClose();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const profile = getCustomerProfile();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[6vh] sm:items-center sm:pt-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t("subscribe", "Berlangganan")}</p>
            <h4 className="mt-1 text-lg font-bold text-slate-900">{t("subscribe", "Berlangganan")}</h4>
          </div>
          <button
            type="button"
            onClick={() => { if (!submitting) onClose(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 transition hover:bg-slate-100"
            aria-label={t("close", "Tutup")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {profile && profile.email ? (
            <div className="text-sm text-slate-700">
              {t("subscribedAs", "Terdaftar sebagai")} {profile.email}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-700">{t("loginToSubscribe", "Masuk untuk mendaftar otomatis")}</p>
              <button type="button" onClick={handleLogin} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">
                {tAuth("loginNow", "Masuk")}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">{t("emailLabel", "Email:")}</label>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder={t("subscribePlaceholder", "Masukkan email Anda")}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input id="consent" type="checkbox" checked={consent} onChange={() => setConsent(!consent)} className="h-4 w-4 rounded border-slate-300" />
            <label htmlFor="consent" className="text-sm text-slate-600">{t("subscribeConsent", "Saya setuju menerima email dari toko ini.")}</label>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { if (!submitting) onClose(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {t("close", "Tutup")}
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? t("subscribing", "Mengirim...") : t("subscribe", "Berlangganan")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
