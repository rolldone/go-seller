/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import {
  customerAuthRequest,
  getCustomerAuthToken,
  getCustomerMe,
  saveCustomerSession,
} from "./authApi";
import { buildCustomerAuthRegisterUrl, consumeCustomerAuthNextPath, resolveCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";
import { notifyError, notifySuccess } from "../../../lib/notification";

type LoginResponse = {
  access_token?: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        const target = consumeCustomerAuthNextPath(window.location.search) || "/customer/dashboard";
        window.location.replace(target);
      } catch {
        // Token exists but invalid/expired, stay on login page.
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
    setLoading(true);

    try {
      const payload = await customerAuthRequest<LoginResponse>("/login", { email, password });
      saveCustomerSession(payload);
      notifySuccess("Login berhasil");
      window.location.replace(consumeCustomerAuthNextPath(window.location.search) || "/customer/dashboard");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login gagal";
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="mb-1 text-2xl font-bold text-slate-900">Masuk</h1>
          <p className="mb-8 text-sm text-slate-500">Selamat datang kembali di GoSeller</p>

          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
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
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <a href="/customer/auth/forgot-password" className="text-xs text-emerald-600 hover:underline">
                  Lupa password?
                </a>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <a href={buildCustomerAuthRegisterUrl(nextPath)} className="font-semibold text-emerald-600 hover:underline">
            Daftar sekarang
          </a>
        </p>
      </div>
    </div>
  );
}
