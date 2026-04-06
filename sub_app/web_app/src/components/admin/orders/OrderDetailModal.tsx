import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminGet, adminPost, adminPostForm, adminDelete, adminGetBlob } from "../entities/adminApi";
import AdminModal from "../ui/AdminModal";
import { downloadOrderInvoice, generateCheckoutLink, listPaymentProofs, getOrderByID, updateShippingQuote } from "./api";
import type { Order, Payment, PaymentProof } from "./types";

type Props = {
  open: boolean;
  loading: boolean;
  order: Order | null;
  customersByID?: Record<string, { name?: string; email?: string }>;
  onClose: () => void;
  onRefresh?: () => Promise<void> | (() => void);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const money = (currency: string, amount: number) => {
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: safeCurrency, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${safeCurrency} ${Number(amount || 0).toFixed(2)}`;
  }
};

const formatTaxPercent = (rate?: number | null) => {
  if (!rate || rate <= 0) return "0%";
  const normalized = rate <= 1 ? rate * 100 : rate;
  const rounded = Math.round(normalized * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
};

const formatTaxMode = (taxType?: string | null, taxRate?: number | null) => {
  const mode = String(taxType || "").toLowerCase() === "include" ? "Include" : "Exclude";
  return `${mode} ${formatTaxPercent(taxRate)}`;
};

type ShippingQuoteFormState = {
  shipping_amount: string;
  carrier_name: string;
  service_name: string;
  tracking_number: string;
  estimated_delivery: string;
  description: string;
  notes: string;
};

const defaultShippingQuoteForm: ShippingQuoteFormState = {
  shipping_amount: "",
  carrier_name: "",
  service_name: "",
  tracking_number: "",
  estimated_delivery: "",
  description: "",
  notes: "",
};

const parseOrderMetadata = (raw: unknown): Record<string, unknown> | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;

  const text = raw.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // continue to base64 decode fallback
  }

  try {
    const decoded = typeof window !== "undefined" ? window.atob(text) : "";
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
};

const statusClasses = (status?: string) => {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "rejected":
      return { wrapper: "border-red-200 bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700" };
    case "cancelled":
    case "canceled":
      return { wrapper: "border-slate-200 bg-slate-50", text: "text-slate-700", badge: "bg-slate-100 text-slate-700" };
    case "pending":
    case "pending_verification":
      return { wrapper: "border-amber-200 bg-amber-50", text: "text-amber-900", badge: "bg-amber-100 text-amber-900" };
    default:
      return { wrapper: "border-amber-200 bg-amber-50", text: "text-amber-900", badge: "bg-amber-100 text-amber-900" };
  }
};

export default function OrderDetailModal({ open, loading, order, customersByID, onClose, onRefresh }: Props) {
  const [generatingLink, setGeneratingLink] = useState(false);
  const [checkoutURL, setCheckoutURL] = useState("");
  const [proofsByPaymentID, setProofsByPaymentID] = useState<Record<string, PaymentProof[]>>({});
  const [openingProofKey, setOpeningProofKey] = useState("");
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});
  const [localOrder, setLocalOrder] = useState<Order | null>(order);
  const [manageProofPaymentID, setManageProofPaymentID] = useState("");
  const [manageProofFiles, setManageProofFiles] = useState<Record<string, File[]>>({});
  const [submittingProof, setSubmittingProof] = useState(false);
  const [paymentRefreshing, setPaymentRefreshing] = useState<Record<string, boolean>>({});
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [shippingQuoteForm, setShippingQuoteForm] = useState<ShippingQuoteFormState>(defaultShippingQuoteForm);
  const [savingShippingQuote, setSavingShippingQuote] = useState(false);

  useEffect(() => {
    if (!open) {
      setCheckoutURL("");
      setGeneratingLink(false);
      setProofsByPaymentID({});
      setOpeningProofKey("");
      setExpandedPayments({});
      setLocalOrder(null);
    }
  }, [open, order?.id]);

  useEffect(() => {
    setLocalOrder(order);
  }, [order?.id]);

  useEffect(() => {
    const metadata = parseOrderMetadata((order as Order | null)?.metadata);
    const shippingQuote = (metadata?.shipping_quote || metadata?.shippingQuote) as Record<string, any> | undefined;
    if (!shippingQuote) {
      setShippingQuoteForm(defaultShippingQuoteForm);
      return;
    }
    setShippingQuoteForm({
      shipping_amount: shippingQuote.shipping_amount != null ? String(shippingQuote.shipping_amount) : "",
      carrier_name: String(shippingQuote.carrier_name || ""),
      service_name: String(shippingQuote.service_name || ""),
      tracking_number: String(shippingQuote.tracking_number || ""),
      estimated_delivery: String(shippingQuote.estimated_delivery || ""),
      description: String(shippingQuote.description || ""),
      notes: String(shippingQuote.notes || ""),
    });
  }, [order?.id, order?.metadata]);

  useEffect(() => {
    // initialize expanded state: collapse rejected/cancelled by default
    if (!order || !order.payments) return;
    const next: Record<string, boolean> = {};
    for (const p of order.payments) {
      const st = String(p.status || "").toLowerCase();
      if (st === "rejected" || st === "cancelled" || st === "canceled") {
        next[p.id] = false; // collapsed
      } else {
        next[p.id] = true; // expanded
      }
    }
    setExpandedPayments(next);
  }, [order?.id, order?.payments]);


  const displayOrder = localOrder ?? order;
  const displayCustomer = displayOrder?.customer ?? null;

  const sortedPayments = useMemo(() => {
    const payments = displayOrder?.payments || [];
    return [...payments].sort((a: Payment, b: Payment) => {
      const ta = a.updated_at ? new Date(String(a.updated_at)).getTime() : 0;
      const tb = b.updated_at ? new Date(String(b.updated_at)).getTime() : 0;
      return tb - ta;
    });
  }, [displayOrder?.payments]);

  useEffect(() => {
    if (!open || !order?.payments?.length) {
      return;
    }

    const bankTransferPaymentIDs = order.payments
      .filter((item) => String(item.provider_key || "").toLowerCase() === "bank_transfer")
      .map((item) => item.id);
    if (bankTransferPaymentIDs.length === 0) {
      setProofsByPaymentID({});
      return;
    }

    let active = true;
    (async () => {
      const pairs = await Promise.all(
        bankTransferPaymentIDs.map(async (paymentID) => {
          try {
            const res = await listPaymentProofs(paymentID);
            return [paymentID, res.data || []] as const;
          } catch {
            return [paymentID, [] as PaymentProof[]] as const;
          }
        }),
      );
      if (!active) return;
      const next: Record<string, PaymentProof[]> = {};
      for (const [paymentID, proofs] of pairs) {
        next[paymentID] = proofs;
      }
      setProofsByPaymentID(next);
    })();

    return () => {
      active = false;
    };
  }, [open, order?.id, order?.payments]);

  const parsePaymentMetadata = (raw: unknown): Record<string, unknown> | null => {
    if (!raw) return null;
    if (typeof raw === "object") return raw as Record<string, unknown>;
    if (typeof raw !== "string") return null;

    const text = raw.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // continue to base64 decode fallback
    }

    try {
      const decoded = typeof window !== "undefined" ? window.atob(text) : "";
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  };

  const openProof = async (paymentID: string, proofID: string) => {
    const opKey = `${paymentID}:${proofID}`;
    setOpeningProofKey(opKey);
    try {
      const blob = await adminGetBlob(`/admin/order/payments/${paymentID}/proofs/${proofID}/access`);
      const objectURL = URL.createObjectURL(blob);
      window.open(objectURL, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectURL), 60_000);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuka bukti transfer");
    } finally {
      setOpeningProofKey("");
    }
  };

  const refreshOrder = async () => {
    if (!order?.id) return;
    try {
      const res = await getOrderByID(order.id);
      setLocalOrder({ ...res.data.order, payments: res.data.payments || res.data.order.payments || [] });
      if (onRefresh) {
        try {
          // notify parent to refresh its copy as well
          await (onRefresh as () => Promise<void>)();
        } catch {
          try {
            (onRefresh as () => void)();
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const refreshPayment = async (paymentID: string) => {
    setPaymentRefreshing((s) => ({ ...s, [paymentID]: true }));
    try {
      try {
        const res = await listPaymentProofs(paymentID);
        setProofsByPaymentID((p) => ({ ...p, [paymentID]: res.data || [] }));
      } catch {
        setProofsByPaymentID((p) => ({ ...p, [paymentID]: [] }));
      }
      await refreshOrder();
    } catch (e) {
      // ignore
    } finally {
      setPaymentRefreshing((s) => ({ ...s, [paymentID]: false }));
    }
  };

  const shippingQuoteMetadata = useMemo(() => {
    const metadata = parseOrderMetadata(displayOrder?.metadata);
    return (metadata?.shipping_quote || metadata?.shippingQuote || null) as Record<string, any> | null;
  }, [displayOrder?.metadata]);

  const shippingAddressMetadata = useMemo(() => {
    const metadata = parseOrderMetadata(displayOrder?.metadata);
    return (metadata?.shipping_address || null) as Record<string, any> | null;
  }, [displayOrder?.metadata]);

  const taxBreakdown = useMemo(() => {
    const groups = new Map<string, { taxType: string; taxRate: number; amount: number }>();
    for (const item of displayOrder?.order_items || []) {
      const taxType = String(item.tax_type || "exclude").toLowerCase() === "include" ? "include" : "exclude";
      const taxRate = Number(item.tax_rate || 0);
      const key = `${taxType}:${taxRate.toFixed(4)}`;
      const current = groups.get(key) || { taxType, taxRate, amount: 0 };
      current.amount += Number(item.tax_amount || 0);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate || a.taxType.localeCompare(b.taxType));
  }, [displayOrder?.order_items]);

  const handleSaveShippingQuote = async () => {
    if (!displayOrder?.id) return;
    const amount = Number(shippingQuoteForm.shipping_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      notifyError("Ongkir harus angka >= 0");
      return;
    }

    setSavingShippingQuote(true);
    try {
      await updateShippingQuote(displayOrder.id, {
        shipping_amount: amount,
        carrier_name: shippingQuoteForm.carrier_name.trim(),
        service_name: shippingQuoteForm.service_name.trim(),
        tracking_number: shippingQuoteForm.tracking_number.trim(),
        estimated_delivery: shippingQuoteForm.estimated_delivery.trim(),
        description: shippingQuoteForm.description.trim(),
        notes: shippingQuoteForm.notes.trim(),
      });
      notifySuccess("Detail ongkir berhasil disimpan");
      await refreshOrder();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan detail ongkir");
    } finally {
      setSavingShippingQuote(false);
    }
  };

  const approvePayment = async (paymentID: string) => {
    try {
      const proofs = proofsByPaymentID[paymentID] || (await listPaymentProofs(paymentID)).data || [];
      if (proofs.length > 0) {
        const proof = proofs[proofs.length - 1];
        await adminPost(`/admin/order/payments/${paymentID}/proof/${proof.id}/approve`, {});
      } else {
        await adminPost(`/admin/order/payments/${paymentID}/status`, { status: "succeeded" });
      }
      notifySuccess("Payment berhasil dikonfirmasi");
      await refreshOrder();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal konfirmasi payment");
    }
  };

  const rejectPayment = async (paymentID: string) => {
    const reason = window.prompt("Alasan penolakan (wajib):");
    if (reason === null) return;
    if (!reason.trim()) {
      notifyError("Alasan harus diisi");
      return;
    }
    try {
      await adminPost(`/admin/order/payments/${paymentID}/reject`, { notes: reason.trim() });
      notifySuccess("Payment ditolak");
      await refreshOrder();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menolak payment");
    }
  };

  const recheckPayment = async (paymentID: string) => {
    try {
      await adminPost(`/admin/order/payments/${paymentID}/recheck`, { resolved_status: "succeeded" });
      notifySuccess("Recheck payment berhasil");
      await refreshOrder();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal recheck payment");
    }
  };

  const openManageProofs = async (paymentID: string) => {
    setManageProofPaymentID(paymentID);
    try {
      const res = await listPaymentProofs(paymentID);
      setProofsByPaymentID((p) => ({ ...p, [paymentID]: res.data || [] }));
    } catch {
      setProofsByPaymentID((p) => ({ ...p, [paymentID]: [] }));
    }
  };

  const uploadProofsForPayment = async (paymentID: string) => {
    const files = manageProofFiles[paymentID] || [];
    if (!files || files.length === 0) {
      notifyError("Pilih minimal 1 file bukti dulu");
      return;
    }
    setSubmittingProof(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("proof", file);
        await adminPostForm(`/admin/order/payments/${paymentID}/proof`, formData);
      }
      notifySuccess("Bukti transfer berhasil diupload");
      await refreshOrder();
      const res = await listPaymentProofs(paymentID);
      setProofsByPaymentID((p) => ({ ...p, [paymentID]: res.data || [] }));
      setManageProofFiles((p) => ({ ...p, [paymentID]: [] }));
      setManageProofPaymentID("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal upload bukti");
    } finally {
      setSubmittingProof(false);
    }
  };

  const deleteProofForPayment = async (paymentID: string, proofID: string) => {
    if (!window.confirm("Hapus bukti ini?")) return;
    try {
      await adminDelete(`/admin/order/payments/${paymentID}/proofs/${proofID}`);
      notifySuccess("Bukti dihapus");
      const res = await listPaymentProofs(paymentID);
      setProofsByPaymentID((p) => ({ ...p, [paymentID]: res.data || [] }));
      await refreshOrder();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus bukti");
    }
  };

  const canGenerateCheckoutLink = useMemo(() => {
    if (!order) return false;
    if (!order.customer_id) return false;
    const status = String(order.status || "").toLowerCase();
    const paymentStatus = String(order.payment_status || "").toLowerCase();
    if (status === "expired" || paymentStatus === "expired") return false;
    return paymentStatus !== "paid";
  }, [order]);

  const handleGenerateCheckoutLink = async () => {
    if (!order) return;
    setGeneratingLink(true);
    try {
      const res = await generateCheckoutLink(order.id, 3600);
      const relative = res.data.checkout_url || "";
      const full = relative.startsWith("http") ? relative : `${window.location.origin}${relative}`;
      setCheckoutURL(full);
      notifySuccess("Checkout link berhasil dibuat");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuat checkout link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyCheckoutLink = async () => {
    if (!checkoutURL) return;
    try {
      await navigator.clipboard.writeText(checkoutURL);
      notifySuccess("Checkout link berhasil disalin");
    } catch {
      notifyError("Gagal menyalin checkout link");
    }
  };

  const handleDownloadInvoice = async () => {
    if (!displayOrder?.id) return;
    setDownloadingInvoice(true);
    try {
      const blob = await downloadOrderInvoice(displayOrder.id);
      const objectURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectURL;
      anchor.download = `invoice-${displayOrder.order_number || displayOrder.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 60_000);
      notifySuccess("Invoice berhasil diunduh");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal mengunduh invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <AdminModal open={open} onClose={onClose} title={displayOrder ? `Order ${displayOrder.order_number}` : "Order Detail"} maxWidth="xl">
      
      {loading ? (
        <p className="text-sm text-slate-600">Loading detail...</p>
      ) : !displayOrder ? (
        <p className="text-sm text-slate-600">Order not found.</p>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-slate-500">Order Number</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{displayOrder.order_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Status</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{displayOrder.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Payment Status</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{displayOrder.payment_status}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Channel</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{displayOrder.channel || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Business ID</p>
              <p className="mt-1 break-all text-sm text-slate-900">{displayOrder.business_id || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">User ID</p>
              <p className="mt-1 break-all text-sm text-slate-900">{displayOrder.user_id || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Customer</p>
              {displayCustomer ? (
                <div className="mt-1 text-sm">
                  <a href={`/admin/customers/${displayCustomer.id}`} className="font-medium text-slate-900 hover:underline break-all">
                    {displayCustomer.name || displayCustomer.id}
                  </a>
                  {displayCustomer.email ? <div className="text-xs text-slate-500">{displayCustomer.email}</div> : null}
                </div>
              ) : (
                <p className="mt-1 break-all text-sm text-slate-900">{order?.customer_id || "-"}</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Created At</p>
              <p className="mt-1 text-sm text-slate-900">{formatDateTime(displayOrder.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Updated At</p>
              <p className="mt-1 text-sm text-slate-900">{formatDateTime(displayOrder.updated_at)}</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">Order Items</h4>
            {displayOrder?.order_items && displayOrder.order_items.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-700">Product</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-700">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-700">Unit Price</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-700">Tax</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-700">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayOrder.order_items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-sm text-slate-800">
                          <p className="font-medium">{item.product_name || item.product_id || "-"}</p>
                          <p className="text-xs text-slate-500">{item.product_id || ""}</p>
                          <p className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                            <span className={`rounded-full px-2 py-0.5 ${String(item.tax_type || "exclude") === "include" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                              {formatTaxMode(item.tax_type, item.tax_rate)}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                              Pajak {money(displayOrder?.currency || "", item.tax_amount)}
                            </span>
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-slate-700">{item.qty}</td>
                        <td className="px-3 py-2 text-right text-sm text-slate-700">{money(displayOrder?.currency || "", item.unit_price)}</td>
                        <td className="px-3 py-2 text-right text-sm text-slate-700">{money(displayOrder?.currency || "", item.tax_amount)}</td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">{money(displayOrder?.currency || "", item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Tidak ada item pada order ini.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">Payment History</h4>
                {sortedPayments && sortedPayments.length > 0 ? (
              <div className="mt-3 space-y-3">
                

                {sortedPayments
                  .filter((payment) => String(payment.provider_key || "").toLowerCase() === "bank_transfer")
                  .map((payment) => {
                    const metadata = parsePaymentMetadata(payment.metadata);
                    const bankTransfer = (metadata?.bank_transfer || {}) as Record<string, any>;
                    const senderBank = (bankTransfer.sender_bank || {}) as Record<string, any>;
                    const destinationBank = (bankTransfer.destination_bank || {}) as Record<string, any>;
                    const transfer = (bankTransfer.transfer || {}) as Record<string, any>;
                    const proofs = proofsByPaymentID[payment.id] || [];
                    const status = String(payment.status || "").toLowerCase();
                    const isCollapsible = status === "rejected" || status === "cancelled" || status === "canceled";
                    const expanded = !!expandedPayments[payment.id];

                    const classes = statusClasses(payment.status);

                    return (
                      <div key={`bank-transfer-${payment.id}`} className={`rounded-lg border ${classes.wrapper}`}>
                        <div className="p-3 flex items-center justify-between">
                          <div>
                            <h5 className={`text-sm font-semibold ${classes.text}`}>Bank Transfer Detail - {payment.id}</h5>
                            <div className={`text-xs ${classes.text}`}>Status: <span className={`ml-2 inline-block px-2 py-0.5 text-xs rounded ${classes.badge}`}>{payment.status}</span></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => refreshPayment(payment.id)}
                              disabled={!payment.id}
                              aria-label="Refresh payment proofs"
                              title="Refresh payment proofs"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              {paymentRefreshing[payment.id] ? "..." : "⟳"}
                            </button>
                            {isCollapsible ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPayments((s) => ({ ...s, [payment.id]: !expanded }))}
                                  className={`rounded border ${classes.wrapper.includes("amber") ? "border-amber-300" : classes.wrapper.includes("red") ? "border-red-300" : "border-slate-300"} bg-white px-3 py-1 text-xs ${classes.text} hover:opacity-90`}
                                >
                                  {expanded ? "Sembunyikan" : "Tampilkan"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {(!isCollapsible || expanded) && (
                          <div className={`p-3 pt-0 grid gap-3 text-sm ${classes.text} sm:grid-cols-2`}>
                            <div>
                              <p className="font-medium">Bank Pengirim Customer</p>
                              <p>Bank: {senderBank.bank_name || "-"}</p>
                              <p>No Rekening: {senderBank.account_number || "-"}</p>
                              <p>Atas Nama: {senderBank.account_holder || "-"}</p>
                            </div>
                            <div>
                              <p className="font-medium">Bank Tujuan</p>
                              <p>Bank: {destinationBank.bank_name || "-"}</p>
                              <p>No Rekening: {destinationBank.account_number || "-"}</p>
                              <p>Atas Nama: {destinationBank.account_name || "-"}</p>
                            </div>
                            <div>
                              <p className="font-medium">Transfer</p>
                              <p>Amount: {money(payment.currency || (displayOrder?.currency || ""), Number(transfer.amount || payment.amount || 0))}</p>
                              <p>Waktu Transfer: {formatDateTime(String(transfer.transferred_at || ""))}</p>
                              <p>Reference: {transfer.reference || "-"}</p>
                            </div>
                            <div>
                              <p className="font-medium">Bukti Transfer ({proofs.length})</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openManageProofs(payment.id)}
                                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                                >
                                  Manage Proofs
                                </button>
                                {((proofsByPaymentID[payment.id] || proofs) || []).length > 0 ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{(proofsByPaymentID[payment.id] || proofs).length} bukti</span>
                                ) : (
                                  <span className="text-xs text-amber-800">Belum ada bukti transfer.</span>
                                )}
                                <div className="ml-auto flex items-center gap-2">
                                  {((String(payment.status || "").toLowerCase() === "pending") || (String(payment.status || "").toLowerCase() === "pending_verification")) ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => approvePayment(payment.id)}
                                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => rejectPayment(payment.id)}
                                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              {(proofsByPaymentID[payment.id] || proofs).length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {(proofsByPaymentID[payment.id] || proofs).map((proof) => {
                                    const opKey = `${payment.id}:${proof.id}`;
                                    return (
                                      <div key={proof.id} className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-white px-2 py-1 text-xs">
                                        <span className="truncate text-slate-700">{proof.id} ({proof.status})</span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openProof(payment.id, proof.id)}
                                            disabled={openingProofKey === opKey}
                                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                                          >
                                            {openingProofKey === opKey ? "Membuka..." : "Lihat"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteProofForPayment(payment.id, proof.id)}
                                            className="text-xs text-rose-600 hover:underline"
                                          >
                                            Hapus
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Belum ada riwayat payment.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">Guest Checkout Link</h4>
            {!displayOrder.customer_id ? (
              <p className="mt-2 text-sm text-amber-700">Order ini tidak punya customer (`customer_id` kosong), jadi checkout link tidak bisa dibuat.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateCheckoutLink}
                    disabled={!canGenerateCheckoutLink || generatingLink}
                    className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                  >
                    {generatingLink ? "Generating..." : "Generate Checkout Link"}
                  </button>
                  {checkoutURL ? (
                    <button
                      type="button"
                      onClick={handleCopyCheckoutLink}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Copy Link
                    </button>
                  ) : null}
                </div>
                {checkoutURL ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 break-all">{checkoutURL}</div>
                ) : (
                  <p className="text-xs text-slate-500">TTL default: 1 jam. Link akan otomatis invalid setelah start payment pertama atau saat order sudah paid.</p>
                )}
              </div>
            )}
          </section>

          {shippingAddressMetadata ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">Alamat Pengiriman</h4>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Penerima</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {String(shippingAddressMetadata.receiver_name || "-")}
                    {shippingAddressMetadata.label ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{String(shippingAddressMetadata.label)}</span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Telepon</p>
                  <p className="mt-1 text-slate-900">{String(shippingAddressMetadata.phone_number || "-")}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase text-slate-500">Alamat</p>
                  <p className="mt-1 text-slate-900">
                    {String(
                      shippingAddressMetadata.address_summary ||
                        [
                          shippingAddressMetadata.address_line_1,
                          shippingAddressMetadata.address_line_2,
                          shippingAddressMetadata.subdistrict,
                          shippingAddressMetadata.district,
                          shippingAddressMetadata.city,
                          shippingAddressMetadata.province,
                          shippingAddressMetadata.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ") ||
                        "-",
                    )}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Shipping Quote</h4>
                <p className="mt-1 text-xs text-slate-500">Isi ongkir final dulu untuk buka pembayaran. Resi bisa diisi atau diupdate belakangan setelah barang dikirim.</p>
              </div>
              {shippingQuoteMetadata?.ready ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Ready</span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ongkir</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingQuoteForm.shipping_amount}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, shipping_amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kurir / Forwarder</span>
                <input
                  value={shippingQuoteForm.carrier_name}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, carrier_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="DHL / JNE / FedEx / Forwarder"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span>
                <input
                  value={shippingQuoteForm.service_name}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, service_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Express / Economy / Air / Sea"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Resi / Tracking</span>
                <input
                  value={shippingQuoteForm.tracking_number}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, tracking_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Nomor resi / airway bill"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ETA</span>
                <input
                  value={shippingQuoteForm.estimated_delivery}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="3-5 hari kerja / 7-14 hari"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi Ongkir</span>
                <input
                  value={shippingQuoteForm.description}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Alasan tarif, rute, volumetrik, dll"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan Internal / Ekstra</span>
                <textarea
                  value={shippingQuoteForm.notes}
                  onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Catatan tambahan, bea, asuransi, dokumen ekspor, dll"
                />
              </label>
            </div>

            {shippingQuoteMetadata ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Detail Ongkir Tersimpan</div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div>Kurir: {String(shippingQuoteMetadata.carrier_name || "-")}</div>
                  <div>Service: {String(shippingQuoteMetadata.service_name || "-")}</div>
                  <div>Resi: {String(shippingQuoteMetadata.tracking_number || "-")}</div>
                  <div>ETA: {String(shippingQuoteMetadata.estimated_delivery || "-")}</div>
                  <div className="sm:col-span-2">Deskripsi: {String(shippingQuoteMetadata.description || "-")}</div>
                  <div className="sm:col-span-2">Catatan: {String(shippingQuoteMetadata.notes || "-")}</div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveShippingQuote}
                disabled={savingShippingQuote}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingShippingQuote ? "Menyimpan..." : "Simpan / Update Ongkir & Resi"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">Invoice</h4>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice || !displayOrder?.id}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {downloadingInvoice ? "Downloading..." : "Download Invoice PDF"}
              </button>
              <p className="text-xs text-slate-500">PDF digenerate oleh backend lewat service wkhtml.</p>
            </div>
          </section>

          <AdminModal
            open={Boolean(manageProofPaymentID)}
            title="Manage Bukti Pembayaran"
            onClose={() => setManageProofPaymentID("")}
            maxWidth="md"
            footer={
              <>
                <button
                  type="button"
                  onClick={() => setManageProofPaymentID("")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => uploadProofsForPayment(manageProofPaymentID)}
                  disabled={submittingProof || !manageProofPaymentID}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Upload
                </button>
              </>
            }
          >
            <div className="space-y-3">
              {(proofsByPaymentID[manageProofPaymentID] || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Bukti yang sudah diupload</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {(proofsByPaymentID[manageProofPaymentID] || []).map((proof) => (
                      <div key={proof.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                        <div className="min-w-0 flex-1 text-xs text-slate-700">
                          <div className="truncate font-medium">{proof.id || "Proof file"}</div>
                          <div className="text-slate-500">{proof.status || "uploaded"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openProof(proof.payment_id, proof.id)}
                            className="text-xs text-blue-600 underline"
                            disabled={submittingProof}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProofForPayment(proof.payment_id, proof.id)}
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Belum ada bukti yang diupload.</p>
              )}

              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-medium text-slate-600">Tambah bukti baru</p>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,application/*"
                  onChange={(e) => {
                    if (!manageProofPaymentID) return;
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    setManageProofFiles((prev) => ({ ...prev, [manageProofPaymentID]: files }));
                  }}
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                />
                {(manageProofFiles[manageProofPaymentID] || []).length > 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 mt-2">
                    <p className="mb-2 text-xs font-medium text-slate-600">File terpilih:</p>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {(manageProofFiles[manageProofPaymentID] || []).map((file) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}`} className="truncate">{file.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </AdminModal>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">Amount Summary</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Subtotal</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(displayOrder?.currency || "", displayOrder?.subtotal || 0)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Discount</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(displayOrder?.currency || "", displayOrder?.discount_amount || 0)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Pajak</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(displayOrder?.currency || "", displayOrder?.tax_amount || 0)}</p>
              </div>
              {taxBreakdown.length > 0 ? (
                <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2 lg:col-span-5">
                  <p className="text-xs uppercase text-slate-500">Tax Breakdown</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {taxBreakdown.map((group) => (
                      <div key={`${group.taxType}-${group.taxRate}`} className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Pajak {formatTaxMode(group.taxType, group.taxRate)}</span>
                        <span className="font-medium text-slate-800">{money(displayOrder?.currency || "", group.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Ongkir</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(displayOrder?.currency || "", displayOrder?.shipping_amount || 0)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Grand Total</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(displayOrder?.currency || "", displayOrder?.grand_total || 0)}</p>
              </div>
            </div>
          </section>
          <div className="mt-4 flex justify-end gap-2">
            {displayOrder && String(displayOrder.payment_status || "").toLowerCase() === "paid" && String(displayOrder.status || "").toLowerCase() !== "confirmed" ? (
              <button
                type="button"
                onClick={async () => {
                  if (!displayOrder) return;
                  if (!window.confirm('Mark order as \"confirmed\"?')) return;
                  try {
                    await adminPost(`/admin/order/orders/${displayOrder.id}/status`, { status: 'confirmed' });
                    notifySuccess('Order status updated');
                    await refreshOrder();
                  } catch (err) {
                    notifyError(err instanceof Error ? err.message : 'Gagal update order status');
                  }
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Mark Confirmed
              </button>
            ) : displayOrder && displayOrder.payment_status && displayOrder.payment_status.toLowerCase() !== "paid" && String(displayOrder.status || "").toLowerCase() !== "expired" && String(displayOrder.payment_status || "").toLowerCase() !== "expired" ? (
              <a
                href={`/admin/pos?order_id=${displayOrder.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Edit in POS
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
