/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { Package, Heart, MapPin, Settings, Bell, ChevronRight, Wallet, MessageSquareText } from "lucide-react";
import CustomerPageNav from "./CustomerPageNav";
import ProfileSettings from "./ProfileSettings";
import CustomerWalletSection from "./wallet/CustomerWalletSection";
import { useTranslations } from "../../i18n";
import {
  createMyCustomerAddress,
  clearCustomerSession,
  CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR,
  deleteMyCustomerAddress,
  getCustomerAuthToken,
  getCustomerMe,
  getCustomerProfile,
  listMyCustomerAddresses,
  setPrimaryMyCustomerAddress,
  updateMyCustomerAddress,
  type CustomerAddress,
} from "./auth/authApi";
import { rememberCustomerAuthNextPath } from "../../lib/customerAuthRedirect";
import { buildLocalizedPath } from "../../lib/siteLocale";
import { notifyError, notifySuccess } from "../../lib/notification";
import type { CustomerSession } from "../../lib/customerSession";
import { getMyCartBusinesses, type CartBusinessSummary } from "../../lib/cartApi";
import { formatAmount } from "../../lib/amountFormat";
import {
  customerUser,
  customerStats,
  customerWishlist,
  customerNotifications,
} from "./mockData";
import { listMyOrders, type Order } from "../../lib/orderApi";

function formatOrderDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function mapOrderStatusLabel(value?: string): string {
  const key = String(value || "").toLowerCase();
  if (key === "waiting_customer_confirmation") return "orderStatus.waitingCustomerConfirmation";
  if (key === "in_dispute") return "orderStatus.inDispute";
  if (key === "refunded") return "orderStatus.refunded";
  if (key === "shipped") return "orderStatus.shipped";
  if (key === "paid") return "orderStatus.paid";
  if (key === "completed") return "orderStatus.completed";
  if (key === "processing" || key === "confirmed") return "orderStatus.processing";
  if (key === "expired") return "orderStatus.expired";
  if (key === "cancelled" || key === "canceled") return "orderStatus.cancelled";
  return "orderStatus.processing";
}

