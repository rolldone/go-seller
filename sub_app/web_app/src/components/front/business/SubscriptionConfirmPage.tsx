/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useTranslations } from "../../../i18n";
import { buildLocalizedPath } from "../../../lib/siteLocale";

type Props = {
  locale?: string;
};

type ConfirmState = "loading" | "success" | "error";

const API_BASE = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

export default function SubscriptionConfirmPage({ locale }: Props) {
  const t = useTranslations("business", locale);
  const [state, setState] = useState<ConfirmState>("loading");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken((params.get("token") || "").trim());
  }, []);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage(t("subscriptionConfirmMissingToken", "Token konfirmasi tidak tersedia."));
      return;
    }

    if (!API_BASE) {
      setState("error");
      setMessage(t("subscriptionConfirmApiUnavailable", "Layanan konfirmasi belum tersedia."));
      return;
    }

    const controller = new AbortController();

    async function confirmSubscription() {
      setState("loading");
      setMessage("");
      try {
        const response = await fetch(`${API_BASE}/api/marketing/confirm?token=${encodeURIComponent(token)}`, {
          method: "GET",
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          setState("error");
          setMessage(text.trim() || t("subscriptionConfirmInvalidToken", "Token konfirmasi tidak valid atau sudah kedaluwarsa."));
          return;
        }

        setState("success");
        setMessage(t("subscriptionConfirmSuccessBody", "Langganan berhasil dikonfirmasi. Kamu akan menerima email sesuai preferensi toko ini."));
      } catch (err) {
        if (controller.signal.aborted) return;
        const text = err instanceof Error ? err.message : String(err);
        setState("error");
        setMessage(text || t("subscriptionConfirmInvalidToken", "Token konfirmasi tidak valid atau sudah kedaluwarsa."));
      }
    }

    confirmSubscription();
    return () => controller.abort();
  }, [token, locale]);

  const handleRetry = () => {
    if (typeof window === "undefined") return;
    window.location.reload();
  };

  const handleBackHome = () => {
    if (typeof window === "undefined") return;
    window.location.href = buildLocalizedPath("/", locale);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,#f7f7f5_0%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center py-10">
        <a href={buildLocalizedPath("/", locale)} className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-xl font-bold text-transparent">Go Seller</span>
        </a>

        <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${
                state === "success"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                  : state === "error"
                    ? "border-rose-100 bg-rose-50 text-rose-600"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {state === "success" ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : state === "error" ? (
                <AlertCircle className="h-8 w-8" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin" />
              )}
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              {t("subscriptionConfirmEyebrow", "Subscription Confirmation")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {state === "success"
                ? t("subscriptionConfirmSuccessTitle", "Langganan berhasil dikonfirmasi")
                : state === "error"
                  ? t("subscriptionConfirmErrorTitle", "Konfirmasi gagal")
                  : t("subscriptionConfirmLoadingTitle", "Memverifikasi langganan")}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              {state === "loading"
                ? t("subscriptionConfirmLoadingBody", "Sedang memeriksa token konfirmasi. Tunggu sebentar ya.")
                : message || t("subscriptionConfirmSuccessBody", "Langganan berhasil dikonfirmasi.")}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {state === "error" ? (
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("subscriptionConfirmRetry", "Coba lagi")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleBackHome}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("subscriptionConfirmBackHome", "Kembali ke beranda")}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            {t(
              "subscriptionConfirmHelp",
              "Jika kamu masih melihat halaman ini setelah sukses, silakan buka kembali email dan refresh halaman.",
            )}
          </div>
        </div>
      </div>
    </div>
  );
}