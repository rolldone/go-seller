/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import {
  customerAuthRequest,
  getCustomerAuthToken,
  getCustomerMe,
} from "./authApi";
import { buildCustomerAuthLoginUrl, resolveCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import { useTranslations } from "../../../i18n";
import { notifyError, notifySuccess } from "../../../lib/notification";

type RegisterResponse = {
  message?: string;
  verification_required?: boolean;
  customer?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

interface RegisterPageProps {
  locale?: string;
}

export default function RegisterPage({ locale }: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const nextPath = typeof window === "undefined" ? null : resolveCustomerAuthNextPath(window.location.search);
  const t = useTranslations("auth", locale);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!getCustomerAuthToken()) return;
      try {
        await getCustomerMe({ redirectOnUnauthorized: false });
        if (cancelled) return;
        window.location.replace(consumeCustomerAuthNextPath(window.location.search) || buildLocalizedPath("/customer/dashboard", locale));
      } catch {
        // Token exists but invalid/expired, stay on register page.
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const payload = await customerAuthRequest<RegisterResponse>("/register", {
        name,
        email,
        password,
      });
      const emailValue = email.trim().toLowerCase();
      setRegisteredEmail(emailValue);
      setSuccessMessage(payload.message || "Pendaftaran berhasil. Silakan cek email untuk verifikasi sebelum login.");
      setRegistrationComplete(true);
      notifySuccess(payload.message || "Pendaftaran berhasil. Silakan cek email untuk verifikasi sebelum login.");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Pendaftaran gagal";
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <a href={buildLocalizedPath("/", locale)} className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-xl font-bold text-transparent">
            {t("goSeller", "GoSeller")}
          </span>
        </a>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          {registrationComplete ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
                ✓
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Verifikasi Email</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Cek email kamu</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{successMessage}</p>
              {registeredEmail ? <p className="mt-2 text-sm text-slate-500">Email verifikasi dikirim ke {registeredEmail}.</p> : null}

              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                <a
                  href={buildCustomerAuthLoginUrl(nextPath)}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Ke halaman login
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationComplete(false);
                    setRegisteredEmail("");
                    setSuccessMessage("");
                    setName("");
                    setEmail("");
                    setPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Daftar akun lain
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-bold text-slate-900">{t("registerTitle", "Daftar Akun")}</h1>
              <p className="mb-8 text-sm text-slate-500">{t("registerSubtitle", "Mulai berbelanja di ribuan toko terpercaya")}</p>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("fullName", "Nama Lengkap")}
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("email", "Email")}
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("password", "Password")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("confirmPassword", "Konfirmasi Password")}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Memproses..." : t("createAccount", "Buat Akun")}
                </button>
              </form>

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            </>
          )}
        </div>

        {!registrationComplete ? (
          <p className="mt-5 text-center text-sm text-slate-500">
            {t("haveAccount", "Sudah punya akun?")} {" "}
            <a href={buildCustomerAuthLoginUrl(nextPath)} className="font-semibold text-emerald-600 hover:underline">
              {t("loginNow", "Masuk")}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
