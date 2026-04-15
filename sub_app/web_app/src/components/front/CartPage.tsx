/** @jsxRuntime classic */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import Footer from "./Footer";
import BusinessPageNav from "./business/BusinessPageNav";
import { buildCustomerAuthLoginUrl } from "../../lib/customerAuthRedirect";
import { buildLocalizedPath, getLocaleFromPathname } from "../../lib/siteLocale";
import { getCustomerAuthToken, listMyCustomerAddresses, type CustomerAddress } from "../customer/auth/authApi";
import {
  addMyCartItem,
  checkoutMyCart,
  deleteMyCartItem,
  getMyCart,
  getCartPreview,
  updateMyCartItem,
  type Cart,
  type CartItem,
  type CartPreview,
} from "../../lib/cartApi";
import type { CustomerSession } from "../../lib/customerSession";
import type { PublicBusiness } from "./business/types";
import { useTranslations } from "../../i18n";

function toCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

function formatTaxPercent(rate?: number | null): string {
  if (!rate || rate <= 0) return "0%";
  const normalized = rate <= 1 ? rate * 100 : rate;
  const rounded = Math.round(normalized * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

function formatTaxMode(taxType?: string | null, taxRate?: number | null, includeLabel = "Include", excludeLabel = "Exclude"): string {
  const mode = String(taxType || "").toLowerCase() === "include" ? includeLabel : excludeLabel;
  return `${mode} ${formatTaxPercent(taxRate)}`;
}

interface CartPageProps {
  customerSession?: CustomerSession | null;
  business?: PublicBusiness | null;
  locale?: string;
}

export default function CartPage({ customerSession = null, business = null, locale }: CartPageProps) {
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  const [cart, setCart] = useState<Cart | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingID, setMutatingID] = useState("");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressID, setSelectedAddressID] = useState("");
  const didAutoAdd = useRef(false);

  const currentSearchParams = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const businessSlugFromQuery = currentSearchParams?.get("business_slug")?.trim() || "";
  const activeBusinessSlug = (businessSlugFromQuery || business?.slug || "").trim();
  const businessHomeHref = activeBusinessSlug ? `/b/${encodeURIComponent(activeBusinessSlug)}` : "/";
  const activeBusinessID = business?.id?.trim() || currentSearchParams?.get("business_id")?.trim() || "";
  const productID = currentSearchParams?.get("product_id")?.trim() || "";
  const businessID = activeBusinessID;
  const productName = currentSearchParams?.get("product_name")?.trim() || "";
  const businessName = currentSearchParams?.get("business_name")?.trim() || "";
  const variationID = currentSearchParams?.get("variation_id")?.trim() || "";
  const sku = currentSearchParams?.get("sku")?.trim() || "";
  const imageUrl = currentSearchParams?.get("image_url")?.trim() || "";
  const qtyFromQuery = Number(currentSearchParams?.get("qty") || "1");
  const unitPriceFromQuery = Number(currentSearchParams?.get("unit_price") || "0");

  const currentUrl = () => {
    if (typeof window === "undefined") return businessHomeHref;
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  };

  const clearQueryParams = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  };

  const loadCart = async (targetBusinessID?: string | null) => {
    setError("");
    setLoading(true);
    try {
      const response = await getMyCart(targetBusinessID || null);
      setCart(response.cart);
      setItems(response.items || []);
      try {
        const p = await getCartPreview(targetBusinessID || null, null);
        setPreview(p);
      } catch (err) {
        // preview is non-fatal for cart display
        setPreview(null);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t("loadCartFailed", "Gagal memuat cart");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!getCustomerAuthToken()) {
      window.location.replace(buildCustomerAuthLoginUrl(currentUrl()));
      return;
    }

    void loadCart(businessID || null);
    void (async () => {
      try {
        const rows = await listMyCustomerAddresses();
        setAddresses(rows);
        const primary = rows.find((item) => item.is_primary) || rows[0] || null;
        setSelectedAddressID(primary?.id || "");
      } catch {
        setAddresses([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getCustomerAuthToken() || !productID || didAutoAdd.current) return;
    didAutoAdd.current = true;

    (async () => {
      try {
        const result = await addMyCartItem({
          product_id: productID,
          product_name: productName || productID,
          business_id: businessID || null,
          business_name: businessName || undefined,
          variation_id: variationID || null,
          sku: sku || null,
          image_url: imageUrl || null,
          qty: Number.isFinite(qtyFromQuery) && qtyFromQuery > 0 ? qtyFromQuery : 1,
          unit_price: Number.isFinite(unitPriceFromQuery) && unitPriceFromQuery > 0 ? unitPriceFromQuery : 0,
        });
        setCart(result.cart);
        setItems(result.items || []);
        try {
          const p2 = await getCartPreview(businessID || null, null);
          setPreview(p2);
        } catch (err) {
          setPreview(null);
        }
        clearQueryParams();
      } catch (addError) {
        const message = addError instanceof Error ? addError.message : t("addItemFailed", "Gagal menambahkan item ke cart");
        setError(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productID]);

  const updateQty = async (itemID: string, delta: number) => {
    const currentItem = items.find((item) => item.id === itemID);
    if (!currentItem) return;
    const nextQty = Math.max(1, currentItem.qty + delta);

    setMutatingID(itemID);
    setError("");
    try {
      const result = await updateMyCartItem(itemID, nextQty);
      setCart(result.cart);
      setItems(result.items || []);
      try {
        const p2 = await getCartPreview(businessID || null, couponCode || null);
        setPreview(p2);
      } catch (err) {
        setPreview(null);
      }
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Gagal mengubah jumlah item";
      setError(message);
    } finally {
      setMutatingID("");
    }
  };

  const removeItem = async (itemID: string) => {
    setMutatingID(itemID);
    setError("");
    try {
      const result = await deleteMyCartItem(itemID);
      setCart(result.cart);
      setItems(result.items || []);
      try {
        const p2 = await getCartPreview(businessID || null, couponCode || null);
        setPreview(p2);
      } catch (err) {
        setPreview(null);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Gagal menghapus item";
      setError(message);
    } finally {
      setMutatingID("");
    }
  };

  const rawSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total_price || item.unit_price * item.qty), 0),
    [items],
  );
  const displaySubtotal = preview?.subtotal ?? rawSubtotal;
  const displayGrand = preview?.grand_total ?? rawSubtotal;
  const previewItemsByID = useMemo(
    () => Object.fromEntries((preview?.items || []).map((item) => [item.id || "", item])),
    [preview?.items],
  );
  const taxIncludeLabel = t("taxInclude", "Include");
  const taxExcludeLabel = t("taxExclude", "Exclude");
  const taxGroups = useMemo(() => {
    const groups = new Map<string, { taxType: string; taxRate: number; amount: number }>();
    for (const item of preview?.items || []) {
      const taxType = String(item.tax_type || "exclude").toLowerCase() === "include" ? "include" : "exclude";
      const taxRate = Number(item.tax_rate || 0);
      const key = `${taxType}:${taxRate.toFixed(4)}`;
      const current = groups.get(key) || { taxType, taxRate, amount: 0 };
      current.amount += Number(item.tax_amount || 0);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate || a.taxType.localeCompare(b.taxType));
  }, [preview?.items]);

  const handleCheckout = async () => {
    if (!selectedAddressID) {
      setError(t("selectShippingAddressFirst", "Pilih alamat pengiriman terlebih dahulu."));
      return;
    }
    setSubmittingCheckout(true);
    setError("");
    try {
      const appliedCouponCode = preview?.applied_coupons?.[0]?.code?.trim() || couponCode.trim() || null;
      const order = await checkoutMyCart("IDR", businessID || null, appliedCouponCode, selectedAddressID || null);
      const orderID = typeof order === "object" && order && "id" in order ? String((order as { id?: string }).id || "") : "";
      if (typeof window !== "undefined") {
        if (orderID) {
          window.sessionStorage.setItem(
            `post_checkout_notice:${orderID}`,
            t("postCheckoutNotice", "Terima kasih, pesanan Anda sudah kami terima. Tim kami akan menghubungi Anda via WhatsApp untuk konfirmasi ongkir dan total pembayaran."),
          );
        }
        window.location.href = orderID ? `/order/${encodeURIComponent(orderID)}` : "/order/confirmed";
      }
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : t("checkoutCartFailed", "Gagal checkout cart");
      setError(message);
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const displayMerchant = items[0]?.business_name || cart?.business_id || t("merchant", "Merchant");
  const checkoutLabel = productID ? (currentSearchParams?.get("intent") === "buy_now" ? t("buyNow", "Beli Sekarang") : t("continueCheckout", "Lanjut Checkout")) : t("continueCheckout", "Lanjut Checkout");

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <BusinessPageNav
          business={{
            id: business?.id || cart?.business_id || "",
            name: business?.name || displayMerchant,
            slug: activeBusinessSlug || business?.slug || "",
          }}
          customerSession={customerSession}
          cartPreview={preview}
        />

        <section className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("cartTitle", "Keranjang Belanja")}</h1>
            <p className="mt-2 text-sm text-slate-500">{t("cartSubtitle", "Periksa item kamu sebelum lanjut ke checkout.")}</p>
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

        {loading ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" />
              {t("loadingCart", "Memuat cart...")}
            </div>
          </section>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{t("emptyCartTitle", "Keranjang kamu masih kosong")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("emptyCartSubtitle", "Yuk jelajahi produk terbaik dari merchant favoritmu.")}</p>
            <a
              href={businessHomeHref}
              className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {t("browseProducts", "Cari Produk")}
            </a>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-4">
              {items.map((item) => {
                const previewItem = previewItemsByID[item.id];
                return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:w-36">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name || t("product", "Produk")} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-xs font-medium text-slate-400">{t("noImage", "No image")}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-slate-900">{item.product_name || t("product", "Produk")}</h3>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Store className="h-3.5 w-3.5" />
                        {item.business_name || displayMerchant}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("variantPrefix", "Variasi:")} {item.sku || item.variation_id || t("mainProduct", "Produk utama")}
                      </p>
                      {previewItem ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                          <span className={`rounded-full px-2 py-0.5 ${String(previewItem.tax_type || "exclude") === "include" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                            {formatTaxMode(previewItem.tax_type, previewItem.tax_rate)}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            {t("tax", "Pajak")} {toCurrency(previewItem.tax_amount)}
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-3 text-sm font-bold text-slate-900">{toCurrency(item.unit_price)}</p>
                      <p className="mt-1 text-xs text-slate-500">{t("totalItemPrefix", "Total item:")} {toCurrency(item.total_price || item.unit_price * item.qty)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={mutatingID === item.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("remove", "Hapus")}
                      </button>

                      <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          disabled={mutatingID === item.id}
                          className="px-3 py-2 text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Kurangi jumlah ${item.product_name || "produk"}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          disabled={mutatingID === item.id}
                          className="px-3 py-2 text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Tambah jumlah ${item.product_name || "produk"}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );})}
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
              <h2 className="text-lg font-bold text-slate-900">{t("cartSummaryTitle", "Ringkasan Belanja")}</h2>

              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{displayMerchant}</div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("shippingAddress", "Alamat Pengiriman")}</div>
                  {addresses.length === 0 ? (
                    <div className="text-xs text-amber-700">
                      {t("noSavedAddress", "Belum ada alamat tersimpan.")} {" "}
                      <a href={buildLocalizedPath("/customer/dashboard?tab=addresses", typeof window !== "undefined" ? window.location.pathname : null)} className="font-medium underline hover:text-amber-900">
                        {t("addAddressInDashboard", "Tambahkan alamat di dashboard")}
                      </a>{" "}
                      {t("beforeCheckout", "sebelum checkout.")}
                    </div>
                  ) : (
                    <select
                      value={selectedAddressID}
                      onChange={(e) => setSelectedAddressID(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {(address.label || "Alamat") + (address.is_primary ? " (Utama)" : "") + " - " + address.receiver_name}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedAddressID ? (
                    <div className="text-xs text-slate-500">
                      {addresses
                        .filter((address) => address.id === selectedAddressID)
                        .map((address) => [address.address_line_1, address.address_line_2, address.subdistrict, address.district, address.city, address.province, address.postal_code].filter(Boolean).join(", "))[0] || ""}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                    <span>{t("subtotal", "Subtotal")} ({items.length} {t("itemLabel", "item")})</span>
                  <span className="font-medium text-slate-900">{toCurrency(displaySubtotal)}</span>
                </div>
                {preview && preview.discount_amount > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>{t("discount", "Diskon")}</span>
                    <span className="font-medium">-{toCurrency(preview.discount_amount)}</span>
                  </div>
                ) : null}
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span>{t("tax", "Pajak")}</span>
                    <span className="font-medium text-slate-900">{toCurrency(preview?.tax_amount ?? 0)}</span>
                  </div>
                  {taxGroups.length > 0 ? (
                    <div className="space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                      {taxGroups.map((group) => (
                        <div key={`${group.taxType}-${group.taxRate}`} className="flex items-center justify-between gap-3">
                          <span className="capitalize text-slate-500">
                            {t("tax", "Pajak")} {formatTaxMode(group.taxType, group.taxRate, taxIncludeLabel, taxExcludeLabel)}
                          </span>
                          <span className="font-medium text-slate-800">{toCurrency(group.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{t("totalLabel", "Total")}</span>
                  <span className="text-lg font-bold text-slate-900">{toCurrency(displayGrand)}</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold text-slate-600">{t("couponCode", "Kode Kupon")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("couponPlaceholder", "Masukkan kode kupon (opsional)")}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setApplyingCoupon(true);
                      setError("");
                      try {
                        const p = await getCartPreview(businessID || null, couponCode || null);
                        setPreview(p);
                      } catch (err) {
                        const message = err instanceof Error ? err.message : "Gagal menerapkan kupon";
                        setError(message);
                      } finally {
                        setApplyingCoupon(false);
                      }
                    }}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    disabled={applyingCoupon}
                  >
                    {applyingCoupon ? t("checking", "Memeriksa...") : t("applyCoupon", "Pasang")}
                  </button>
                </div>
                {preview?.applied_coupons && preview.applied_coupons.length > 0 ? (
                  <div className="mt-2 text-xs text-slate-600">{t("couponActive", "Kupon aktif:")} {preview.applied_coupons.map((c) => c.code).join(", ")}</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={submittingCheckout || !selectedAddressID}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingCheckout ? t("processingCheckout", "Memproses checkout...") : checkoutLabel}
              </button>
            </aside>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
