/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import type { CustomerSession } from "../../lib/customerSession";
import { getCustomerAuthToken, getCustomerProfile } from "../customer/auth/authApi";
import { buildLocalizedPath, getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";

interface HomeNavProps {
  variant?: "dark" | "light";
  customerSession?: CustomerSession | null;
  locale?: string;
}

export default function HomeNav({ variant = "dark", customerSession = null, locale }: HomeNavProps) {
  const isLight = variant === "light";
  const [session, setSession] = useState<CustomerSession | null>(customerSession);
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);

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
  const customerName = session?.profile?.name || t("myAccount", "Akun saya");

  return (
    <header className={[
      "flex items-center justify-between gap-4 pb-4",
      isLight ? "border-b border-slate-200" : "border-b border-white/10",
    ].join(" ")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("menuToggle", "Toggle menu")}
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

        <a href={buildLocalizedPath("/", resolvedLocale)} className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-red-600 font-black text-white">
            {t("goSeller", "GoSeller")}
          </span>
          <span className={[
            "text-lg font-semibold tracking-tight",
            isLight ? "text-slate-900" : "text-white",
          ].join(" ")}>{t("goSeller", "GoSeller")}</span>
        </a>
      </div>

      <nav className={[
        "hidden items-center gap-6 text-sm md:flex",
        isLight ? "text-slate-600" : "text-slate-300",
      ].join(" ")}>
        <a href="#" className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>{t("forEnterprise", "For Enterprise")}</a>
        <a href="#" className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>{t("api", "API")}</a>
        <a href={buildLocalizedPath(isAuthenticated ? "/customer/dashboard" : "/customer/auth/login", resolvedLocale)} className={isLight ? "transition hover:text-slate-900" : "transition hover:text-white"}>
          {isAuthenticated ? customerName : t("signIn", "Sign in")}
        </a>
      </nav>

      <a
        href={buildLocalizedPath(isAuthenticated ? "/customer/auth/logout" : "/customer/auth/register", resolvedLocale)}
        className={[
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition",
          isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-blue-600 text-white hover:bg-blue-500",
        ].join(" ")}
      >
        {isAuthenticated ? t("logout", "Logout") : t("getStarted", "Get started")}
      </a>
    </header>
  );
}
