/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Clock3, PackageSearch, RefreshCw, Store, Wallet } from "lucide-react";

import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import { buildLocalizedPath, getLocaleFromPathname } from "../../../lib/siteLocale";
import { formatAmount } from "../../../lib/amountFormat";
import type { Order } from "../../../lib/orderApi";

interface MemberDashboardPageProps {
  locale?: string;
}

type Locale = "id" | "en";

type OrderListResponse = {
  data: Order[];
  total: number;
};

function normalizeValue(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function prettifyValue(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null, locale: Locale = "id") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(amount: number) {
  return `Rp ${formatAmount(amount, { fractionDigits: 0 })}`;
}

function statusTone(value?: string) {
  const key = normalizeValue(value);
  if (["paid", "confirmed", "processing", "packed", "shipped", "delivered", "completed"].includes(key)) {
    return "emerald";
  }
  if (["pending", "pending_payment", "awaiting_payment", "awaiting_quote", "awaiting", "draft", "unpaid"].includes(key)) {
    return "amber";
  }
  if (["cancelled", "canceled", "expired", "failed", "rejected"].includes(key)) {
    return "rose";
  }
  return "slate";
}

function statusToneClass(tone: string) {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (tone === "rose") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function statusLabel(value?: string, locale: Locale = "id") {
  const key = normalizeValue(value);
  const idMap: Record<string, string> = {
    pending: "Menunggu",
    pending_payment: "Menunggu pembayaran",
    awaiting_payment: "Menunggu pembayaran",
    awaiting_quote: "Menunggu penawaran",
    awaiting: "Menunggu",
    unpaid: "Belum dibayar",
    paid: "Dibayar",
    confirmed: "Dikonfirmasi",
    processing: "Diproses",
    packed: "Dikemas",
    shipped: "Dikirim",
    delivered: "Terkirim",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    canceled: "Dibatalkan",
    expired: "Kedaluwarsa",
    failed: "Gagal",
    refunded: "Dikembalikan",
    draft: "Draft",
  };
  const enMap: Record<string, string> = {
    pending: "Pending",
    pending_payment: "Pending payment",
    awaiting_payment: "Awaiting payment",
    awaiting_quote: "Awaiting quote",
    awaiting: "Awaiting",
    unpaid: "Unpaid",
    paid: "Paid",
    confirmed: "Confirmed",
    processing: "Processing",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    expired: "Expired",
    failed: "Failed",
    refunded: "Refunded",
    draft: "Draft",
  };
  return (locale === "en" ? enMap[key] : idMap[key]) || prettifyValue(key || "-");
}

function isPaymentWaiting(order: Order) {
  const paymentStatus = normalizeValue(order.payment_status);
  const orderStatus = normalizeValue(order.status);
  return ["pending", "pending_payment", "awaiting_payment", "awaiting_quote", "awaiting", "unpaid", "expired", "failed"].includes(paymentStatus) || ["pending", "pending_payment", "awaiting_payment", "awaiting_quote", "awaiting", "draft"].includes(orderStatus);
}

function isReadyToProcess(order: Order) {
  const paymentStatus = normalizeValue(order.payment_status);
  const orderStatus = normalizeValue(order.status);
  return ["paid", "confirmed", "processing", "packed", "shipped", "delivered", "completed"].includes(paymentStatus) || ["paid", "confirmed", "processing", "packed", "shipped"].includes(orderStatus);
}

function getBusinessLabel(business: Business, locale: Locale) {
  const owner = business.owner_name?.trim();
  const role = business.owner_role?.trim();
  if (owner && role) return `${owner} · ${role}`;
  if (owner) return owner;
  if (role) return role;
  return locale === "en" ? "Member-managed store" : "Toko yang dikelola member";
}

export default function MemberDashboardPage({ locale }: MemberDashboardPageProps) {
  const resolvedLocale: Locale = locale === "en" ? "en" : getLocaleFromPathname(typeof window !== "undefined" ? window.location.pathname : null);
  const t = (idText: string, enText: string) => (resolvedLocale === "en" ? enText : idText);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessTotal, setBusinessTotal] = useState(0);
  const [selectedBusinessID, setSelectedBusinessID] = useState("");
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businessesError, setBusinessesError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBusinessesLoading(true);
    setBusinessesError("");

    memberGet<BusinessListResponse>("/api/member/businesses?page=1&limit=100")
      .then((response) => {
        if (cancelled) return;
        const nextBusinesses = response.data || [];
        setBusinesses(nextBusinesses);
        setBusinessTotal(response.total || nextBusinesses.length);
      })
      .catch((error) => {
        if (cancelled) return;
        setBusinessesError(error instanceof Error ? error.message : t("Gagal memuat toko", "Failed to load stores"));
        setBusinesses([]);
        setBusinessTotal(0);
      })
      .finally(() => {
        if (!cancelled) setBusinessesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businesses.length) {
      if (selectedBusinessID) setSelectedBusinessID("");
      return;
    }

    setSelectedBusinessID((current) => {
      if (current && businesses.some((business) => business.id === current)) {
        return current;
      }
      return businesses[0]?.id || "";
    });
  }, [businesses, selectedBusinessID]);

  const selectedBusiness = useMemo(() => {
    if (!selectedBusinessID) return businesses[0] || null;
    return businesses.find((business) => business.id === selectedBusinessID) || businesses[0] || null;
  }, [businesses, selectedBusinessID]);

  useEffect(() => {
    if (!selectedBusiness?.id) {
      setOrders([]);
      setOrderTotal(0);
      return;
    }

    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError("");

    memberGet<OrderListResponse>(`/api/member/businesses/${encodeURIComponent(selectedBusiness.id)}/orders?page=1&limit=12`)
      .then((response) => {
        if (cancelled) return;
        setOrders(response.data || []);
        setOrderTotal(response.total || 0);
      })
      .catch((error) => {
        if (cancelled) return;
        setOrdersError(error instanceof Error ? error.message : t("Gagal memuat order", "Failed to load orders"));
        setOrders([]);
        setOrderTotal(0);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBusiness?.id]);

  const recentOrders = orders;
  const readyToProcessCount = recentOrders.filter(isReadyToProcess).length;
  const waitingPaymentCount = recentOrders.filter(isPaymentWaiting).length;
  const snapshotValue = recentOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const activeStoreHref = selectedBusiness?.slug ? buildLocalizedPath(`/b/${encodeURIComponent(selectedBusiness.slug)}`, resolvedLocale) : buildLocalizedPath("/member/businesses", resolvedLocale);
  const businessesHref = buildLocalizedPath("/member/businesses", resolvedLocale);
  const productsHref = buildLocalizedPath("/member/products", resolvedLocale);
  const assetsHref = selectedBusiness ? buildLocalizedPath(`/member/business-assets?business_id=${encodeURIComponent(selectedBusiness.id)}`, resolvedLocale) : buildLocalizedPath("/member/business-assets", resolvedLocale);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#e6d9c7] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_48%,#eef8f1_100%)] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <Store className="h-4 w-4" />
              <span>{t("Ringkasan operasional member", "Member operations overview")}</span>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{t("Pantau toko dan order dari satu tempat", "Monitor stores and orders from one place")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                {t(
                  "Dashboard ini menampilkan toko yang kamu kelola, order terbaru, dan pintasan cepat ke halaman yang paling sering dipakai tim.",
                  "This dashboard shows the stores you manage, recent orders, and quick shortcuts to the pages your team uses most.",
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <a
              href={businessesHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <Building2 className="h-4 w-4" />
              <span>{t("Kelola toko", "Manage stores")}</span>
            </a>
            <a
              href={productsHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <PackageSearch className="h-4 w-4" />
              <span>{t("Kelola produk", "Manage products")}</span>
            </a>
            <a
              href={assetsHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
            >
              <Wallet className="h-4 w-4" />
              <span>{t("Aset toko", "Store assets")}</span>
            </a>
            <a
              href={activeStoreHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>{t("Buka toko aktif", "Open active store")}</span>
            </a>
          </div>
        </div>
      </section>

      {(businessesError || ordersError) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {businessesError || ordersError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Toko terdaftar", "Registered stores")}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{businessesLoading ? "..." : businessTotal}</p>
              <p className="mt-1 text-sm text-slate-500">{t("Semua toko yang terhubung ke member ini.", "All stores linked to this member.")}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Order aktif", "Active orders")}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{ordersLoading ? "..." : orderTotal}</p>
              <p className="mt-1 text-sm text-slate-500">{t("Total order untuk toko yang dipilih.", "Total orders for the selected store.")}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Siap diproses", "Ready to process")}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{ordersLoading ? "..." : readyToProcessCount}</p>
              <p className="mt-1 text-sm text-slate-500">{t("Dihitung dari 12 order terbaru.", "Calculated from the latest 12 orders.")}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <RefreshCw className="h-5 w-5" />
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Menunggu pembayaran", "Waiting for payment")}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{ordersLoading ? "..." : waitingPaymentCount}</p>
              <p className="mt-1 text-sm text-slate-500">{t("Order yang masih perlu tindak lanjut.", "Orders that still need follow-up.")}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#f0e6d6] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{t("Order terbaru", "Recent orders")}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {selectedBusiness
                  ? t(
                      "Menampilkan 12 order terakhir untuk toko terpilih.",
                      "Showing the latest 12 orders for the selected store.",
                    )
                  : t("Pilih toko untuk melihat order terbaru.", "Pick a store to view its recent orders.")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {t("Snapshot nilai order", "Order snapshot value")}: <span className="font-semibold text-slate-900">{formatCurrency(snapshotValue)}</span>
            </div>
          </div>

          <div className="p-5">
            {businessesLoading || ordersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl border border-dashed border-slate-200 bg-slate-50" />
                ))}
              </div>
            ) : selectedBusiness ? (
              recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.map((order) => {
                    const paymentTone = statusTone(order.payment_status);
                    const orderTone = statusTone(order.status);
                    const itemCount = order.order_items?.length || 0;
                    const customerName = order.customer?.name?.trim() || t("Pelanggan belum tercatat", "Customer not recorded");
                    return (
                      <article key={order.id} className="rounded-2xl border border-[#ece3d5] bg-[#fcfbf8] px-4 py-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">{order.order_number}</p>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusToneClass(paymentTone)}`}>
                                {statusLabel(order.payment_status, resolvedLocale)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              {customerName} · {itemCount} {t("item", "items")} · {formatDate(order.placed_at || order.created_at, resolvedLocale)}
                            </p>
                            <p className="text-sm text-slate-600">
                              {t("Status pemenuhan", "Fulfillment status")}: <span className="font-medium text-slate-800">{statusLabel(order.status, resolvedLocale)}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-slate-900">{formatCurrency(Number(order.grand_total || 0))}</p>
                            <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusToneClass(orderTone)}`}>
                              {statusLabel(order.status, resolvedLocale)}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-slate-900">{t("Belum ada order untuk toko ini.", "There are no orders for this store yet.")}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {t(
                      "Begitu order masuk, ringkasan terbaru akan tampil di sini.",
                      "As soon as orders arrive, the latest snapshot will appear here.",
                    )}
                  </p>
                </div>
              )
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-base font-semibold text-slate-900">{t("Pilih toko terlebih dahulu.", "Pick a store first.")}</p>
                <p className="mt-2 text-sm text-slate-500">{t("Dashboard ini bekerja per toko, jadi order hanya dimuat setelah toko dipilih.", "This dashboard is store-specific, so orders load after a store is selected.")}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
            <div className="border-b border-[#f0e6d6] px-5 py-5">
              <h3 className="text-lg font-semibold text-slate-900">{t("Toko aktif", "Active store")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("Pindah toko tanpa keluar dari dashboard.", "Switch stores without leaving the dashboard.")}</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <label className="block text-sm font-medium text-slate-700">
                <span>{t("Pilih toko", "Select a store")}</span>
                <select
                  value={selectedBusiness?.id || ""}
                  onChange={(event) => setSelectedBusinessID(event.target.value)}
                  disabled={!businesses.length || businessesLoading}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  {businesses.length === 0 ? (
                    <option value="">{businessesLoading ? t("Memuat toko...", "Loading stores...") : t("Belum ada toko", "No stores yet")}</option>
                  ) : (
                    businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {selectedBusiness ? (
                <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
                  <p className="text-base font-semibold text-slate-900">{selectedBusiness.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{getBusinessLabel(selectedBusiness, resolvedLocale)}</p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                      <span>{t("Slug", "Slug")}</span>
                      <span className="font-medium text-slate-900">{selectedBusiness.slug}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                      <span>{t("Order total", "Order total")}</span>
                      <span className="font-medium text-slate-900">{orderTotal}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                      <span>{t("Diperbarui", "Updated")}</span>
                      <span className="font-medium text-slate-900">{formatDate(selectedBusiness.updated_at, resolvedLocale)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  {businessesLoading
                    ? t("Menyiapkan data toko...", "Preparing store data...")
                    : t("Belum ada toko yang bisa dipilih.", "No store available to select.")}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
            <div className="border-b border-[#f0e6d6] px-5 py-5">
              <h3 className="text-lg font-semibold text-slate-900">{t("Pintasan cepat", "Quick shortcuts")}</h3>
              <p className="mt-1 text-sm text-slate-500">{t("Arahkan tim ke halaman yang paling sering dipakai.", "Send the team to the pages they use most.")}</p>
            </div>
            <div className="space-y-3 px-5 py-5">
              <a href={businessesHref} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span>{t("Daftar toko", "Store list")}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href={productsHref} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span>{t("Produk", "Products")}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href={assetsHref} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span>{t("Aset toko", "Store assets")}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href={activeStoreHref} className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                <span>{t("Buka toko aktif", "Open active store")}</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
