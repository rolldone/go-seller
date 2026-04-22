/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";
import { LoaderCircle, ShoppingBag, Store, Minus, Plus, Trash2, ChevronRight } from "lucide-react";
import Footer from "./Footer";
import BusinessPageNav from "./business/BusinessPageNav";
import { buildCustomerAuthLoginUrl } from "../../lib/customerAuthRedirect";
import { buildLocalizedPath, getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";
import { formatAmount } from "../../lib/amountFormat";
import type { CustomerSession } from "../../lib/customerSession";
import { getCustomerAuthToken } from "../customer/auth/authApi";
import {
  deleteMyCartItem,
  getCartPreview,
  getMyCart,
  getMyCartBusinesses,
  updateMyCartItem,
  type CartBusinessSummary,
  type CartItem,
  type CartPreview,
} from "../../lib/cartApi";

function resolveCartErrorMessage(error: unknown, fallback: string, context: "businesses" | "cart" | "update" | "remove"): string {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (message === "customer_unauthorized_redirect" || lower.includes("customer auth required") || lower.includes("invalid token")) {
    return fallback;
  }

  if (lower.includes("public_api_url")) {
    return "Konfigurasi API frontend belum tersedia.";
  }

  if (lower.startsWith("http ")) {
    return fallback;
  }

  if (context === "businesses" && lower.includes("network")) {
    return "Gagal memuat daftar bisnis. Coba lagi beberapa saat.";
  }

  if (context === "cart" && lower.includes("not found")) {
    return "Cart untuk bisnis ini belum ditemukan.";
  }

  if (context === "update") {
    if (lower.includes("not found")) return "Item cart tidak ditemukan.";
    return fallback;
  }

  if (context === "remove") {
    if (lower.includes("not found")) return "Item cart sudah tidak ada.";
    return fallback;
  }

  return message;
}

function toCurrency(value: number): string {
  return `Rp ${formatAmount(Math.max(0, Math.round(value)), { fractionDigits: 0 })}`;
}

function businessInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

interface BusinessCardProps {
  business: CartBusinessSummary;
  active: boolean;
  onClick: () => void;
}

function BusinessCard({ business, active, onClick }: BusinessCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        active
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400"
          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {businessInitials(business.business_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{business.business_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {business.item_count} item · {business.total_qty} qty
          </p>
        </div>
        <ChevronRight
          className={`ml-auto h-4 w-4 shrink-0 transition ${active ? "text-emerald-500" : "text-slate-300"}`}
        />
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-xs text-slate-500">Total</span>
        <span className="text-sm font-bold text-slate-900">{toCurrency(business.total_amount)}</span>
      </div>

      {active ? (
        <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          Cart aktif
        </span>
      ) : (
        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
          Buka cart
        </span>
      )}
    </button>
  );
}

interface CartItemRowProps {
  item: CartItem;
  mutating: boolean;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

function CartItemRow({ item, mutating, onUpdateQty, onRemove }: CartItemRowProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 items-center justify-center self-start overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-32">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.product_name || "Produk"}
              className="h-full w-full object-contain object-center"
              loading="lazy"
            />
          ) : (
            <span className="text-xs font-medium text-slate-400">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="whitespace-normal break-words text-base font-semibold text-slate-900">
            {item.product_name || "Produk"}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <Store className="h-3.5 w-3.5" />
            {item.business_name || "Merchant"}
          </p>
          {item.sku ? <p className="mt-0.5 text-xs text-slate-500">SKU: {item.sku}</p> : null}
          <p className="mt-3 text-sm font-bold text-slate-900">{toCurrency(item.unit_price)}</p>
          <p className="text-xs text-slate-500">Total item: {toCurrency(item.total_price)}</p>
        </div>

        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={mutating}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus
          </button>

          <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => onUpdateQty(item.id, -1)}
              disabled={mutating}
              className="px-3 py-2 text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Kurangi jumlah ${item.product_name || "produk"}`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-10 text-center text-sm font-semibold">{item.qty}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(item.id, 1)}
              disabled={mutating}
              className="px-3 py-2 text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Tambah jumlah ${item.product_name || "produk"}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

interface CartsPageProps {
  customerSession?: CustomerSession | null;
  locale?: string;
  initialBusinesses?: CartBusinessSummary[];
}

export default function CartsPage({ customerSession = null, locale, initialBusinesses = [] }: CartsPageProps) {
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  const requestedBusinessID = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("business_id")?.trim() || "" : "";
  const requestedBusinessSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("business_slug")?.trim() || "" : "";
  const [businesses, setBusinesses] = useState<CartBusinessSummary[]>(() => initialBusinesses || []);
  const [activeBusinessID, setActiveBusinessID] = useState(() => initialBusinesses[0]?.business_id || "");
  const [items, setItems] = useState<CartItem[]>([]);
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [mutatingID, setMutatingID] = useState("");
  const [error, setError] = useState("");

  const activeBusiness = useMemo(
    () => businesses.find((row) => row.business_id === activeBusinessID) || null,
    [businesses, activeBusinessID],
  );

  const rawSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total_price || item.unit_price * item.qty), 0),
    [items],
  );
  const subtotal = preview?.subtotal ?? rawSubtotal;
  const grandTotal = preview?.grand_total ?? subtotal;

  const currentUrl = () => {
    if (typeof window === "undefined") return buildLocalizedPath("/carts", resolvedLocale);
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  };

  const findRequestedBusinessID = (rows: CartBusinessSummary[]): string => {
    if (!rows.length) return "";
    const matchedByID = requestedBusinessID ? rows.find((row) => row.business_id === requestedBusinessID) : null;
    if (matchedByID) return matchedByID.business_id;
    const matchedBySlug = requestedBusinessSlug ? rows.find((row) => row.business_slug === requestedBusinessSlug) : null;
    if (matchedBySlug) return matchedBySlug.business_id;
    return rows[0]?.business_id || "";
  };

  const loadBusinesses = async () => {
    setError("");
    setLoadingBusinesses(true);
    try {
      const rows = await getMyCartBusinesses();
      setBusinesses(rows || []);
      setActiveBusinessID((prev) => {
        if (prev && rows.some((row) => row.business_id === prev)) return prev;
        return findRequestedBusinessID(rows);
      });
    } catch (loadError) {
      const message = resolveCartErrorMessage(loadError, t("loadCartFailed", "Gagal memuat cart"), "businesses");
      setError(message);
      setBusinesses([]);
      setActiveBusinessID("");
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const loadActiveCart = async (businessID: string | null) => {
    if (businessID === undefined) {
      setItems([]);
      setPreview(null);
      return;
    }
    setError("");
    setLoadingItems(true);
    try {
      const response = await getMyCart(businessID);
      setItems(response.items || []);
      try {
        const p = await getCartPreview(businessID, null);
        setPreview(p);
      } catch {
        setPreview(null);
      }
    } catch (loadError) {
      const message = resolveCartErrorMessage(loadError, t("loadCartFailed", "Gagal memuat cart"), "cart");
      setError(message);
      setItems([]);
      setPreview(null);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getCustomerAuthToken()) {
      window.location.replace(buildCustomerAuthLoginUrl(currentUrl()));
      return;
    }
    void loadBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeBusinessID) {
      void loadActiveCart(activeBusinessID);
      return;
    }
    if (!loadingBusinesses) {
      void loadActiveCart(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessID, loadingBusinesses]);

  const refreshActiveBusinessSummary = async () => {
    try {
      const rows = await getMyCartBusinesses();
      setBusinesses(rows || []);
      if (!rows.some((row) => row.business_id === activeBusinessID)) {
        setActiveBusinessID(rows[0]?.business_id || "");
      }
    } catch {
      // keep existing summary UI when refresh fails
    }
  };

  const handleUpdateQty = async (itemID: string, delta: number) => {
    const currentItem = items.find((item) => item.id === itemID);
    if (!currentItem) return;
    const nextQty = Math.max(1, currentItem.qty + delta);

    setMutatingID(itemID);
    setError("");
    try {
      const result = await updateMyCartItem(itemID, nextQty);
      setItems(result.items || []);
      try {
        const p = await getCartPreview(activeBusinessID || null, null);
        setPreview(p);
      } catch {
        setPreview(null);
      }
      if (activeBusinessID) {
        await refreshActiveBusinessSummary();
      }
    } catch (updateError) {
      const message = resolveCartErrorMessage(updateError, "Gagal mengubah jumlah item", "update");
      setError(message);
    } finally {
      setMutatingID("");
    }
  };

  const handleRemove = async (itemID: string) => {
    setMutatingID(itemID);
    setError("");
    try {
      const result = await deleteMyCartItem(itemID);
      setItems(result.items || []);
      try {
        const p = await getCartPreview(activeBusinessID || null, null);
        setPreview(p);
      } catch {
        setPreview(null);
      }
      if (activeBusinessID) {
        await refreshActiveBusinessSummary();
      }
    } catch (deleteError) {
      const message = resolveCartErrorMessage(deleteError, "Gagal menghapus item", "remove");
      setError(message);
    } finally {
      setMutatingID("");
    }
  };

  const cartHref = activeBusiness?.business_slug
    ? buildLocalizedPath(`/b/${activeBusiness.business_slug}/cart`, resolvedLocale)
    : buildLocalizedPath("/cart", resolvedLocale);

  const businessHomeHref = activeBusiness?.business_slug
    ? buildLocalizedPath(`/b/${activeBusiness.business_slug}`, resolvedLocale)
    : buildLocalizedPath("/", resolvedLocale);

  const navBusiness = {
    id: activeBusiness?.business_id || "",
    name: activeBusiness?.business_name || "Keranjang",
    slug: activeBusiness?.business_slug || "",
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <BusinessPageNav business={navBusiness} customerSession={customerSession} locale={resolvedLocale} cartPreview={preview} />

        <section className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {t("cartTitle", "Keranjang Belanja")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("cartSubtitle", "Periksa item kamu sebelum lanjut ke checkout.")}
            </p>
          </div>
          <a
            href={businessHomeHref}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("continueShopping", "Lanjut Belanja")}
          </a>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("selectBusinessLabel", "Pilih bisnis")}
              </p>
              <p className="text-xs text-slate-400 md:hidden">
                {t("scrollHint", "Geser untuk melihat bisnis lain")}
              </p>
            </div>

            {loadingBusinesses ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                <div className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" />
                  {t("loadingCart", "Memuat cart...")}
                </div>
              </section>
            ) : businesses.length === 0 ? (
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {t("globalCart", "Keranjang umum")}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {t("globalCartSubtitle", "Belum ada cart per bisnis, ini cart default kamu.")}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {items.length} {t("itemLabel", "item")}
                    </span>
                  </div>
                </section>

                {loadingItems ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                    <div className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" />
                      {t("loadingCart", "Memuat cart...")}
                    </div>
                  </section>
                ) : items.length === 0 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <ShoppingBag className="h-7 w-7" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                      {t("emptyCartTitle", "Keranjang kamu masih kosong")}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("emptyCartSubtitle", "Yuk jelajahi produk terbaik dari merchant favoritmu.")}
                    </p>
                    <a
                      href={buildLocalizedPath("/", resolvedLocale)}
                      className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {t("browseProducts", "Cari Produk")}
                    </a>
                  </section>
                ) : (
                  items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      mutating={mutatingID === item.id}
                      onUpdateQty={handleUpdateQty}
                      onRemove={handleRemove}
                    />
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="relative max-w-full min-w-0">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#f7f7f5] to-transparent md:w-12" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#f7f7f5] to-transparent md:w-12" />
                  <div className="max-w-full min-w-0 overflow-x-auto overflow-y-hidden pb-3">
                    <div className="flex w-max min-w-full snap-x snap-mandatory gap-3 pr-1">
                      {businesses.map((business) => (
                        <div key={business.business_id} className="w-[252px] shrink-0 snap-start sm:w-[272px]">
                          <BusinessCard
                            business={business}
                            active={activeBusinessID === business.business_id}
                            onClick={() => setActiveBusinessID(business.business_id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {activeBusiness ? (
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      <Store className="h-3.5 w-3.5 text-emerald-500" />
                      {activeBusiness.business_name}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                ) : null}

                {loadingItems ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                    <div className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" />
                      {t("loadingCart", "Memuat cart...")}
                    </div>
                  </section>
                ) : items.length === 0 ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <ShoppingBag className="h-7 w-7" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                      {t("emptyCartTitle", "Keranjang kamu masih kosong")}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("emptyCartSubtitle", "Yuk jelajahi produk terbaik dari merchant favoritmu.")}
                    </p>
                    <a
                      href={businessHomeHref}
                      className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {t("browseProducts", "Cari Produk")}
                    </a>
                  </section>
                ) : (
                  items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      mutating={mutatingID === item.id}
                      onUpdateQty={handleUpdateQty}
                      onRemove={handleRemove}
                    />
                  ))
                )}
              </>
            )}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <h2 className="text-lg font-bold text-slate-900">
              {t("cartSummaryTitle", "Ringkasan Belanja")}
            </h2>

            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              {activeBusiness?.business_name || "-"}
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>
                  {t("subtotal", "Subtotal")} ({items.length} {t("itemLabel", "item")})
                </span>
                <span className="font-medium text-slate-900">{toCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>{t("shipping", "Ongkos kirim")}</span>
                <span className="text-xs italic">{t("calculatedAtCheckout", "Dihitung saat checkout")}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{t("totalLabel", "Total")}</span>
                <span className="text-lg font-bold text-slate-900">{toCurrency(grandTotal)}</span>
              </div>
            </div>

            <a
              href={cartHref}
              className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                activeBusiness
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "pointer-events-none bg-slate-300"
              }`}
            >
              {t("continueCheckout", "Lanjut Checkout")}
            </a>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
