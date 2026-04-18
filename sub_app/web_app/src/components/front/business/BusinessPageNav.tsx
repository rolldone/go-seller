/** @jsxRuntime classic */
import React, { useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, ShoppingBag } from "lucide-react";
import type { PublicBusiness } from "./types";
import type { CustomerSession } from "../../../lib/customerSession";
import { getCustomerAuthToken, getCustomerProfile } from "../../customer/auth/authApi";
import { getCartPreview, type CartPreview } from "../../../lib/cartApi";
import { buildLocalizedPath, getLocaleFromPathname } from "../../../lib/siteLocale";
import { useTranslations } from "../../../i18n";
import { formatAmount } from "../../../lib/amountFormat";

interface BusinessPageNavProps {
  business: PublicBusiness;
  customerSession?: CustomerSession | null;
  cartPreview?: CartPreview | null;
  locale?: string;
}

function NavIcon({ children, label, href }: { children: React.ReactNode; label: string; href?: string }) {
  const className = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-emerald-600";
  if (href) {
    return (
      <a href={href} aria-label={label} title={label} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" aria-label={label} className={className}>
      {children}
    </button>
  );
}

export default function BusinessPageNav({ business, customerSession = null, cartPreview = null, locale }: BusinessPageNavProps) {
  const tCommon = useTranslations("common", locale);
  const tBusiness = useTranslations("business", locale);
  const [session, setSession] = useState<CustomerSession | null>(customerSession);
  const [internalPreview, setInternalPreview] = useState<CartPreview | null>(null);
  const preview = cartPreview ?? internalPreview;
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewFetchKeyRef = useRef("");
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);

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

  useEffect(() => {
    if (cartPreview) {
      setInternalPreview(null);
      previewFetchKeyRef.current = "";
      return;
    }
    if (!business?.id) {
      setInternalPreview(null);
      previewFetchKeyRef.current = "";
      return;
    }
    if (!session?.authenticated && !getCustomerAuthToken()) {
      setInternalPreview(null);
      previewFetchKeyRef.current = "";
      return;
    }

    const fetchKey = business.id.trim();
    if (previewFetchKeyRef.current === fetchKey) {
      return;
    }
    previewFetchKeyRef.current = fetchKey;

    let cancelled = false;
    (async () => {
      try {
        const response = await getCartPreview(business.id, null);
        if (!cancelled) {
          setInternalPreview(response);
        }
      } catch {
        if (!cancelled) {
          setInternalPreview(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [business?.id, cartPreview, session?.authenticated]);

  const isAuthenticated = Boolean(session?.authenticated);
  const customerName = session?.profile?.name || tBusiness("myAccount", "Akun saya");
  const cartItemCount = preview?.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
  const cartPreviewItems = (preview?.items || []).slice(0, 3);
  const hasCartPreview = Boolean(preview && (preview.items?.length || 0) > 0);

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <a href={buildLocalizedPath("/", resolvedLocale)} className="inline-flex items-center gap-2 transition hover:opacity-80">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-xl font-bold text-transparent">
          {tCommon("goSeller", "GoSeller")}
        </span>
      </a>

      <div className="flex items-center justify-end gap-2">
        <div className="relative group" onMouseEnter={() => setPreviewOpen(true)} onMouseLeave={() => setPreviewOpen(false)}>
          <NavIcon label={tBusiness("cart", "Keranjang")} href={buildLocalizedPath(business?.slug ? `/b/${encodeURIComponent(business.slug)}/cart` : "/cart", resolvedLocale)}>
            <span className="relative inline-flex">
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1" />
                <circle cx="20" cy="20" r="1" />
                <path d="M1 1h4l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.7L23 6H6" />
              </svg>
              {cartItemCount > 0 ? (
                <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white shadow-sm">
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              ) : null}
            </span>
          </NavIcon>

          {previewOpen ? (
            <div className="absolute right-0 top-full z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{tBusiness("cart", "Keranjang")}</div>
                  <div className="text-xs text-slate-500">
                    {cartItemCount > 0 ? `${cartItemCount} ${tBusiness("itemsInCart", "item dalam keranjang")}` : tBusiness("cartEmpty", "Keranjang masih kosong")}
                  </div>
                </div>
                {preview?.grand_total ? (
                  <div className="text-right text-xs text-slate-500">
                    {tBusiness("total", "Total")}
                    <div className="text-sm font-semibold text-slate-900">
                      {formatAmount(Math.max(0, Math.round(preview.grand_total)), { fractionDigits: 0 })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                {hasCartPreview ? (
                  cartPreviewItems.map((item) => (
                    <div key={item.id || `${item.product_id}-${item.sku || item.variation_id || item.qty}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{item.product_name || tBusiness("product", "Produk")}</div>
                        <div className="text-xs text-slate-500">{tBusiness("quantityShort", "Qty")} {item.qty}</div>
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {formatAmount(Math.max(0, Math.round(item.net_total || item.line_total || 0)), { fractionDigits: 0 })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">{tBusiness("cartEmpty", "Keranjang masih kosong")}</div>
                )}
              </div>

              <a
                href={buildLocalizedPath(business?.slug ? `/b/${encodeURIComponent(business.slug)}/cart` : "/cart", resolvedLocale)}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {tBusiness("openCart", "Buka Keranjang")}
              </a>
            </div>
          ) : null}
        </div>

        <a
          href={buildLocalizedPath(isAuthenticated ? "/customer/dashboard" : "/customer/auth/login", resolvedLocale)}
          className="ml-1 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {isAuthenticated ? customerName : tCommon("signIn", "Login")}
        </a>
        {isAuthenticated ? (
          <a
            href={buildLocalizedPath("/customer/auth/logout", resolvedLocale)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {tCommon("logout", "Logout")}
          </a>
        ) : null}
      </div>
    </header>
  );
}