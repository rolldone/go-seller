/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CreditCard, LoaderCircle, Receipt, ShieldCheck, Upload } from "lucide-react";
import Footer from "./Footer";
import CourierCard from "./CourierCard";
import type { PublicBusiness } from "./business/types";
import { useTranslations } from "../../i18n";
import { buildCustomerAuthLoginUrl } from "../../lib/customerAuthRedirect";
import { getCustomerAuthToken, listMyCustomerAddresses, type CustomerAddress } from "../customer/auth/authApi";
import { notifyError, notifySuccess } from "../../lib/notification";
import { buildLocalizedPath } from "../../lib/siteLocale";
import { formatAmount } from "../../lib/amountFormat";
import {
  approveMyOrderCustomerConfirmation,
  downloadMyOrderInvoice,
  getMyOrderByID,
  getMyOrderPaymentProofBlob,
  listMyOrderReviewableItems,
  listMyOrderPaymentProofs,
  upsertMyOrderItemReview,
  rejectMyOrderCustomerConfirmation,
  updateMyOrderShippingAddress,
  startMyOrderPayment,
  listOrderPaymentMethods,
  type ReviewableOrderItem,
  type MyOrderDetailResponse,
  type OrderPaymentProvider,
  type OrderPaymentMethod,
  type Payment,
  type PaymentProof,
  type PaymentInstruction,
} from "../../lib/orderApi";

type ReviewDraft = {
  rating: number;
  review_text: string;
  question_text: string;
  attachments: File[];
};

type ReviewAttachmentMeta = {
  name?: string;
  publicUrl?: string;
  public_url?: string;
  storageKey?: string;
  storage_key?: string;
  mimeType?: string;
  mime_type?: string;
  fileSize?: number;
  file_size?: number;
};

const MAX_REVIEW_ATTACHMENTS = 5;
const MAX_REVIEW_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const EMPTY_PAYMENTS: Payment[] = [];

function createEmptyReviewDraft(existing?: Partial<ReviewDraft>): ReviewDraft {
  return {
    rating: existing?.rating || 5,
    review_text: existing?.review_text || "",
    question_text: existing?.question_text || "",
    attachments: existing?.attachments || [],
  };
}

function parseReviewAttachments(value: unknown): ReviewAttachmentMeta[] {
  const metadata = parseMetadata(value);
  const attachments = Array.isArray(metadata?.attachments) ? metadata.attachments : [];
  return attachments
    .map((item) => (item && typeof item === "object" ? (item as ReviewAttachmentMeta) : null))
    .filter((item): item is ReviewAttachmentMeta => Boolean(item));
}

