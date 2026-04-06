/** @jsxRuntime classic */
import React, { useState } from "react";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { customerAuthRequest } from "./authApi";
import { notifyError, notifySuccess } from "../../../lib/notification";

const getCustomerResetPageUrl = () => {
  const baseUrl = import.meta.env.PUBLIC_APP_URL?.replace(/\/+$/, "") || "";
  if (!baseUrl) return "/customer/auth/reset-password";
  return `${baseUrl}/customer/auth/reset-password`;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <a href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-xl font-bold text-transparent">
            GoSeller
          </span>
        </a>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          {!submitted ? (
            <>
              <h1 className="mb-1 text-2xl font-bold text-slate-900">Lupa Password</h1>
              <p className="mb-8 text-sm text-slate-500">
                Masukkan email Anda dan kami akan mengirimkan link untuk mereset password.
              </p>

              <form
                className="space-y-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  setLoading(true);
                  try {
                    await customerAuthRequest("/forgot-password", {
                      email,
                      reset_url: getCustomerResetPageUrl(),
                    });
                    setSubmitted(true);
                    notifySuccess("Jika akun ditemukan, email reset akan dikirim");
                  } catch (submitError) {
                    const message = submitError instanceof Error ? submitError.message : "Gagal mengirim link reset";
                    setError(message);
                    notifyError(message);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                </button>
              </form>
              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-900">Cek Email Anda</h2>
              <p className="text-sm text-slate-500">
                Kami telah mengirimkan link reset password ke <strong className="text-slate-700">{email}</strong>.
              </p>
            </div>
          )}
        </div>

        <a
          href="/customer/auth/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke halaman masuk
        </a>
      </div>
    </div>
  );
}
