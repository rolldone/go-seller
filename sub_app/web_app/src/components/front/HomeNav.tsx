/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import type { CustomerSession } from "../../lib/customerSession";
import { getCustomerAuthToken, getCustomerProfile } from "../customer/auth/authApi";

interface HomeNavProps {
  variant?: "dark" | "light";
  customerSession?: CustomerSession | null;
}

export default function HomeNav({ variant = "dark", customerSession = null }: HomeNavProps) {
  const isLight = variant === "light";
  const [session, setSession] = useState<CustomerSession | null>(customerSession);

  useEffect(() => {
    if (session?.authenticated) return;
    const token = getCustomerAuthToken();
    if (!token) return;
    setSession({
      authenticated: true,
      accessToken: token,
      profile: getCustomerProfile(),
      expiresAt: null,
    });
  }, [session]);

  const isAuthenticated = Boolean(session?.authenticated);
  const customerName = session?.profile?.name || "Akun saya";

  return (
    <header className={[
      "flex items-center justify-between gap-4 pb-4",
      isLight ? "border-b border-slate-200" : "border-b border-white/10",
    ].join(" ")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle menu"
          className={[
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition",
            isLight
              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          <span className="space-y-1">
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
          </span>
        </button>

        <a href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-red-600 font-black text-white">
            GS
          </span>
          <span className={[
            "text-lg font-semibold tracking-tight",
            isLight ? "text-slate-900" : "text-white",
          ].join(" ")}>GoSeller</span>
        </a>
      </div>

      <nav className={[
        "hidden items-center gap-6 text-sm md:flex",
        isLight ? "text-slate-600" : "text-slate-300",
      ].join(" ")}>
        <a href="#" className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>For Enterprise</a>
        <a href="#" className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>API</a>
        <a href={isAuthenticated ? "/customer/dashboard" : "/customer/auth/login"} className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>
          {isAuthenticated ? customerName : "Sign in"}
        </a>
      </nav>

      <a
        href={isAuthenticated ? "/customer/auth/logout" : "/customer/auth/register"}
        className={[
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition",
          isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-blue-600 text-white hover:bg-blue-500",
        ].join(" ")}
      >
        {isAuthenticated ? "Logout" : "Get started"}
      </a>
    </header>
  );
}