function ReviewAttachmentPreviewStrip({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [items, setItems] = useState<Array<{ key: string; url: string; file: File }>>([]);

  useEffect(() => {
    const nextItems = files.map((file) => ({
      key: `${file.name}:${file.size}:${file.lastModified}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setItems(nextItems);

    return () => {
      nextItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {item.file.type.startsWith("video/") ? (
              <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{item.file.name}</div>
            <div className="text-xs text-slate-500">{item.file.type || "file"}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              const index = items.findIndex((entry) => entry.key === item.key);
              if (index >= 0) {
                onRemove(index);
              }
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
            aria-label={`Hapus ${item.file.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function toCurrency(value: number, currency = "IDR"): string {
  const formatted = formatAmount(Math.max(0, Math.round(value)), { fractionDigits: 0 });
  return currency ? `${currency} ${formatted}` : formatted;
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

function getPaymentSortTime(payment: Payment): number {
  const updatedAt = Date.parse(payment.updated_at || "");
  if (!Number.isNaN(updatedAt)) return updatedAt;
  const createdAt = Date.parse(payment.created_at || "");
  if (!Number.isNaN(createdAt)) return createdAt;
  return 0;
}

function pickLatestPayment(payments?: Payment[] | null): Payment | null {
  if (!payments || payments.length === 0) return null;
  return payments.reduce<Payment | null>((latest, payment) => {
    if (!latest) return payment;
    return getPaymentSortTime(payment) >= getPaymentSortTime(latest) ? payment : latest;
  }, null);
}

function isActivePaymentState(value?: string | null): boolean {
  const status = normalizePaymentState(value);
  return status === "pending" || status === "pending_verification";
}

function pickLatestPaymentInstruction(payments?: Payment[] | null): PaymentInstruction | null {
  const latestPayment = pickLatestPayment(payments);
  if (!latestPayment) return null;
  if (!isActivePaymentState(latestPayment.status)) {
    return null;
  }
  return latestPayment.payment_instruction ?? null;
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

function parseCustomerConfirmation(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.customer_confirmation;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function parseDisputeMetadata(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.dispute;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function mapStatusLabel(value?: string | null): string {
  const key = String(value || "").trim().toLowerCase();
  if (key === "awaiting_quote" || key === "pending_shipping" || key === "awaiting_shipping") return "orderStatus.awaitingQuote";
  if (key === "shipped") return "orderStatus.shipped";
  if (key === "waiting_customer_confirmation") return "orderStatus.waitingCustomerConfirmation";
  if (key === "in_dispute") return "orderStatus.inDispute";
  if (key === "refunded") return "orderStatus.refunded";
  if (key === "quote_ready") return "orderStatus.quoteReady";
  if (key === "paid") return "orderStatus.paid";
  if (key === "completed") return "orderStatus.completed";
  if (key === "processing" || key === "confirmed") return "orderStatus.processing";
  if (key === "pending_verification" || key === "payment_verification") return "orderStatus.verification";
  if (key === "expired") return "orderStatus.expired";
  if (key === "cancelled" || key === "canceled" || key === "failed") return "orderStatus.cancelled";
  if (key === "unpaid" || key === "pending") return "orderStatus.pending";
  return key || "-";
}

function mapStatusClass(value?: string | null): string {
  const key = String(value || "").trim().toLowerCase();
  if (key === "awaiting_quote" || key === "pending_shipping" || key === "awaiting_shipping") return "bg-violet-50 text-violet-700 border-violet-200";
  if (key === "shipped") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (key === "waiting_customer_confirmation") return "bg-sky-50 text-sky-700 border-sky-200";
  if (key === "in_dispute") return "bg-rose-50 text-rose-700 border-rose-200";
  if (key === "refunded") return "bg-slate-100 text-slate-700 border-slate-200";
  if (key === "quote_ready") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (key === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "paid") return "bg-teal-50 text-teal-700 border-teal-200";
  if (key === "processing" || key === "confirmed") return "bg-amber-50 text-amber-700 border-amber-200";
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

const TERMINAL_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "failed",
  "cancelled",
  "canceled",
  "expired",
  "rejected",
  "completed",
  "refunded",
]);

function normalizePaymentState(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function isTerminalPaymentState(value?: string | null): boolean {
  return TERMINAL_PAYMENT_STATUSES.has(normalizePaymentState(value));
}

function shouldMonitorPaymentStatus(
  orderStatus?: string | null,
  paymentStatus?: string | null,
  latestPaymentStatus?: string | null,
  paymentInstruction?: PaymentInstruction | null,
  paymentCount = 0,
): boolean {
  if (isTerminalPaymentState(orderStatus) || isTerminalPaymentState(paymentStatus) || isTerminalPaymentState(latestPaymentStatus)) {
    return false;
  }

  return Boolean(paymentInstruction || paymentCount > 0);
}


function PaymentInstructionPanel({ instruction, onClose }: { instruction: PaymentInstruction; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (instruction.qr_string) {
      import("qrcode").then((QRCode) => {
        QRCode.toDataURL(instruction.qr_string!, { width: 240, margin: 2 })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      });
    }
  }, [instruction.qr_string]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const expiredAtLabel = instruction.expired_at
    ? new Date(instruction.expired_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
    : null;

  const paymentCode = (() => {
    const extraInfo = instruction.extra_info;
    if (!extraInfo) return "";
    const rawPaymentCode = extraInfo["payment_code"];
    return typeof rawPaymentCode === "string" ? rawPaymentCode.trim() : "";
  })();

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-emerald-900">Instruksi Pembayaran — {instruction.display_name}</h3>
        <button onClick={onClose} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none" aria-label="Tutup">×</button>
      </div>

      {/* Virtual Account */}
      {instruction.virtual_account_number && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Nomor Virtual Account</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold tracking-widest text-slate-900">{instruction.virtual_account_number}</span>
            <button
              onClick={() => copyToClipboard(instruction.virtual_account_number!)}
              className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>
          {instruction.bank_code && (
            <p className="mt-1 text-xs text-slate-500">Bank: <span className="font-medium uppercase text-slate-700">{instruction.bank_code}</span></p>
          )}
        </div>
      )}

      {/* QRIS */}
      {instruction.qr_string && (
        <div className="mt-3 flex flex-col items-center rounded-xl border border-emerald-200 bg-white p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Scan QR Code</p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Pembayaran" className="h-48 w-48 rounded-lg" />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Memuat QR...</div>
          )}
        </div>
      )}

      {/* Redirect */}
      {instruction.redirect_url && (
        <div className="mt-3">
          <a
            href={instruction.redirect_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Lanjutkan Pembayaran →
          </a>
        </div>
      )}

      {paymentCode && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Kode Pembayaran</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold tracking-widest text-slate-900">{paymentCode}</span>
            <button
              onClick={() => copyToClipboard(paymentCode)}
              className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>
        </div>
      )}

      {/* Amount & Expiry */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
        <span>
          Jumlah:{" "}
          <span className="font-semibold text-slate-900">
            {instruction.currency} {instruction.amount.toLocaleString("id-ID")}
          </span>
        </span>
        {expiredAtLabel && (
          <span>
            Berlaku hingga: <span className="font-semibold text-slate-900">{expiredAtLabel}</span>
          </span>
        )}
      </div>

      {/* Steps */}
      {instruction.steps && instruction.steps.length > 0 && (
        <ol className="mt-3 space-y-1 text-sm text-slate-700">
          {instruction.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
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
  const [paymentMethods, setPaymentMethods] = useState<OrderPaymentMethod[]>([]);
  const [selectedMethodID, setSelectedMethodID] = useState("");
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
  const [customerConfirmationSubmitting, setCustomerConfirmationSubmitting] = useState<"approve" | "reject" | "">("");
  const [customerConfirmationRejectReason, setCustomerConfirmationRejectReason] = useState("");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressID, setSelectedAddressID] = useState("");
  const [paymentInstruction, setPaymentInstruction] = useState<PaymentInstruction | null>(null);
  const [shippingAddressError, setShippingAddressError] = useState("");
  const [updatingShippingAddress, setUpdatingShippingAddress] = useState(false);
  const [reviewableItems, setReviewableItems] = useState<ReviewableOrderItem[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [submittingReviewItemID, setSubmittingReviewItemID] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [paymentPollingEnabled, setPaymentPollingEnabled] = useState(false);

  const t = useTranslations();

  const translateStatus = (value?: string | null) => {
    const statusKey = mapStatusLabel(value);
    const fallbackMap: Record<string, string> = {
      "orderStatus.awaitingQuote": "Menunggu Ongkir",
      "orderStatus.shipped": "Dikirim",
      "orderStatus.waitingCustomerConfirmation": "Menunggu Konfirmasi Anda",
      "orderStatus.inDispute": "Dalam Sengketa",
      "orderStatus.refunded": "Refunded",
      "orderStatus.quoteReady": "Ongkir Siap",
      "orderStatus.paid": "Lunas",
      "orderStatus.completed": "Selesai",
      "orderStatus.verification": "Verifikasi",
      "orderStatus.expired": "Kedaluwarsa",
      "orderStatus.cancelled": "Dibatalkan",
      "orderStatus.pending": "Menunggu",
    };
    if (Object.prototype.hasOwnProperty.call(fallbackMap, statusKey)) {
      return t(statusKey, fallbackMap[statusKey]);
    }
    if (!statusKey || statusKey === "-") return "-";
    return t(statusKey, String(value || "").replace(/_/g, " "));
  };

  const loadDetail = async () => {
    if (!resolvedOrderID) {
      setError(t("orderIdNotFound", "Order ID tidak ditemukan."));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await getMyOrderByID(resolvedOrderID);
      setDetail(response.data);
      setPaymentInstruction(pickLatestPaymentInstruction(response.data.payments ?? response.data.order?.payments ?? null));
      if ((response.data.payments ?? response.data.order?.payments ?? []).length > 0) {
        setPaymentPollingEnabled(true);
      }
      const defaultProviderID = response.data.providers?.[0]?.id || "";
      setSelectedProviderID((current) => current || defaultProviderID);
      // Fetch payment methods
      const businessID = response.data.order?.business_id;
      if (businessID) {
        try {
          const methodsRes = await listOrderPaymentMethods(businessID);
          const activeMethods = (methodsRes.data || []).filter((m) => m.is_active);
          setPaymentMethods(activeMethods);
          setSelectedMethodID((current) => current || (activeMethods[0]?.id ?? ""));
        } catch {
          // fallback to providers
        }
      }
      setTransferAmount(String(Math.max(0, response.data.order.grand_total || 0)));
      setTransferredAt(new Date().toISOString().slice(0, 16));
      if (response.data?.order?.id) {
        const reviewRows = await listMyOrderReviewableItems(response.data.order.id);
        const rows = reviewRows.data || [];
        setReviewableItems(rows);
        setReviewError("");
        setReviewDrafts((current) => {
          const next = { ...current };
          rows.forEach((row) => {
            const existing = current[row.order_item_id];
            next[row.order_item_id] = {
              rating: existing?.rating || Number(row.review?.rating || 5),
              review_text: existing?.review_text ?? String(row.review?.review_text || ""),
              question_text: existing?.question_text ?? String(row.review?.question_text || ""),
              attachments: existing?.attachments || [],
            };
          });
          return next;
        });
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t("failedLoadOrderDetail", "Gagal memuat detail order");
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
      const message = loadError instanceof Error ? loadError.message : t("failedLoadAddress", "Gagal memuat alamat");
      setShippingAddressError(message);
      setAddresses([]);
    }
  };

  const handleReviewDraftChange = (itemID: string, patch: Partial<ReviewDraft>) => {
    setReviewDrafts((current) => ({
      ...current,
      [itemID]: {
        ...createEmptyReviewDraft(current[itemID]),
        ...patch,
      },
    }));
  };

  const handleReviewAttachmentsChange = (itemID: string, files: FileList | null) => {
    const selectedFiles = Array.from(files || [])
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .filter((file) => file.size > 0 && file.size <= MAX_REVIEW_ATTACHMENT_SIZE)
      .slice(0, MAX_REVIEW_ATTACHMENTS);

    if (files && selectedFiles.length !== files.length) {
      notifyError(t("reviewAttachmentRestriction", `Hanya file gambar/video, maksimal ${MAX_REVIEW_ATTACHMENTS} file, ukuran maksimal 10MB per file.`));
    }

    handleReviewDraftChange(itemID, { attachments: selectedFiles });
  };

  const handleReviewAttachmentRemove = (itemID: string, index: number) => {
    setReviewDrafts((current) => {
      const existing = current[itemID];
      if (!existing) {
        return current;
      }
      const nextAttachments = (existing.attachments || []).filter((_, attachmentIndex) => attachmentIndex !== index);
      return {
        ...current,
        [itemID]: {
          ...existing,
          attachments: nextAttachments,
        },
      };
    });
  };

  const handleSubmitReview = async (itemID: string) => {
    if (!order?.id) return;
    const draft = reviewDrafts[itemID];
    if (!draft) return;
    setSubmittingReviewItemID(itemID);
    setReviewError("");
    try {
      const hasAttachments = Array.isArray(draft.attachments) && draft.attachments.length > 0;
      if (hasAttachments) {
        const form = new FormData();
        form.set("rating", String(Number(draft.rating || 0)));
        form.set("review_text", String(draft.review_text || ""));
        form.set("question_text", String(draft.question_text || ""));
        draft.attachments.forEach((file) => form.append("attachments", file));
        await upsertMyOrderItemReview(order.id, itemID, form);
      } else {
        await upsertMyOrderItemReview(order.id, itemID, {
          rating: Number(draft.rating || 0),
          review_text: String(draft.review_text || ""),
          question_text: String(draft.question_text || ""),
        });
      }
      notifySuccess(t("reviewSaved", "Review pembeli berhasil disimpan."));
      const reviewRows = await listMyOrderReviewableItems(order.id);
      setReviewableItems(reviewRows.data || []);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("failedSaveReview", "Gagal menyimpan review");
      setReviewError(message);
      notifyError(message);
    } finally {
      setSubmittingReviewItemID("");
    }
  };

  const handleApplyShippingAddress = async () => {
    if (!order?.id || !selectedAddressID) return;
    if (shippingAddressLocked) {
      const message = t("shippingLocked", "Alamat tidak bisa diubah karena ongkir sudah dibuat.");
      setShippingAddressError(message);
      notifyError(message);
      return;
    }
    setUpdatingShippingAddress(true);
    setShippingAddressError("");
    try {
      await updateMyOrderShippingAddress(order.id, selectedAddressID);
      notifySuccess(t("shippingUpdated", "Alamat pengiriman diperbarui. Menunggu konfirmasi ongkir baru."));
      await loadDetail();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : t("failedUpdateShippingAddress", "Gagal memperbarui alamat pengiriman");
      setShippingAddressError(message);
      notifyError(message);
    } finally {
      setUpdatingShippingAddress(false);
    }
  };

  const handleApproveCustomerConfirmation = async () => {
    if (!order?.id) return;
    setCustomerConfirmationSubmitting("approve");
    setError("");
    try {
      await approveMyOrderCustomerConfirmation(order.id);
      setStatusMessage(t("customerConfirmationApprovedNotice", "Terima kasih. Order dikonfirmasi selesai dan dana seller akan diproses sesuai alur payout."));
      setCustomerConfirmationRejectReason("");
      notifySuccess(t("customerConfirmationApprovedToast", "Konfirmasi penerimaan berhasil disimpan."));
      await loadDetail();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("customerConfirmationApproveFailed", "Gagal menyimpan konfirmasi penerimaan");
      setError(message);
      notifyError(message);
    } finally {
      setCustomerConfirmationSubmitting("");
    }
  };

  const handleRejectCustomerConfirmation = async () => {
    if (!order?.id) return;
    if (!customerConfirmationRejectReason.trim()) {
      const message = t("customerConfirmationRejectReasonRequired", "Tulis alasan penolakan terlebih dahulu.");
      setError(message);
      notifyError(message);
      return;
    }
    setCustomerConfirmationSubmitting("reject");
    setError("");
    try {
      await rejectMyOrderCustomerConfirmation(order.id, customerConfirmationRejectReason.trim());
      setStatusMessage(t("customerConfirmationRejectedNotice", "Penolakan Anda sudah dicatat. Order masuk ke proses penyelesaian masalah dan dana tetap ditahan."));
      notifySuccess(t("customerConfirmationRejectedToast", "Penolakan konfirmasi penerimaan berhasil dikirim."));
      await loadDetail();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("customerConfirmationRejectFailed", "Gagal mengirim penolakan penerimaan");
      setError(message);
      notifyError(message);
    } finally {
      setCustomerConfirmationSubmitting("");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStatusMessage("");
    setPaymentPollingEnabled(false);
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
  const payments = detail?.payments ?? EMPTY_PAYMENTS;
  const providers = detail?.providers || [];
  const appliedCoupons = order?.applied_coupons || [];
  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodID) || null;
  const selectedProvider: OrderPaymentProvider | null = selectedMethod
    ? (providers.find((p) => p.id === selectedMethod.provider_id) ?? null)
    : (providers.find((item) => item.id === selectedProviderID) ?? null);
  const isBankTransfer = (selectedProvider?.provider_key || "").toLowerCase() === "bank_transfer";
  const latestPayment = pickLatestPayment(payments);
  const latestBankTransferMeta = parseMetadata(latestPayment?.metadata)?.bank_transfer || null;
  const shippingQuote = parseShippingQuote(order?.metadata);
  const shippingAddress = parseShippingAddress(order?.metadata);
  const customerConfirmation = parseCustomerConfirmation(order?.metadata);
  const dispute = parseDisputeMetadata(order?.metadata);
  const shippingAddressID = String(shippingAddress?.address_id || "").trim();
  const shippingQuoteReady = Boolean(shippingQuote?.ready);
  const shippingAddressLocked = shippingQuoteReady;
  const awaitingShippingQuote = isAwaitingShippingQuote(order?.status, order?.payment_status, shippingQuoteReady, Boolean(shippingAddressID));
  const isWaitingCustomerConfirmation = String(order?.status || "").trim().toLowerCase() === "waiting_customer_confirmation";
  const isOrderInDispute = String(order?.status || "").trim().toLowerCase() === "in_dispute";
  const isOrderRefunded = String(order?.status || "").trim().toLowerCase() === "refunded";
  const disputeDecision = String(dispute?.admin_decision || "").trim().toLowerCase();

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

  const extraCharges = useMemo(
    () =>
      (order?.extra_charges || [])
        .map((item) => ({
          id: String(item.id || ""),
          name: String(item.name || "").trim() || t("extraChargeLabel", "Extra Charge"),
          amount: Number(item.amount || 0),
        }))
        .filter((item) => item.amount > 0),
    [order?.extra_charges, t],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !resolvedOrderID || !order?.id || !paymentPollingEnabled) return;

    const latestPaymentStatus = latestPayment?.status || null;
    if (
      isTerminalPaymentState(order.status) ||
      isTerminalPaymentState(order.payment_status) ||
      isTerminalPaymentState(latestPaymentStatus)
    ) {
      return;
    }

    let cancelled = false;

    const pollPaymentStatus = async () => {
      try {
        const response = await getMyOrderByID(resolvedOrderID);
        if (cancelled) return;

        const nextOrder = response.data.order;
        const nextPayments = response.data.payments || [];
        const nextLatestPayment = pickLatestPayment(nextPayments);
        const nextLatestPaymentStatus = nextLatestPayment?.status || null;

        if (
          isTerminalPaymentState(nextOrder.status) ||
          isTerminalPaymentState(nextOrder.payment_status) ||
          isTerminalPaymentState(nextLatestPaymentStatus)
        ) {
          cancelled = true;
          window.location.reload();
        }
      } catch {
        // Keep polling on transient network/API errors.
      }
    };

    void pollPaymentStatus();
    const timer = window.setInterval(() => {
      void pollPaymentStatus();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [resolvedOrderID, order?.id, order?.status, order?.payment_status, payments.length, latestPayment?.status, paymentPollingEnabled]);

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
    if (!order || !(selectedMethodID || selectedProviderID)) return false;
    if (awaitingShippingQuote) return false;
    if ((order.payment_status || "").toLowerCase() === "paid") return false;
    if (!isBankTransfer) return true;
    if (!senderBankName.trim() || !senderAccountNumber.trim() || !senderAccountHolder.trim()) return false;
    if (!transferAmount.trim() || Number.isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) return false;
    if (!transferredAt.trim()) return false;
    if (proofFiles.length === 0) return false;
    return true;
  }, [awaitingShippingQuote, isBankTransfer, order, proofFiles, selectedMethodID, selectedProviderID, senderAccountHolder, senderAccountNumber, senderBankName, transferAmount, transferredAt]);

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
      setStatusMessage(t("orderReceivedAwaitingShipping", "Pesanan diterima. Tim kami akan menghubungi Anda via WhatsApp untuk konfirmasi ongkir dan total pembayaran."));
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
        if (selectedMethodID) form.set("payment_method_id", selectedMethodID);
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
        setPaymentInstruction(null);
      } else {
        const res = await startMyOrderPayment(order.id, {
          provider_id: selectedProvider.id,
          ...(selectedMethodID ? { payment_method_id: selectedMethodID } : {}),
        });
        const instruction = res.data.payment_instruction ?? res.payment_instruction ?? null;
        setPaymentInstruction(instruction);
        if (instruction?.redirect_url) {
          setPaymentPollingEnabled(true);
          notifySuccess(t("redirectingToPayment", "Mengalihkan ke halaman pembayaran..."));
          window.location.assign(instruction.redirect_url);
          return;
        }
      }

      setPaymentPollingEnabled(true);

      notifySuccess(t("paymentCreated", "Pembayaran berhasil dibuat."));
      if (isBankTransfer) {
        setStatusMessage(t("bankTransferConfirmationSent", "Konfirmasi pembayaran terkirim. Tim kami akan memverifikasi bukti transfer Anda."));
      }
      setProofFiles([]);
      setProofNotes("");
      await loadDetail();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("failedStartPayment", "Gagal memulai pembayaran");
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
      notifySuccess(t("invoiceDownloaded", "Invoice berhasil diunduh."));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("failedDownloadInvoice", "Gagal mengunduh invoice");
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
            <a href={buildLocalizedPath("/customer/dashboard", typeof window !== "undefined" ? window.location.pathname : null)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              {t("backToDashboard", "Kembali ke dashboard")}
            </a>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{t("orderDetailTitle", "Detail Order")}</h1>
            <p className="mt-2 text-sm text-slate-500">{t("orderDetailDescription", "Pantau status order dan lanjutkan pembayaran dari halaman ini.")}</p>
          </div>
          {order ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("orderCardLabel", "Order")}</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{order.order_number}</div>
                <div className="mt-1 text-xs text-slate-500">{t("createdAtLabel", "Dibuat")} {formatDateTime(order.created_at)}</div>
              </div>
          ) : null}
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {statusMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div>
        ) : null}
        {paymentInstruction ? (
          <PaymentInstructionPanel instruction={paymentInstruction} onClose={() => setPaymentInstruction(null)} />
        ) : null}

        {loading ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" />
              {t("loadingOrderDetail", "Memuat detail order...")}
            </div>
          </section>
        ) : !order ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{t("orderNotFoundTitle", "Order tidak ditemukan")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("orderNotFoundDescription", "Pastikan order ini milik akun yang sedang login.")}</p>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><Receipt className="h-4 w-4" /> {t("statusOrder", "Status Order")}</div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${mapStatusClass(order.status)}`}>
                      {translateStatus(order.status)}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><CreditCard className="h-4 w-4" /> {t("statusPayment", "Status Bayar")}</div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${mapStatusClass(order.payment_status)}`}>
                      {translateStatus(order.payment_status)}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><Building2 className="h-4 w-4" /> {t("businessLabel", "Business")}</div>
                  <div className="mt-3">
                    {business?.slug ? (
                      <a href={buildLocalizedPath(`/b/${business.slug}`, typeof window !== "undefined" ? window.location.pathname : null)} className="block break-words text-sm font-semibold text-emerald-700 transition hover:text-emerald-600 hover:underline">
                        {business.name}
                      </a>
                    ) : (
                      <div className="break-all text-sm font-medium text-slate-900">{business?.name || order.business_id || "-"}</div>
                    )}
                    {business?.slug ? <div className="mt-1 text-xs text-slate-500">/b/{business.slug}</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500"><ShieldCheck className="h-4 w-4" /> {t("totalLabel", "Total")}</div>
                  <div className="mt-3 text-lg font-semibold text-slate-900">{toCurrency(order.grand_total, order.currency)}</div>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{t("orderItemsTitle", "Item Order")}</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t("tableHeader.product", "Produk")}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t("tableHeader.qty", "Qty")}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t("tableHeader.price", "Harga")}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t("tableHeader.tax", "Pajak")}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t("tableHeader.total", "Total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(order.order_items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-3 text-sm text-slate-800">
                            <div className="font-medium text-slate-900">{item.product_name || item.product_id || t("productFallback", "Produk")}</div>
                            
                            <div className="text-xs text-slate-500">{item.sku || item.product_id || "-"}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                              <span className={`rounded-full px-2 py-0.5 ${String(item.tax_type || "exclude") === "include" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                                {formatTaxMode(item.tax_type, item.tax_rate)}
                              </span>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                {t("tax", "Pajak")} {toCurrency(item.tax_amount, order.currency)}
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
                <h2 className="text-lg font-bold text-slate-900">{t("buyerReviews", "Review Pembeli")}</h2>
                {reviewableItems.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t("noReviewItems", "Belum ada item yang bisa direview untuk order ini.")}</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {reviewableItems.map((entry) => {
                      const draft = reviewDrafts[entry.order_item_id] || {
                        rating: Number(entry.review?.rating || 5),
                        review_text: String(entry.review?.review_text || ""),
                        question_text: String(entry.review?.question_text || ""),
                        attachments: [],
                      };
                      const isSubmitting = submittingReviewItemID === entry.order_item_id;
                      const hasReview = Boolean(entry.review);
                      const reviewAttachments = parseReviewAttachments(entry.review?.metadata);
                      return (
                        <article key={entry.order_item_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{entry.product_name || t("productFallback", "Produk")}</div>
                              <div className="text-xs text-slate-500">{entry.sku || entry.product_id || entry.order_item_id}</div>
                            </div>
                            {hasReview ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                {t("alreadyReviewed", "Sudah direview")}
                              </span>
                            ) : null}
                          </div>

                          {hasReview && entry.review ? (
                            <div className="mt-3 space-y-3">
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("yourReviewTitle", "Review Anda")}</div>
                                <div className="mt-1 text-amber-500">{"★".repeat(Math.max(0, Math.min(5, Number(entry.review.rating || 0))))}</div>
                                {entry.review.review_text ? <p className="mt-2 text-sm text-slate-700">{entry.review.review_text}</p> : null}
                                {entry.review.question_text ? <p className="mt-2 text-sm text-slate-600">{t("questionLabel", "Pertanyaan:")} {entry.review.question_text}</p> : null}
                                {reviewAttachments.length > 0 ? (
                                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {reviewAttachments.map((attachment, index) => {
                                      const publicUrl = attachment.publicUrl || attachment.public_url || "";
                                      const isVideo = String(attachment.mimeType || attachment.mime_type || "").startsWith("video/");
                                      const key = `${attachment.storageKey || publicUrl || index}`;
                                      return (
                                        <a
                                          key={key}
                                          href={publicUrl || undefined}
                                          target={publicUrl ? "_blank" : undefined}
                                          rel={publicUrl ? "noreferrer" : undefined}
                                          className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                        >
                                          <div className="relative flex h-24 items-center justify-center bg-slate-100">
                                            {publicUrl ? (
                                              isVideo ? (
                                                <video src={publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                              ) : (
                                                <img src={publicUrl} alt={attachment.name || `Lampiran ${index + 1}`} className="h-full w-full object-cover" />
                                              )
                                            ) : (
                                              <div className="text-xs font-semibold text-slate-500">{t("attachment", "Lampiran")}</div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                                                {attachment.name || t("attachmentN", `Lampiran ${index + 1}`)}
                                            </div>
                                          </div>
                                        </a>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                                {entry.review.seller_reply ? (
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("sellerReply", "Balasan penjual")}</div>
                                    <p className="mt-1 text-sm">{entry.review.seller_reply}</p>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    {t("reviewSentAwaitingSeller", "Review terkirim. Menunggu balasan penjual.")}
                                  </div>
                                )}
                            </div>
                          ) : !entry.can_review ? (
                              <p className="mt-3 text-xs text-amber-700">{entry.reason || t("itemNotReviewable", "Item ini belum bisa direview.")}</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <label className="block space-y-1 text-sm text-slate-700">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("ratingLabel", "Rating")}</span>
                                <select
                                  value={String(draft.rating || 5)}
                                  onChange={(event) => handleReviewDraftChange(entry.order_item_id, { rating: Number(event.target.value) })}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  disabled={isSubmitting}
                                >
                                  {[5, 4, 3, 2, 1].map((value) => (
                                    <option key={value} value={value}>
                                      {value} {t("starUnit", "bintang")}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="block space-y-1 text-sm text-slate-700">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("reviewLabel", "Ulasan")}</span>
                                <textarea
                                  value={draft.review_text}
                                  onChange={(event) => handleReviewDraftChange(entry.order_item_id, { review_text: event.target.value })}
                                  className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  placeholder={t("reviewPlaceholder", "Bagikan pengalaman belanja Anda")}
                                  disabled={isSubmitting}
                                />
                              </label>

                              <label className="block space-y-1 text-sm text-slate-700">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("questionOptional", "Pertanyaan (opsional)")}</span>
                                <textarea
                                  value={draft.question_text}
                                  onChange={(event) => handleReviewDraftChange(entry.order_item_id, { question_text: event.target.value })}
                                  className="min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  placeholder={t("questionPlaceholder", "Ada yang ingin ditanyakan ke penjual?")}
                                  disabled={isSubmitting}
                                />
                              </label>

                              <div className="space-y-2 text-sm text-slate-700">
                                <label className="block space-y-1">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("attachmentsOptional", "Lampiran Foto/Video (opsional)")}</span>
                                  <input
                                    type="file"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={(event) => handleReviewAttachmentsChange(entry.order_item_id, event.target.files)}
                                    className="block w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
                                    disabled={isSubmitting}
                                  />
                                </label>

                                  {Array.isArray(draft.attachments) && draft.attachments.length > 0 ? (
                                  <div className="space-y-2">
                                    <ReviewAttachmentPreviewStrip
                                      files={draft.attachments}
                                      onRemove={(index) => handleReviewAttachmentRemove(entry.order_item_id, index)}
                                    />
                                    <p className="text-xs text-slate-500">
                                      {draft.attachments.length} {t("filesSelected", "file dipilih")} : {draft.attachments.map((file) => file.name).join(", ")}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">{t("selectFilesHelp", `Pilih hingga ${MAX_REVIEW_ATTACHMENTS} file, maksimal 10MB per file.`)}</p>
                                )}
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => void handleSubmitReview(entry.order_item_id)}
                                  disabled={isSubmitting}
                                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSubmitting ? t("saving", "Menyimpan...") : entry.review ? t("updateReview", "Perbarui Review") : t("submitReview", "Kirim Review")}
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
                {reviewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{reviewError}</div> : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{t("paymentHistory", "Riwayat Pembayaran")}</h2>
                {payments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t("noPayments", "Belum ada pembayaran untuk order ini.")}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {payments.map((payment: Payment) => {
                      const metadata = parseMetadata(payment.metadata);
                      const bankTransfer = metadata?.bank_transfer as Record<string, any> | undefined;
                      return (
                        <article key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{payment.payment_method || payment.gateway_name || payment.provider_key || t("paymentFallback", "Payment")}</div>
                              <div className="mt-1 text-xs text-slate-500">{payment.id}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">{toCurrency(payment.amount, payment.currency)}</div>
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mapStatusClass(payment.status)}`}>
                                  {translateStatus(payment.status)}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mapStatusClass(payment.proof_status)}`}>
                                  {t("proofLabel", "Bukti:")} {translateStatus(payment.proof_status)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {bankTransfer ? (
                            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                              <div>
                                <div className="font-medium text-slate-800">{t("bankSender", "Bank Pengirim")}</div>
                                <div>{bankTransfer.sender_bank?.bank_name || "-"}</div>
                                <div>{bankTransfer.sender_bank?.account_number || "-"}</div>
                                <div>{bankTransfer.sender_bank?.account_holder || "-"}</div>
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">{t("transferLabel", "Transfer")}</div>
                                <div>{toCurrency(Number(bankTransfer.transfer?.amount || 0), payment.currency)}</div>
                                <div>{formatDateTime(String(bankTransfer.transfer?.transferred_at || ""))}</div>
                                <div>{bankTransfer.transfer?.reference || "-"}</div>
                              </div>
                            </div>
                          ) : null}
                          {(proofsByPaymentID[payment.id] || []).length > 0 ? (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("transferProofTitle", "Bukti Transfer")}</div>
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
                                        {openingProofKey === opKey ? t("opening", "Membuka...") : t("view", "Lihat")}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                              {t("noPaymentProofs", "Belum ada file bukti pembayaran pada transaksi ini.")}
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
                  <h2 className="text-lg font-bold text-slate-900">{t("shippingAddressTitle", "Alamat Pengiriman")}</h2>
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
                <h2 className="text-lg font-bold text-slate-900">{t("summaryTitle", "Ringkasan")}</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{t("subtotal", "Subtotal")}</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.subtotal, order.currency)}</span>
                  </div>
                  {(order.discount_amount || 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span>{t("discount", "Diskon")}</span>
                      <span className="font-medium text-slate-900">-{toCurrency(order.discount_amount, order.currency)}</span>
                    </div>
                  )}
                  {appliedCoupons.length > 0 && (
                    <div className="ml-3 space-y-1 border-l-2 border-slate-300 pl-3">
                      {appliedCoupons.map((coupon) => (
                        <div key={coupon.code} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{t("couponLabel", "Kupon")} {coupon.code}</span>
                          <span className="font-medium text-slate-700">-{toCurrency(coupon.discount_amount, order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>{t("tax", "Pajak")}</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.tax_amount || 0, order.currency)}</span>
                  </div>
                  {taxBreakdown.length > 0 ? (
                    <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        {taxBreakdown.map((group) => (
                        <div key={`${group.taxType}-${group.taxRate}`} className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">{t("tax", "Pajak")} {formatTaxMode(group.taxType, group.taxRate)}</span>
                          <span className="font-medium text-slate-800">{toCurrency(group.amount, order.currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span>{t("shippingLabel", "Ongkir")}</span>
                    <span className="font-medium text-slate-900">{toCurrency(order.shipping_amount, order.currency)}</span>
                  </div>
                  {extraCharges.map((charge) => (
                    <div key={charge.id || charge.name} className="flex items-center justify-between">
                      <span>{charge.name}</span>
                      <span className="font-medium text-slate-900">{toCurrency(charge.amount, order.currency)}</span>
                    </div>
                  ))}
                  {shippingQuote ? (
                    <CourierCard shippingQuote={shippingQuote} fallbackAmount={order.shipping_amount} currency={order.currency} />
                  ) : null}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{t("shippingAddressTitle", "Alamat Pengiriman")}</div>
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
                          <option value="">{t("chooseAddress", "Pilih alamat")}</option>
                          {addresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {(address.label || t("addressLabel", "Alamat")) + (address.is_primary ? ` (${t("primaryLabel", "Utama")})` : "") + " - " + address.receiver_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
                          {t("noSavedAddressesPrompt", "Belum ada alamat tersimpan. Tambahkan alamat dulu dari dashboard agar checkout bisa lanjut.")}
                        </div>
                      )}

                        {addresses.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleApplyShippingAddress()}
                          disabled={!selectedAddressID || updatingShippingAddress || selectedAddressID === shippingAddressID || shippingAddressLocked}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingShippingAddress ? t("savingAddress", "Menyimpan alamat...") : shippingAddressLocked ? t("addressLocked", "Alamat Dikunci") : selectedAddressID === shippingAddressID ? t("addressActive", "Alamat Aktif") : t("useThisAddress", "Pakai Alamat Ini")}
                        </button>
                      ) : (
                        <a href={buildLocalizedPath("/customer/dashboard?tab=addresses", typeof window !== "undefined" ? window.location.pathname : null)} className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                          {t("openAddressDashboard", "Buka Dashboard Alamat")}
                        </a>
                      )}

                      {shippingAddressLocked ? <p className="text-xs text-amber-700">{t("addressLockedNote", "Alamat dikunci karena ongkir sudah dibuat. Untuk mengganti alamat, ongkir harus direset terlebih dulu.")}</p> : null}
                      <p className="text-xs text-slate-500">{t("addressChangeNote", "Mengganti alamat akan menghapus ongkir sebelumnya dan menunggu konfirmasi ongkir baru.")}</p>
                      {shippingAddressError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{shippingAddressError}</div> : null}
                    </div>
                  </div>

                  {customerConfirmation || dispute || isWaitingCustomerConfirmation || isOrderInDispute || isOrderRefunded ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h2 className="text-lg font-bold text-slate-900">{t("customerConfirmationTitle", "Konfirmasi Penerimaan")}</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {t("customerConfirmationDescription", "Seller meminta Anda memastikan barang benar-benar sudah sampai dan sesuai sebelum order ditutup.")}
                      </p>

                      {customerConfirmation?.seller_message ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("sellerMessageLabel", "Pesan Seller")}</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{String(customerConfirmation.seller_message)}</div>
                        </div>
                      ) : null}

                      {customerConfirmation?.reject_reason ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">{t("customerRejectReasonLabel", "Alasan Penolakan")}</div>
                          <div className="mt-2 whitespace-pre-wrap">{String(customerConfirmation.reject_reason)}</div>
                        </div>
                      ) : null}

                      {dispute?.admin_note ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("adminDecisionNoteLabel", "Catatan Admin")}</div>
                          <div className="mt-2 whitespace-pre-wrap">{String(dispute.admin_note)}</div>
                        </div>
                      ) : null}

                      {dispute?.refund_note ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{t("refundNoteLabel", "Catatan Refund")}</div>
                          <div className="mt-2 whitespace-pre-wrap">{String(dispute.refund_note)}</div>
                        </div>
                      ) : null}

                      {isWaitingCustomerConfirmation ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                            {t("customerConfirmationPendingNotice", "Jika barang sudah sampai dan sesuai, tekan Terima. Jika ada masalah, tekan Tolak dan jelaskan alasannya.")}
                          </div>
                          <textarea
                            value={customerConfirmationRejectReason}
                            onChange={(event) => setCustomerConfirmationRejectReason(event.target.value)}
                            className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                            placeholder={t("customerConfirmationRejectPlaceholder", "Tulis alasan jika Anda menolak konfirmasi penerimaan")}
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => void handleApproveCustomerConfirmation()}
                              disabled={customerConfirmationSubmitting !== ""}
                              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {customerConfirmationSubmitting === "approve" ? t("processing", "Memproses...") : t("customerConfirmationApproveAction", "Terima Barang")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRejectCustomerConfirmation()}
                              disabled={customerConfirmationSubmitting !== ""}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {customerConfirmationSubmitting === "reject" ? t("processing", "Memproses...") : t("customerConfirmationRejectAction", "Tolak dan Komplain")}
                            </button>
                          </div>
                        </div>
                      ) : isOrderRefunded || disputeDecision === "refunded" ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800">
                          {t("customerRefundCompletedNotice", "Dispute selesai dan refund manual sudah diproses. Jika dana belum masuk, hubungi admin dengan menyertakan nomor order ini.")}
                        </div>
                      ) : disputeDecision === "customer_won_pending_refund" ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {t("customerRefundPendingNotice", "Admin memutuskan dispute untuk Anda. Refund masih diproses manual dan dana seller tetap ditahan sampai refund selesai.")}
                        </div>
                      ) : isOrderInDispute ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          {t("customerConfirmationDisputeNotice", "Order sedang dalam proses penyelesaian masalah. Dana tetap ditahan sampai ada penyelesaian.")}
                        </div>
                      ) : disputeDecision === "seller_won" ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          {t("customerConfirmationResolvedSellerNotice", "Admin menyelesaikan dispute dan order dinyatakan selesai. Jika Anda masih punya bukti tambahan, hubungi admin dengan nomor order ini.")}
                        </div>
                      ) : String(customerConfirmation?.status || "").toLowerCase() === "approved" || String(order?.status || "").toLowerCase() === "completed" ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          {t("customerConfirmationCompletedNotice", "Anda sudah mengonfirmasi penerimaan. Order selesai dan dana seller diproses sesuai alur payout.")}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{t("grandTotal", "Grand Total")}</span>
                    <span className="text-lg font-bold text-slate-900">{toCurrency(order.grand_total, order.currency)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {downloadingInvoice ? t("downloadingInvoice", "Mengunduh invoice...") : t("downloadInvoice", "Unduh Invoice")}
                </button>
                <a
                  href={buildLocalizedPath(`/customer/complaints?order_id=${encodeURIComponent(order.id)}`, typeof window !== "undefined" ? window.location.pathname : null)}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  {t("openComplaintList", "Buka Complaint List")}
                </a>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{t("paymentTitle", "Pembayaran")}</h2>
                {(order.payment_status || "").toLowerCase() === "paid" ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {t("orderPaid", "Order ini sudah lunas.")}
                  </div>
                ) : awaitingShippingQuote ? (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    {t("paymentNotAvailableAwaitingShipping", "Pembayaran belum tersedia. Tim kami akan menghubungi Anda via WhatsApp setelah ongkir dan total final dikonfirmasi.")}
                  </div>
                ) : (
                  <>
                    {providers.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {t("noActivePaymentMethods", "Belum ada metode pembayaran aktif untuk order ini.")}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {paymentMethods.length > 0
                          ? paymentMethods.map((method) => (
                              <label key={method.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-emerald-300 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                                <input
                                  type="radio"
                                  name="payment_method"
                                  className="mt-1"
                                  checked={selectedMethodID === method.id}
                                  onChange={() => setSelectedMethodID(method.id)}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{method.name}</div>
                                  <div className="text-xs text-slate-500">{method.provider?.provider_key || ""}</div>
                                </div>
                              </label>
                            ))
                          : providers.map((provider: OrderPaymentProvider) => (
                              <label key={provider.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-emerald-300 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
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
                          <div className="font-semibold">{t("transferDestination", "Tujuan Transfer")}</div>
                          <div className="mt-2">{t("bankLabel", "Bank")} : {selectedProvider.config?.bank_name || "-"}</div>
                          <div>{t("accountNumberLabel", "No. Rekening")} : {selectedProvider.config?.account_number || "-"}</div>
                          <div>{t("accountHolderLabel", "Atas Nama")} : {selectedProvider.config?.account_holder || selectedProvider.config?.account_name || "-"}</div>
                          {selectedProvider.config?.instructions ? <div className="mt-2 text-xs">{selectedProvider.config.instructions}</div> : null}
                        </div>

                        <div className="grid gap-3">
                          <input value={senderBankName} onChange={(e) => setSenderBankName(e.target.value)} placeholder={t("placeholder.senderBank", "Bank pengirim")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={senderAccountNumber} onChange={(e) => setSenderAccountNumber(e.target.value)} placeholder={t("placeholder.senderAccountNumber", "Nomor rekening pengirim")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={senderAccountHolder} onChange={(e) => setSenderAccountHolder(e.target.value)} placeholder={t("placeholder.senderAccountHolder", "Nama pemilik rekening")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder={t("placeholder.transferAmount", "Jumlah transfer")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input type="datetime-local" value={transferredAt} onChange={(e) => setTransferredAt(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} placeholder={t("placeholder.transferReference", "Referensi transfer (opsional)")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <textarea value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder={t("placeholder.proofNotes", "Catatan bukti pembayaran (opsional)")} className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            <Upload className="h-4 w-4" />
                            <span>{proofFiles.length > 0 ? `${proofFiles.length} ${t("filesSelected", "file dipilih")}` : t("uploadProof", "Upload bukti transfer")}</span>
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
                          <div className="font-semibold">{t("lastConfirmation", "Konfirmasi terakhir")}</div>
                          <div className="mt-2">{t("bankSender", "Bank pengirim")} : {latestBankTransferMeta.sender_bank?.bank_name || "-"}</div>
                          <div>{t("amountLabel", "Nominal")} : {toCurrency(Number(latestBankTransferMeta.transfer?.amount || 0), order.currency)}</div>
                          <div>{t("timeLabel", "Waktu")} : {formatDateTime(String(latestBankTransferMeta.transfer?.transferred_at || ""))}</div>
                        </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleStartPayment}
                      disabled={providers.length === 0 || !canSubmit || submitting}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? t("processing", "Memproses...") : isBankTransfer ? t("sendPaymentConfirmation", "Kirim Konfirmasi Pembayaran") : t("createPayment", "Buat Pembayaran")}
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