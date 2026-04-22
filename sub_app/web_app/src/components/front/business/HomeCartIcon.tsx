/** @jsxRuntime classic */
import React, { useEffect, useRef, useState } from "react";
import { LoaderCircle, ShoppingBag } from "lucide-react";
import type { CustomerSession } from "../../../lib/customerSession";
import { getCustomerAuthToken, getCustomerProfile } from "../../customer/auth/authApi";
import { getMyCartBusinesses, type CartBusinessSummary } from "../../../lib/cartApi";
import { buildLocalizedPath, getLocaleFromPathname } from "../../../lib/siteLocale";
import { useTranslations } from "../../../i18n";
import { formatAmount } from "../../../lib/amountFormat";

interface HomeCartIconProps {
  customerSession?: CustomerSession | null;
  locale?: string;
  initialBusinesses?: CartBusinessSummary[];
}

function HomeCartRow({ entry }: { entry: CartBusinessSummary }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{entry.business_name || "Tanpa Nama Bisnis"}</div>
        <div className="text-xs text-slate-500">
          {entry.item_count} item · {entry.total_qty} qty
        </div>
      </div>
      <div className="text-right text-xs font-semibold text-slate-700">
        <div>{formatAmount(Math.max(0, Math.round(entry.total_amount)), { fractionDigits: 0 })}</div>
        <div className="text-[11px] font-medium text-emerald-600">Buka cart</div>
      </div>
    </div>
  );
}

export default function HomeCartIcon({ customerSession = null, locale, initialBusinesses = [] }: HomeCartIconProps) {
  const tCommon = useTranslations("common", locale);
  const tBusiness = useTranslations("business", locale);
  const [session, setSession] = useState<CustomerSession | null>(customerSession);
  const [businesses, setBusinesses] = useState<CartBusinessSummary[]>(() => initialBusinesses || []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hoveringPanel, setHoveringPanel] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPanel = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClosePanel = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      if (!hoveringPanel) {
        setOpen(false);
      }
    }, 350);
  };

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
    if (initialBusinesses.length > 0) {
      setBusinesses(initialBusinesses);
      setLoading(false);
      return;
    }

    if (!session?.authenticated && !getCustomerAuthToken()) {
      setBusinesses([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await getMyCartBusinesses();
        if (!cancelled) setBusinesses(rows || []);
      } catch {
        if (!cancelled) setBusinesses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialBusinesses, session?.authenticated]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [open]);

  const cartsHref = buildLocalizedPath("/carts", resolvedLocale);
  const cartBusinessCount = businesses.length;
  const totalQty = businesses.reduce((sum, entry) => sum + Number(entry.total_qty || 0), 0);

  return (
    <div
      className="relative group"
      ref={popupRef}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClosePanel}
    >
      <a
        href={cartsHref}
        aria-label={tBusiness("cart", "Keranjang")}
        title={tBusiness("cart", "Keranjang")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-emerald-600"
      >
        <span className="relative inline-flex">
          <ShoppingBag className="h-4.5 w-4.5" />
        </span>
      </a>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60"
          onMouseEnter={() => {
            setHoveringPanel(true);
            clearCloseTimer();
          }}
          onMouseLeave={() => {
            setHoveringPanel(false);
            scheduleClosePanel();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{tBusiness("cart", "Keranjang")}</div>
              <div className="text-xs text-slate-500">
                {loading
                  ? tCommon("loadingShort", "...")
                  : cartBusinessCount > 0
                    ? `${cartBusinessCount} bisnis · ${totalQty} qty`
                    : tBusiness("cartEmpty", "Keranjang masih kosong")}
              </div>
            </div>
            {cartBusinessCount > 0 ? (
              <div className="text-right text-xs text-slate-500">
                {tBusiness("total", "Total")}
                <div className="text-sm font-semibold text-slate-900">
                  {formatAmount(Math.max(0, Math.round(businesses.reduce((sum, entry) => sum + Number(entry.total_amount || 0), 0))), { fractionDigits: 0 })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                <LoaderCircle className="mr-2 inline-block h-4 w-4 animate-spin text-emerald-600" />
                {tBusiness("loading", "Memuat")}
              </div>
            ) : cartBusinessCount > 0 ? (
              businesses.map((entry) => <HomeCartRow key={entry.cart_id} entry={entry} />)
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                {tBusiness("cartEmpty", "Keranjang masih kosong")}
              </div>
            )}
          </div>

          <a
            href={cartsHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {tBusiness("openCart", "Buka Keranjang")}
          </a>
        </div>
      ) : null}
    </div>
  );
}