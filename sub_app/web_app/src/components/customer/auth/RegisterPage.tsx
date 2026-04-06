/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import {
  customerAuthRequest,
  getCustomerAuthToken,
  getCustomerMe,
  saveCustomerSession,
} from "./authApi";
import { buildCustomerAuthLoginUrl, consumeCustomerAuthNextPath, resolveCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";
import { notifyError, notifySuccess } from "../../../lib/notification";

type RegisterResponse = {
  access_token?: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nextPath = typeof window === "undefined" ? null : resolveCustomerAuthNextPath(window.location.search);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!getCustomerAuthToken()) return;
      try {
        await getCustomerMe({ redirectOnUnauthorized: false });
        if (cancelled) return;
        window.location.replace(consumeCustomerAuthNextPath(window.location.search) || "/customer/dashboard");
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
      saveCustomerSession(payload);
      notifySuccess("Akun berhasil dibuat");
      window.location.replace(consumeCustomerAuthNextPath(window.location.search) || "/customer/dashboard");
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
          <h1 className="mb-1 text-2xl font-bold text-slate-900">Daftar Akun</h1>
          <p className="mb-8 text-sm text-slate-500">Mulai berbelanja di ribuan toko terpercaya</p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Lengkap
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
                Email
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
                Password
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
                Konfirmasi Password
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
              {loading ? "Memproses..." : "Buat Akun"}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <a href={buildCustomerAuthLoginUrl(nextPath)} className="font-semibold text-emerald-600 hover:underline">
            Masuk
          </a>
        </p>
      </div>
    </div>
  );
}
