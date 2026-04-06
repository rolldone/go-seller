/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CreditCard, LoaderCircle, Receipt, ShieldCheck, Upload } from "lucide-react";
import Footer from "./Footer";
import CourierCard from "./CourierCard";
import type { PublicBusiness } from "./business/types";
import { buildCustomerAuthLoginUrl } from "../../lib/customerAuthRedirect";
import { getCustomerAuthToken, listMyCustomerAddresses, type CustomerAddress } from "../customer/auth/authApi";
import { notifyError, notifySuccess } from "../../lib/notification";
import {
  downloadMyOrderInvoice,
  getMyOrderByID,
  getMyOrderPaymentProofBlob,
  listMyOrderPaymentProofs,
  updateMyOrderShippingAddress,
  startMyOrderPayment,
  type MyOrderDetailResponse,
  type OrderPaymentProvider,
  type Payment,
  type PaymentProof,
} from "../../lib/orderApi";

function toCurrency(value: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

function formatTaxPercent(rate?: number | null): string {
  if (!rate || rate <= 0) return "0%";
  const normalized = rate <= 1 ? rate * 100 : rate;
  const rounded = Math.round(normalized * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

function formatTaxMode(taxType?: string | null, taxRate?: number | null): string {
  const mode = String(taxType || "").toLowerCase() === "include" ? "Include" : "Exclude";
  return `${mode} ${formatTaxPercent(taxRate)}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseMetadata(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return null;
  }
}

function parseShippingQuote(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.shipping_quote || metadata.shippingQuote;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function parseShippingAddress(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.shipping_address;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function mapStatusLabel(value?: string | null): string {
  const key = String(value || "").trim().toLowerCase();
  if (key === "awaiting_quote" || key === "pending_shipping" || key === "awaiting_shipping") return "Menunggu Ongkir";
  if (key === "quote_ready") return "Ongkir Siap";
  if (key === "paid" || key === "completed" || key === "confirmed") return "Selesai";
  if (key === "pending_verification" || key === "payment_verification") return "Verifikasi";
  if (key === "expired") return "Kedaluwarsa";
  if (key === "cancelled" || key === "canceled" || key === "failed") return "Dibatalkan";
  if (key === "unpaid" || key === "pending") return "Menunggu";
  return key ? key.replace(/_/g, " ") : "-";
}

function mapStatusClass(value?: string | null): string {
  const key = String(value || "").trim().toLowerCase();
  if (key === "awaiting_quote" || key === "pending_shipping" || key === "awaiting_shipping") return "bg-violet-50 text-violet-700 border-violet-200";
  if (key === "quote_ready") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (key === "paid" || key === "completed" || key === "confirmed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "pending_verification" || key === "payment_verification") return "bg-sky-50 text-sky-700 border-sky-200";
  if (key === "expired") return "bg-slate-100 text-slate-700 border-slate-200";
  if (key === "cancelled" || key === "canceled" || key === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function isAwaitingShippingQuote(
  status?: string | null,
  paymentStatus?: string | null,
  shippingQuoteReady?: boolean,
  hasShippingAddress?: boolean,
): boolean {
  if (!hasShippingAddress) {
    return true;
  }
  const candidates = [status, paymentStatus]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  if (candidates.some((item) => item === "awaiting_shipping" || item === "pending_shipping" || item === "awaiting_quote")) {
    return true;
  }
  const normalizedPaymentStatus = String(paymentStatus || "").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  // For web orders using manual quote, shipping quote must be explicitly marked ready.
  if ((normalizedStatus === "pending" || normalizedPaymentStatus === "unpaid") && !shippingQuoteReady) {
    return true;
  }
  return false;
}

interface CustomerOrderPageProps {
  orderID?: string;
}

export default function CustomerOrderPage({ orderID = "" }: CustomerOrderPageProps) {
  const resolvedOrderID = useMemo(() => {
    if (orderID.trim()) return orderID.trim();
    if (typeof window === "undefined") return "";
    const segments = window.location.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  }, [orderID]);

  const [detail, setDetail] = useState<MyOrderDetailResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedProviderID, setSelectedProviderID] = useState("");
  const [senderBankName, setSenderBankName] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [senderAccountHolder, setSenderAccountHolder] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferredAt, setTransferredAt] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofsByPaymentID, setProofsByPaymentID] = useState<Record<string, PaymentProof[]>>({});
  const [openingProofKey, setOpeningProofKey] = useState("");
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressID, setSelectedAddressID] = useState("");
  const [shippingAddressError, setShippingAddressError] = useState("");
  const [updatingShippingAddress, setUpdatingShippingAddress] = useState(false);

  const loadDetail = async () => {
    if (!resolvedOrderID) {
      setError("Order ID tidak ditemukan.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await getMyOrderByID(resolvedOrderID);
      setDetail(response.data);
      const defaultProviderID = response.data.providers?.[0]?.id || "";
      setSelectedProviderID((current) => current || defaultProviderID);
      setTransferAmount(String(Math.max(0, response.data.order.grand_total || 0)));
      setTransferredAt(new Date().toISOString().slice(0, 16));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Gagal memuat detail order";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadAddresses = async () => {
    setShippingAddressError("");
    try {
      const rows = await listMyCustomerAddresses();
      setAddresses(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Gagal memuat alamat";
      setShippingAddressError(message);
      setAddresses([]);
    }
  };

  const handleApplyShippingAddress = async () => {
    if (!order?.id || !selectedAddressID) return;
    if (shippingAddressLocked) {
      const message = "Alamat tidak bisa diubah karena ongkir sudah dibuat.";
      setShippingAddressError(message);
      notifyError(message);
      return;
    }
    setUpdatingShippingAddress(true);
    setShippingAddressError("");
    try {
      await updateMyOrderShippingAddress(order.id, selectedAddressID);
      notifySuccess("Alamat pengiriman diperbarui. Menunggu konfirmasi ongkir baru.");
      await loadDetail();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Gagal memperbarui alamat pengiriman";
      setShippingAddressError(message);
      notifyError(message);
    } finally {
      setUpdatingShippingAddress(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStatusMessage("");
    if (!getCustomerAuthToken()) {
      window.location.replace(buildCustomerAuthLoginUrl(window.location.pathname + window.location.search + window.location.hash));
      return;
    }
    void loadDetail();
  }, [resolvedOrderID]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getCustomerAuthToken()) return;
    void loadAddresses();
  }, []);

  const order = detail?.order ?? null;
  const business = (detail?.business as PublicBusiness | null | undefined) ?? null;
  const payments = detail?.payments || [];
  const providers = detail?.providers || [];
  const appliedCoupons = order?.applied_coupons || [];
  const selectedProvider = providers.find((item) => item.id === selectedProviderID) || null;
  const isBankTransfer = (selectedProvider?.provider_key || "").toLowerCase() === "bank_transfer";
  const latestPayment = payments[0] || null;
  const latestBankTransferMeta = parseMetadata(latestPayment?.metadata)?.bank_transfer || null;
  const shippingQuote = parseShippingQuote(order?.metadata);
  const shippingAddress = parseShippingAddress(order?.metadata);
  const shippingAddressID = String(shippingAddress?.address_id || "").trim();
  const shippingQuoteReady = Boolean(shippingQuote?.ready);
  const shippingAddressLocked = shippingQuoteReady;
  const awaitingShippingQuote = isAwaitingShippingQuote(order?.status, order?.payment_status, shippingQuoteReady, Boolean(shippingAddressID));

  useEffect(() => {
    if (shippingAddressID) {
      setSelectedAddressID(shippingAddressID);
      return;
    }
    if (addresses.length > 0) {
      const primary = addresses.find((item) => item.is_primary) || addresses[0];
      setSelectedAddressID(primary?.id || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, shippingAddressID]);
  const taxBreakdown = useMemo(() => {
    const groups = new Map<string, { taxType: string; taxRate: number; amount: number }>();
    for (const item of order?.order_items || []) {
      const taxType = String(item.tax_type || "exclude").toLowerCase() === "include" ? "include" : "exclude";
      const taxRate = Number(item.tax_rate || 0);
      const key = `${taxType}:${taxRate.toFixed(4)}`;
      const current = groups.get(key) || { taxType, taxRate, amount: 0 };
      current.amount += Number(item.tax_amount || 0);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate || a.taxType.localeCompare(b.taxType));
  }, [order?.order_items]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!order || payments.length === 0) {
        setProofsByPaymentID({});
        return;
      }

      const entries = await Promise.all(
        payments.map(async (payment) => {
          try {
            const result = await listMyOrderPaymentProofs(order.id, payment.id);
            return [payment.id, (result.data || []) as PaymentProof[]] as const;
          } catch {
            return [payment.id, [] as PaymentProof[]] as const;
          }
        }),
      );

      if (!cancelled) {
        const next: Record<string, PaymentProof[]> = {};
        entries.forEach(([paymentID, list]) => {
          next[paymentID] = list;
        });
        setProofsByPaymentID(next);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [order?.id, payments]);

  const canSubmit = useMemo(() => {
    if (!order || !selectedProviderID) return false;
    if (awaitingShippingQuote) return false;
    if ((order.payment_status || "").toLowerCase() === "paid") return false;
    if (!isBankTransfer) return true;
    if (!senderBankName.trim() || !senderAccountNumber.trim() || !senderAccountHolder.trim()) return false;
    if (!transferAmount.trim() || Number.isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) return false;
    if (!transferredAt.trim()) return false;
    if (proofFiles.length === 0) return false;
    return true;
  }, [awaitingShippingQuote, isBankTransfer, order, proofFiles, selectedProviderID, senderAccountHolder, senderAccountNumber, senderBankName, transferAmount, transferredAt]);

  useEffect(() => {
    if (typeof window === "undefined" || !order?.id) return;
    const key = `post_checkout_notice:${order.id}`;
    const notice = window.sessionStorage.getItem(key);
    if (notice) {
      setStatusMessage(notice);
      window.sessionStorage.removeItem(key);
      return;
    }
    if (awaitingShippingQuote && !statusMessage) {
      setStatusMessage(
        "Pesanan diterima. Tim kami akan menghubungi Anda via WhatsApp untuk konfirmasi ongkir dan total pembayaran.",
      );
    }
  }, [awaitingShippingQuote, order?.id, statusMessage]);

  const handleStartPayment = async () => {
    if (!order || !selectedProvider) return;

    setSubmitting(true);
    setError("");
    try {
      if (isBankTransfer) {
        const form = new FormData();
        form.set("provider_id", selectedProvider.id);
        form.set("sender_bank_name", senderBankName.trim());
        form.set("sender_account_number", senderAccountNumber.trim());
        form.set("sender_account_holder", senderAccountHolder.trim());
        form.set("transfer_amount", String(Number(transferAmount)));
        form.set("transferred_at", new Date(transferredAt).toISOString());
        form.set("reference", transferReference.trim());
        if (proofNotes.trim()) {
          form.set("proof_notes", proofNotes.trim());
        }
        proofFiles.forEach((file) => form.append("proof", file));
        await startMyOrderPayment(order.id, form);
      } else {
        await startMyOrderPayment(order.id, { provider_id: selectedProvider.id });
      }

      notifySuccess("Pembayaran berhasil dibuat.");
      setStatusMessage(isBankTransfer ? "Konfirmasi pembayaran terkirim. Tim kami akan memverifikasi bukti transfer Anda." : "Pembayaran baru berhasil dibuat. Silakan lanjutkan sesuai instruksi metode pembayaran.");
      setProofFiles([]);
      setProofNotes("");
      await loadDetail();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Gagal memulai pembayaran";
      setError(message);
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order?.id) return;
    setDownloadingInvoice(true);
    try {
      const blob = await downloadMyOrderInvoice(order.id);
      const objectURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectURL;
      link.download = `invoice-${order.order_number || order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 60_000);
      notifySuccess("Invoice berhasil diunduh.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengunduh invoice";
      setError(message);
      notifyError(message);
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const openProof = async (paymentID: string, proofID: string) => {
    if (!order?.id) return;
    const opKey = `${paymentID}:${proofID}`;
    setOpeningProofKey(opKey);
    try {
      const blob = await getMyOrderPaymentProofBlob(order.id, paymentID, proofID);
      const objectURL = URL.createObjectURL(blob);
      window.open(objectURL, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectURL), 120_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuka bukti pembayaran";
      setError(message);
      notifyError(message);
    } finally {
      setOpeningProofKey("");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/customer/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke dashboard
            </a>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">Detail Order</h1>
            <p className="mt-2 text-sm text-slate-500">Pantau status order dan lanjutkan pembayaran dari halaman ini.</p>
          </div>
          {order ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Order</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{order.order_number}</div>
              <div className="mt-1 text-xs text-slate-500">Dibuat {formatDateTime(order.created_at)}</div>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {statusMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>
        ) : null}

        {loading ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" />
              Memuat detail order...
            </div>
          </section>
        ) : !order ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Order tidak ditemukan</h2>
            <p className="mt-2 text-sm text-slate-500">Pastikan order ini milik akun yang sedang login.</p>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><Receipt className="h-4 w-4" /> Status Order</div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${mapStatusClass(order.status)}`}>
                      {mapStatusLabel(order.status)}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><CreditCard className="h-4 w-4" /> Status Bayar</div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${mapStatusClass(order.payment_status)}`}>
                      {mapStatusLabel(order.payment_status)}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><Building2 className="h-4 w-4" /> Business</div>
                  <div className="mt-3">
                    {business?.slug ? (
                      <a href={`/b/${business.slug}`} className="block break-words text-sm font-semibold text-emerald-700 transition hover:text-emerald-600 hover:underline">
                        {business.name}
                      </a>
                    ) : (
                      <div className="break-all text-sm font-medium text-slate-900">{business?.name || order.business_id || "-"}</div>
                    )}
                    {business?.slug ? <div className="mt-1 text-xs text-slate-500">/b/{business.slug}</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><ShieldCheck className="h-4 w-4" /> Total</div>
                  <div className="mt-3 text-lg font-semibold text-slate-900">{toCurrency(order.grand_total, order.currency)}</div>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Item Order</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Produk</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Harga</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Pajak</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(order.order_items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-3 text-sm text-slate-800">
                            <div className="font-medium text-slate-900">{item.product_name || item.product_id || "Produk"}</div>
                            <div className="text-xs text-slate-500">{item.sku || item.product_id || "-"}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                              <span className={`rounded-full px-2 py-0.5 ${String(item.tax_type || "exclude") === "include" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                                {formatTaxMode(item.tax_type, item.tax_rate)}
                              </span>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                Pajak {toCurrency(item.tax_amount, order.currency)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-slate-700">{item.qty}</td>
                          <td className="px-3 py-3 text-right text-sm text-slate-700">{toCurrency(item.unit_price, order.currency)}</td>
                          <td className="px-3 py-3 text-right text-sm text-slate-700">{toCurrency(item.tax_amount, order.currency)}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900">{toCurrency(item.line_total, order.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Riwayat Pembayaran</h2>
                {payments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Belum ada pembayaran untuk order ini.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {payments.map((payment: Payment) => {
                      const metadata = parseMetadata(payment.metadata);
                      const bankTransfer = metadata?.bank_transfer as Record<string, any> | undefined;
                      return (
                        <article key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{payment.gateway_name || payment.payment_method || payment.provider_key || "Payment"}</div>
                              <div className="mt-1 text-xs text-slate-500">{payment.id}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">{toCurrency(payment.amount, payment.currency)}</div>
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mapStatusClass(payment.status)}`}>
                                  {mapStatusLabel(payment.status)}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mapStatusClass(payment.proof_status)}`}>
                                  Bukti: {mapStatusLabel(payment.proof_status)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {bankTransfer ? (
                            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                              <div>
                                <div className="font-medium text-slate-800">Bank Pengirim</div>
                                <div>{bankTransfer.sender_bank?.bank_name || "-"}</div>
                                <div>{bankTransfer.sender_bank?.account_number || "-"}</div>
                                <div>{bankTransfer.sender_bank?.account_holder || "-"}</div>
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">Transfer</div>
                                <div>{toCurrency(Number(bankTransfer.transfer?.amount || 0), payment.currency)}</div>
                                <div>{formatDateTime(String(bankTransfer.transfer?.transferred_at || ""))}</div>
                                <div>{bankTransfer.transfer?.reference || "-"}</div>
                              </div>
                            </div>
                          ) : null}
                          {(proofsByPaymentID[payment.id] || []).length > 0 ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bukti Transfer</div>
                              <div className="mt-2 space-y-2">
                                {(proofsByPaymentID[payment.id] || []).map((proof) => {
                                  const opKey = `${payment.id}:${proof.id}`;
                                  return (
                                    <div key={proof.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                                      <div className="min-w-0">
                                        <div className="truncate font-medium text-slate-800">{proof.id}</div>
                                        <div className="text-slate-500">{proof.status} · {formatDateTime(proof.created_at)}</div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openProof(payment.id, proof.id)}
                                        disabled={openingProofKey === opKey}
                                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        {openingProofKey === opKey ? "Membuka..." : "Lihat"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                              Belum ada file bukti pembayaran pada transaksi ini.
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {shippingAddress ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">Alamat Pengiriman</h2>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="font-semibold text-slate-900">
                      {String(shippingAddress.receiver_name || "-")}
                      {shippingAddress.label ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{String(shippingAddress.label)}</span> : null}
                    </div>
                    <div>{String(shippingAddress.phone_number || "-")}</div>
                    <div>
                      {String(
                        shippingAddress.address_summary ||
                          [
                            shippingAddress.address_line_1,
                            shippingAddress.address_line_2,
                            shippingAddress.subdistrict,
                            shippingAddress.district,
                            shippingAddress.city,
                            shippingAddress.province,
                            shippingAddress.postal_code,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                          "-",
                      )}
                    </div>
                  </div>
                </section>
              ) : null}
            </section>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Ringkasan</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.subtotal, order.currency)}</span>
                  </div>
                  {(order.discount_amount || 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Diskon</span>
                      <span className="font-medium text-slate-900">-{toCurrency(order.discount_amount, order.currency)}</span>
                    </div>
                  )}
                  {appliedCoupons.length > 0 && (
                    <div className="ml-3 space-y-1 border-l-2 border-slate-300 pl-3">
                      {appliedCoupons.map((coupon) => (
                        <div key={coupon.code} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Kupon {coupon.code}</span>
                          <span className="font-medium text-slate-700">-{toCurrency(coupon.discount_amount, order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Pajak</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.tax_amount || 0, order.currency)}</span>
                  </div>
                  {taxBreakdown.length > 0 ? (
                    <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {taxBreakdown.map((group) => (
                        <div key={`${group.taxType}-${group.taxRate}`} className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Pajak {formatTaxMode(group.taxType, group.taxRate)}</span>
                          <span className="font-medium text-slate-800">{toCurrency(group.amount, order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span>Ongkir</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.shipping_amount, order.currency)}</span>
                  </div>
                  {shippingQuote ? (
                    <CourierCard shippingQuote={shippingQuote} fallbackAmount={order.shipping_amount} currency={order.currency} />
                  ) : null}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Alamat Pengiriman</div>
                    {shippingAddress ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {String(shippingAddress.receiver_name || "-")}
                          {shippingAddress.label ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{String(shippingAddress.label)}</span> : null}
                        </div>
                        <div>{String(shippingAddress.phone_number || "-")}</div>
                        <div>
                          {String(
                            shippingAddress.address_summary ||
                              [
                                shippingAddress.address_line_1,
                                shippingAddress.address_line_2,
                                shippingAddress.subdistrict,
                                shippingAddress.district,
                                shippingAddress.city,
                                shippingAddress.province,
                                shippingAddress.postal_code,
                              ]
                                .filter(Boolean)
                                .join(", ") ||
                              "-",
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {addresses.length > 0 ? (
                        <select
                          value={selectedAddressID}
                          onChange={(event) => setSelectedAddressID(event.target.value)}
                          disabled={shippingAddressLocked || updatingShippingAddress}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <option value="">Pilih alamat</option>
                          {addresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {(address.label || "Alamat") + (address.is_primary ? " (Utama)" : "") + " - " + address.receiver_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
                          Belum ada alamat tersimpan. Tambahkan alamat dulu dari dashboard agar checkout bisa lanjut.
                        </div>
                      )}

                      {addresses.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleApplyShippingAddress()}
                          disabled={!selectedAddressID || updatingShippingAddress || selectedAddressID === shippingAddressID || shippingAddressLocked}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingShippingAddress ? "Menyimpan alamat..." : shippingAddressLocked ? "Alamat Dikunci" : selectedAddressID === shippingAddressID ? "Alamat Aktif" : "Pakai Alamat Ini"}
                        </button>
                      ) : (
                        <a href="/customer/dashboard?tab=addresses" className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                          Buka Dashboard Alamat
                        </a>
                      )}

                      {shippingAddressLocked ? <p className="text-xs text-amber-700">Alamat dikunci karena ongkir sudah dibuat. Untuk mengganti alamat, ongkir harus direset terlebih dulu.</p> : null}
                      <p className="text-xs text-slate-500">Mengganti alamat akan menghapus ongkir sebelumnya dan menunggu konfirmasi ongkir baru.</p>
                      {shippingAddressError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{shippingAddressError}</div> : null}
                    </div>
                  </div>
                  
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Grand Total</span>
                    <span className="text-lg font-bold text-slate-900">{toCurrency(order.grand_total, order.currency)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {downloadingInvoice ? "Mengunduh invoice..." : "Unduh Invoice"}
                </button>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Pembayaran</h2>
                {(order.payment_status || "").toLowerCase() === "paid" ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Order ini sudah lunas.
                  </div>
                ) : awaitingShippingQuote ? (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    Pembayaran belum tersedia. Tim kami akan menghubungi Anda via WhatsApp setelah ongkir dan total final dikonfirmasi.
                  </div>
                ) : (
                  <>
                    {providers.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Belum ada metode pembayaran aktif untuk order ini.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {providers.map((provider: OrderPaymentProvider) => (
                          <label key={provider.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-emerald-300">
                            <input
                              type="radio"
                              name="payment_provider"
                              className="mt-1"
                              checked={selectedProviderID === provider.id}
                              onChange={() => setSelectedProviderID(provider.id)}
                            />
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{provider.name}</div>
                              <div className="text-xs text-slate-500">{provider.provider_key}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {selectedProvider && isBankTransfer ? (
                      <div className="mt-5 space-y-4">
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <div className="font-semibold">Tujuan Transfer</div>
                          <div className="mt-2">Bank: {selectedProvider.config?.bank_name || "-"}</div>
                          <div>No. Rekening: {selectedProvider.config?.account_number || "-"}</div>
                          <div>Atas Nama: {selectedProvider.config?.account_holder || selectedProvider.config?.account_name || "-"}</div>
                          {selectedProvider.config?.instructions ? <div className="mt-2 text-xs">{selectedProvider.config.instructions}</div> : null}
                        </div>

                        <div className="grid gap-3">
                          <input value={senderBankName} onChange={(e) => setSenderBankName(e.target.value)} placeholder="Bank pengirim" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={senderAccountNumber} onChange={(e) => setSenderAccountNumber(e.target.value)} placeholder="Nomor rekening pengirim" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={senderAccountHolder} onChange={(e) => setSenderAccountHolder(e.target.value)} placeholder="Nama pemilik rekening" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Jumlah transfer" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input type="datetime-local" value={transferredAt} onChange={(e) => setTransferredAt(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder="Referensi transfer (opsional)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <textarea value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder="Catatan bukti pembayaran (opsional)" className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            <Upload className="h-4 w-4" />
                            <span>{proofFiles.length > 0 ? `${proofFiles.length} file dipilih` : "Upload bukti transfer"}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {latestBankTransferMeta ? (
                      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                        <div className="font-semibold">Konfirmasi terakhir</div>
                        <div className="mt-2">Bank pengirim: {latestBankTransferMeta.sender_bank?.bank_name || "-"}</div>
                        <div>Nominal: {toCurrency(Number(latestBankTransferMeta.transfer?.amount || 0), order.currency)}</div>
                        <div>Waktu: {formatDateTime(String(latestBankTransferMeta.transfer?.transferred_at || ""))}</div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleStartPayment}
                      disabled={providers.length === 0 || !canSubmit || submitting}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Memproses..." : isBankTransfer ? "Kirim Konfirmasi Pembayaran" : "Buat Pembayaran"}
                    </button>
                  </>
                )}
              </section>
            </aside>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}