function mapOrderStatusClass(value?: string): string {
  const key = String(value || "").toLowerCase();
  if (key === "waiting_customer_confirmation") return "bg-sky-50 text-sky-700";
  if (key === "in_dispute") return "bg-rose-50 text-rose-700";
  if (key === "refunded") return "bg-slate-100 text-slate-700";
  if (key === "shipped") return "bg-indigo-50 text-indigo-700";
  if (key === "paid") return "bg-teal-50 text-teal-700";
  if (key === "completed") return "bg-emerald-50 text-emerald-700";
  if (key === "processing" || key === "confirmed") return "bg-amber-50 text-amber-700";
  if (key === "expired") return "bg-slate-100 text-slate-700";
  if (key === "cancelled" || key === "canceled") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export type MenuKey = "orders" | "carts" | "wishlist" | "wallet" | "addresses" | "notifications" | "settings";

interface CustomerDashboardProps {
  initialTab?: MenuKey;
  customerSession?: CustomerSession | null;
}



function formatIDR(amount: number): string {
  if (!Number.isFinite(amount)) return "Rp 0";
  return `Rp ${formatAmount(amount, { fractionDigits: 0 })}`;
}

export default function CustomerDashboard({ initialTab = "orders", customerSession = null }: CustomerDashboardProps) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      const validTabs: MenuKey[] = ["orders", "carts", "wishlist", "wallet", "addresses", "notifications", "settings"];
      if (tab && validTabs.includes(tab as MenuKey)) return tab as MenuKey;
    }
    return initialTab;
  });
  const [cartBusinesses, setCartBusinesses] = useState<CartBusinessSummary[]>([]);
  const [loadingCartBusinesses, setLoadingCartBusinesses] = useState(false);
  const [cartBusinessesError, setCartBusinessesError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const [addressActionID, setAddressActionID] = useState("");
  const [editingAddressID, setEditingAddressID] = useState("");
  const [addressForm, setAddressForm] = useState({
    label: "",
    receiver_name: "",
    phone_number: "",
    address_line_1: "",
    address_line_2: "",
    subdistrict: "",
    district: "",
    city: "",
    province: "",
    postal_code: "",
    country: "ID",
    notes: "",
    is_primary: false,
  });
  const [customerName, setCustomerName] = useState(customerSession?.profile?.name || customerUser.name);
  const [customerEmail, setCustomerEmail] = useState(customerSession?.profile?.email || customerUser.email);
  const [customerInitials, setCustomerInitials] = useState(
    customerSession?.profile?.name
      ? customerSession.profile.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() || "")
          .join("") || customerUser.initials
      : customerUser.initials,
  );

  const t = useTranslations();

  const sidebarItems = [
    { key: "orders" as MenuKey, icon: Package, label: t("ordersLabel", "Pesanan Saya") },
    { key: "carts" as MenuKey, icon: Package, label: t("cartsLabel", "Cart") },
    { key: "wishlist" as MenuKey, icon: Heart, label: t("wishlistLabel", "Wishlist") },
    { key: "wallet" as MenuKey, icon: Wallet, label: t("walletLabel", "Wallet") },
    { key: "addresses" as MenuKey, icon: MapPin, label: t("addressesLabel", "Alamat") },
    { key: "notifications" as MenuKey, icon: Bell, label: t("notificationsLabel", "Notifikasi") },
    { key: "settings" as MenuKey, icon: Settings, label: t("settingsLabel", "Pengaturan Akun") },
  ];

  useEffect(() => {
    let cancelled = false;

    const token = getCustomerAuthToken();
    if (!token) {
      clearCustomerSession();
      window.location.href = rememberCustomerAuthNextPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      return;
    }

    const hydrateSession = async () => {
      try {
        const me = await getCustomerMe();
        if (cancelled) return;
        const customer = me?.data?.customer || null;
        if (customer?.name) {
          setCustomerName(customer.name);
          setCustomerEmail(customer.email || customerUser.email);
          setCustomerInitials(
            customer.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() || "")
              .join("") || customerUser.initials,
          );
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.message === CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR) return;
      }

      const profile = getCustomerProfile();
      if (profile?.name) {
        setCustomerName(profile.name);
        setCustomerEmail(profile.email || customerUser.email);
        setCustomerInitials(
          profile.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || customerUser.initials,
        );
      }
    };

    hydrateSession();

    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab") as MenuKey | null;
    if (requestedTab && sidebarItems.some((item) => item.key === requestedTab)) {
      setActiveMenu(requestedTab);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (activeMenu !== "orders") return;
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const result = await listMyOrders({ page: 1, limit: 20 });
        if (!cancelled) {
          setOrders(result.data || []);
        }
      } catch (err) {
        if (err instanceof Error && err.message === CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR) return;
        const message = err instanceof Error ? err.message : t("failedLoadOrders", "Gagal memuat daftar order");
        if (!cancelled) {
          setOrders([]);
          setOrdersError(message);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeMenu]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (activeMenu !== "addresses") return;
      setAddressesLoading(true);
      setAddressesError("");
      try {
        const rows = await listMyCustomerAddresses();
        if (!cancelled) setAddresses(rows);
      } catch (err) {
        if (err instanceof Error && err.message === CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR) return;
        const message = err instanceof Error ? err.message : t("failedLoadAddress", "Gagal memuat alamat");
        if (!cancelled) {
          setAddresses([]);
          setAddressesError(message);
        }
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeMenu]);

  const loadAddresses = async () => {
    setAddressesLoading(true);
    setAddressesError("");
    try {
      const rows = await listMyCustomerAddresses();
      setAddresses(rows);
    } catch (err) {
        const message = err instanceof Error ? err.message : t("failedLoadAddress", "Gagal memuat alamat");
      setAddressesError(message);
    } finally {
      setAddressesLoading(false);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: "",
      receiver_name: "",
      phone_number: "",
      address_line_1: "",
      address_line_2: "",
      subdistrict: "",
      district: "",
      city: "",
      province: "",
      postal_code: "",
      country: "ID",
      notes: "",
      is_primary: false,
    });
    setEditingAddressID("");
  };

  const startEditAddress = (address: CustomerAddress) => {
    setEditingAddressID(address.id);
    setAddressForm({
      label: address.label || "",
      receiver_name: address.receiver_name || "",
      phone_number: address.phone_number || "",
      address_line_1: address.address_line_1 || "",
      address_line_2: address.address_line_2 || "",
      subdistrict: address.subdistrict || "",
      district: address.district || "",
      city: address.city || "",
      province: address.province || "",
      postal_code: address.postal_code || "",
      country: address.country || "ID",
      notes: address.notes || "",
      is_primary: address.is_primary,
    });
    setShowAddressForm(true);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingCartBusinesses(true);
      setCartBusinessesError("");
      try {
        const rows = await getMyCartBusinesses();
        if (!cancelled) setCartBusinesses(rows);
      } catch (err) {
        if (err instanceof Error && err.message === CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR) return;
        const message = err instanceof Error ? err.message : t("failedLoadCarts", "Gagal memuat daftar cart");
        if (!cancelled) {
          setCartBusinesses([]);
          setCartBusinessesError(message);
        }
      } finally {
        if (!cancelled) setLoadingCartBusinesses(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeMenu !== "carts") return;
    let cancelled = false;

    const run = async () => {
      setLoadingCartBusinesses(true);
      setCartBusinessesError("");
      try {
        const rows = await getMyCartBusinesses();
        if (!cancelled) setCartBusinesses(rows);
      } catch (err) {
        if (err instanceof Error && err.message === CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR) return;
          const message = err instanceof Error ? err.message : t("failedLoadCarts", "Gagal memuat daftar cart");
        if (!cancelled) {
          setCartBusinesses([]);
          setCartBusinessesError(message);
        }
      } finally {
        if (!cancelled) setLoadingCartBusinesses(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeMenu]);

  const handleChangeMenu = (key: MenuKey) => {
    setActiveMenu(key);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", key);
    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  };

  const activeTitle = {
    orders: t("activeTitle.orders", "Pesanan Saya"),
    carts: t("activeTitle.carts", "Cart per Bisnis"),
    wishlist: t("activeTitle.wishlist", "Wishlist"),
    wallet: t("activeTitle.wallet", "Wallet Saya"),
    addresses: t("activeTitle.addresses", "Alamat"),
    notifications: t("activeTitle.notifications", "Notifikasi"),
    settings: t("activeTitle.settings", "Pengaturan Akun"),
  }[activeMenu];

  const activeDescription = {
    orders: t("activeDescription.orders", "Daftar transaksi terbaru dan status pengiriman Anda."),
    carts: t("activeDescription.carts", "Daftar cart Anda yang dikelompokkan per bisnis."),
    wishlist: t("activeDescription.wishlist", "Produk yang Anda simpan untuk dibeli nanti."),
    wallet: t("activeDescription.wallet", "Pantau saldo refund cash, promo credit, dan permintaan tarik dana."),
    addresses: t("activeDescription.addresses", "Kelola alamat pengiriman untuk checkout lebih cepat."),
    notifications: t("activeDescription.notifications", "Ringkasan update order, promo, dan aktivitas akun."),
    settings: t("activeDescription.settings", "Preferensi akun personal dan pengaturan notifikasi."),
  }[activeMenu];

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6">
        <CustomerPageNav customerSession={customerSession} />

        {/* Main Content */}
        <div className="mt-6 flex flex-col gap-6 md:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 md:w-56">
            {/* User Card */}
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {customerInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{customerName}</p>
                  <p className="truncate text-xs text-slate-500">{customerEmail}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{customerUser.joinDate}</p>
            </div>

            {/* Nav */}
            <nav className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {sidebarItems.map(({ key, icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleChangeMenu(key)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-0 ${
                    activeMenu === key
                      ? "bg-emerald-50 font-semibold text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  <div className="ml-auto flex items-center gap-2">
                    {key === "carts" ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {loadingCartBusinesses ? t("loadingShort", "...") : cartBusinesses.length}
                      </span>
                    ) : null}
                    {activeMenu === key ? <ChevronRight className="h-3.5 w-3.5 text-emerald-400" /> : null}
                  </div>
                </button>
              ))}
            </nav>

            <a
              href={buildLocalizedPath("/customer/complaints", typeof window !== "undefined" ? window.location.pathname : null)}
              className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" />
                Complaint List
              </span>
              <ChevronRight className="h-4 w-4 text-rose-400" />
            </a>
          </aside>

          {/* Content */}
          <main className="flex-1 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <h1 className="text-lg font-bold text-slate-900">{activeTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">{activeDescription}</p>
            </section>

            <div className="grid grid-cols-3 gap-4">
              {customerStats.map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {activeMenu === "orders" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("recentOrders", "Pesanan Terbaru")}</h2>
                  <span className="text-xs text-slate-500">{orders.length} {t("orderUnit", "order")}</span>
                </div>
                {ordersLoading ? (
                  <div className="px-5 py-5 text-sm text-slate-500">{t("loadingOrders", "Memuat order...")}</div>
                ) : ordersError ? (
                  <div className="px-5 py-5 text-sm text-red-600">{ordersError}</div>
                ) : orders.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-slate-500">{t("noOrders", "Belum ada order.")}</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {orders.map((order) => {
                      const firstItem = order.order_items?.[0];
                      const title = firstItem?.product_name || order.order_number;
                      const statusKey = mapOrderStatusLabel(order.payment_status || order.status);
                      const paymentLabel = t(
                        statusKey,
                        statusKey === "orderStatus.completed"
                          ? "Selesai"
                          : statusKey === "orderStatus.expired"
                          ? "Kedaluwarsa"
                          : statusKey === "orderStatus.cancelled"
                          ? "Dibatalkan"
                          : "Diproses",
                      );
                      return (
                        <a key={order.id} href={`/order/${encodeURIComponent(order.id)}`} className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{title}</p>
                            <p className="text-xs text-slate-500">{order.order_number} · {formatOrderDate(order.created_at)}</p>
                          </div>
                          <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${mapOrderStatusClass(order.payment_status || order.status)}`}>
                              {paymentLabel}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">{formatIDR(order.grand_total)}</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeMenu === "carts" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("cartsPerBusiness", "Cart per Bisnis")}</h2>
                  <span className="text-xs text-slate-500">{cartBusinesses.length} {t("businessCountUnit", "bisnis")}</span>
                </div>
                {loadingCartBusinesses ? (
                  <div className="px-5 py-5 text-sm text-slate-500">{t("loadingCarts", "Memuat cart...")}</div>
                ) : cartBusinessesError ? (
                  <div className="px-5 py-5 text-sm text-red-600">{cartBusinessesError}</div>
                ) : cartBusinesses.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-slate-500">{t("noActiveCarts", "Belum ada cart aktif.")}</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cartBusinesses.map((entry) => {
                      const target = buildLocalizedPath(entry.business_slug?.trim() ? `/b/${entry.business_slug}/cart` : "/cart", typeof window !== "undefined" ? window.location.pathname : null);
                      return (
                        <a
                          key={entry.cart_id}
                          href={target}
                          className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{entry.business_name || t("noBusinessName", "Tanpa Nama Bisnis")}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {entry.item_count} {t("itemUnit", "item")} · {entry.total_qty} {t("qtyUnit", "qty")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-slate-900">{formatIDR(entry.total_amount)}</p>
                            <p className="mt-1 text-xs font-medium text-emerald-600">{t("openCart", "Buka cart")}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeMenu === "wishlist" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("wishlistTitle", "Wishlist")}</h2>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {customerWishlist.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.product}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.store}</p>
                      <p className="mt-3 text-sm font-bold text-slate-800">{item.price}</p>
                      <div className="mt-4 flex gap-2">
                        <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">{t("buyNow", "Beli Sekarang")}</button>
                        <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white">{t("remove", "Hapus")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeMenu === "wallet" && (
              <CustomerWalletSection />
            )}

            {activeMenu === "addresses" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("shippingAddresses", "Alamat Pengiriman")}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      if (showAddressForm) {
                        setShowAddressForm(false);
                        resetAddressForm();
                        return;
                      }
                      resetAddressForm();
                      setShowAddressForm(true);
                    }}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    {showAddressForm ? t("close", "Tutup") : t("addAddress", "Tambah Alamat")}
                  </button>
                </div>
                <div className="space-y-3 p-5">
                  {showAddressForm ? (
                    <form
                      className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        setSubmittingAddress(true);
                        setAddressesError("");
                        try {
                          const payload = {
                            ...addressForm,
                            address_line_2: addressForm.address_line_2 || null,
                            subdistrict: addressForm.subdistrict || null,
                            district: addressForm.district || null,
                            notes: addressForm.notes || null,
                          };
                          if (editingAddressID) {
                            await updateMyCustomerAddress(editingAddressID, payload);
                            notifySuccess(t("addressUpdated", "Alamat berhasil diperbarui."));
                          } else {
                            await createMyCustomerAddress(payload);
                            notifySuccess(t("addressAdded", "Alamat berhasil ditambahkan."));
                          }
                          resetAddressForm();
                          setShowAddressForm(false);
                          await loadAddresses();
                        } catch (err) {
                          const message = err instanceof Error ? err.message : t("failedAddAddress", "Gagal menambah alamat");
                          setAddressesError(message);
                          notifyError(message);
                        } finally {
                          setSubmittingAddress(false);
                        }
                      }}
                    >
                      <div className="space-y-4 text-slate-900">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{t("addressFormTitle", "Form Alamat Pengiriman")}</p>
                          <p className="mt-1 text-xs text-slate-700">{t("addressFormDescription", "Isi data inti dulu. Detail tambahan hanya kalau memang diperlukan.")}</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.label", "Label alamat")}</span>
                            <input
                              value={addressForm.label}
                              onChange={(e) => setAddressForm((current) => ({ ...current, label: e.target.value }))}
                              placeholder={t("placeholder.addressLabel", "Rumah, Kantor, Gudang")}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.receiverName", "Nama penerima")}</span>
                            <input
                              value={addressForm.receiver_name}
                              onChange={(e) => setAddressForm((current) => ({ ...current, receiver_name: e.target.value }))}
                              placeholder={t("placeholder.receiverName", "Nama lengkap penerima")}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              required
                            />
                          </label>
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.phone", "Nomor HP")}</span>
                            <input
                              value={addressForm.phone_number}
                              onChange={(e) => setAddressForm((current) => ({ ...current, phone_number: e.target.value }))}
                              placeholder={t("placeholder.phone", "08xxxxxxxxxx")}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              required
                            />
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                            <input type="checkbox" checked={addressForm.is_primary} onChange={(e) => setAddressForm((current) => ({ ...current, is_primary: e.target.checked }))} />
                            {t("addressField.makePrimary", "Jadikan alamat utama")}
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.fullAddress", "Alamat lengkap")}</span>
                            <textarea
                              value={addressForm.address_line_1}
                              onChange={(e) => setAddressForm((current) => ({ ...current, address_line_1: e.target.value }))}
                              placeholder={t("placeholder.fullAddress", "Jalan, nomor rumah, RT/RW, patokan, gedung, dll")}
                              className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              required
                            />
                          </label>
                          <p className="text-xs text-slate-700">{t("addressPrimaryNote", "Tulis alamat utama secara lengkap supaya kurir tidak bingung.")}</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.city", "Kota / Kabupaten")}</span>
                            <input value={addressForm.city} onChange={(e) => setAddressForm((current) => ({ ...current, city: e.target.value }))} placeholder={t("placeholder.exampleCity", "Contoh: Bandung")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                          </label>
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.province", "Provinsi")}</span>
                            <input value={addressForm.province} onChange={(e) => setAddressForm((current) => ({ ...current, province: e.target.value }))} placeholder={t("placeholder.exampleProvince", "Contoh: Jawa Barat")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                          </label>
                          <label className="space-y-1 text-sm text-slate-900">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.postalCode", "Kode pos")}</span>
                            <input value={addressForm.postal_code} onChange={(e) => setAddressForm((current) => ({ ...current, postal_code: e.target.value }))} placeholder={t("placeholder.postalCode", "40123")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                          </label>
                        </div>

                        <details className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-slate-900">
                          <summary className="cursor-pointer text-sm font-medium text-slate-900">{t("optionalDetails", "Detail tambahan opsional")}</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1 text-sm text-slate-900">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.additional", "Alamat tambahan")}</span>
                              <input value={addressForm.address_line_2 || ""} onChange={(e) => setAddressForm((current) => ({ ...current, address_line_2: e.target.value }))} placeholder={t("placeholder.addressLine2", "Blok, nomor unit, patokan tambahan")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            </label>
                            <label className="space-y-1 text-sm text-slate-900">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.subdistrict", "Kelurahan / Desa")}</span>
                              <input value={addressForm.subdistrict || ""} onChange={(e) => setAddressForm((current) => ({ ...current, subdistrict: e.target.value }))} placeholder={t("placeholder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            </label>
                            <label className="space-y-1 text-sm text-slate-900">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.district", "Kecamatan")}</span>
                              <input value={addressForm.district || ""} onChange={(e) => setAddressForm((current) => ({ ...current, district: e.target.value }))} placeholder={t("placeholder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            </label>
                            <label className="space-y-1 text-sm text-slate-900">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("addressField.notes", "Catatan kurir")}</span>
                              <input value={addressForm.notes || ""} onChange={(e) => setAddressForm((current) => ({ ...current, notes: e.target.value }))} placeholder={t("placeholder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            </label>
                          </div>
                        </details>

                        <button type="submit" disabled={submittingAddress} className="inline-flex w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                          {submittingAddress ? t("saving", "Menyimpan...") : editingAddressID ? t("updateAddress", "Perbarui Alamat") : t("saveAddress", "Simpan Alamat")}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {addressesError ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{addressesError}</div> : null}
                  {addressesLoading ? <div className="text-sm text-slate-500">{t("loadingAddresses", "Memuat alamat...")}</div> : null}
                  {!addressesLoading && addresses.length === 0 ? <div className="text-sm text-slate-500">{t("noSavedAddresses", "Belum ada alamat tersimpan.")}</div> : null}
                  {addresses.map((address) => (
                    <div key={address.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{address.label || t("addressLabel", "Alamat")}</p>
                          {address.is_primary ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{t("primaryLabel", "Utama")}</span> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={addressActionID === address.id}
                            onClick={() => startEditAddress(address)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {t("edit", "Edit")}
                          </button>
                          {!address.is_primary ? (
                            <button
                              type="button"
                              disabled={addressActionID === address.id}
                              onClick={async () => {
                                setAddressActionID(address.id);
                                try {
                                  await setPrimaryMyCustomerAddress(address.id);
                                  notifySuccess(t("addressPrimaryUpdated", "Alamat utama diperbarui."));
                                  await loadAddresses();
                                } catch (err) {
                                  const message = err instanceof Error ? err.message : t("failedSetPrimary", "Gagal mengubah alamat utama");
                                  notifyError(message);
                                } finally {
                                  setAddressActionID("");
                                }
                              }}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                              {t("makePrimary", "Jadikan Utama")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={addressActionID === address.id}
                            onClick={async () => {
                              setAddressActionID(address.id);
                              try {
                                await deleteMyCustomerAddress(address.id);
                                notifySuccess(t("addressDeleted", "Alamat dihapus."));
                                await loadAddresses();
                              } catch (err) {
                                const message = err instanceof Error ? err.message : t("failedDeleteAddress", "Gagal menghapus alamat");
                                notifyError(message);
                              } finally {
                                setAddressActionID("");
                              }
                            }}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                          >
                            {t("delete", "Hapus")}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-700">{address.receiver_name} · {address.phone_number}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[address.address_line_1, address.address_line_2, address.subdistrict, address.district, address.city, address.province, address.postal_code].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeMenu === "notifications" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("notificationsTitle", "Notifikasi")}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {customerNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-start justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{notification.time}</p>
                      </div>
                      {notification.unread && <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeMenu === "settings" && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{t("settingsTitle", "Pengaturan Akun")}</h2>
                </div>
                <div className="p-5">
                  <ProfileSettings className="space-y-6" />
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
