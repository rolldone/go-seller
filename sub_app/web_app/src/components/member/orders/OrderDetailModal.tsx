import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";
import { fetchStoreMaintenanceInfo } from "../../../lib/storeMaintenance";
import { useTranslations } from "../../../i18n";
import MemberModal from "../ui/MemberModal";
import {
	createMemberOrderShipment,
	deleteMemberOrderShipment,
	downloadMemberOrderInvoice,
	listMemberOrderShipments,
	listMemberOrderPaymentProofs,
	listMemberShippableItems,
	getMemberOrderPaymentProofBlob,
	validateMemberOrderPaymentFromHistory,
	replaceMemberOrderExtraCharges,
	requestMemberOrderCustomerConfirmation,
	upsertMemberOrderDisputeNote,
	updateMemberOrderShippingAddress,
	updateMemberOrderShippingQuote,
	updateMemberOrderShipment,
} from "./api";
import type { Order, OrderExtraCharge, OrderItem, OrderShipment, Payment, PaymentProof } from "./types";

type Props = {
	open: boolean;
	loading: boolean;
	order: Order | null;
	businessID: string;
	businessName?: string;
	onClose: () => void;
	onRefresh?: () => Promise<void> | void;
};

type ShippingQuoteForm = {
	shipping_amount: string;
	carrier_name: string;
	service_name: string;
	tracking_number: string;
	estimated_delivery: string;
	description: string;
	notes: string;
};

type ExtraChargeRow = {
	id: string;
	name: string;
	amount: string;
	notes: string;
	sort_order: string;
};

type ShippingAddressForm = {
	address_id: string;
};

type ShipmentForm = {
	carrier_name: string;
	service_name: string;
	tracking_number: string;
	shipping_amount: string;
	estimated_delivery: string;
	description: string;
	notes: string;
	item_ids: Record<string, boolean>;
};

type EditShipmentForm = {
	shipment_id: string;
	status: "pending" | "processing" | "ready_to_ship" | "shipped" | "in_transit" | "delivered" | "exception" | "returned" | "cancelled";
	carrier_name: string;
	service_name: string;
	tracking_number: string;
	shipping_amount: string;
	estimated_delivery: string;
	description: string;
	notes: string;
};

const emptyShippingQuoteForm: ShippingQuoteForm = {
	shipping_amount: "",
	carrier_name: "",
	service_name: "",
	tracking_number: "",
	estimated_delivery: "",
	description: "",
	notes: "",
};

const emptyShippingAddressForm: ShippingAddressForm = { address_id: "" };

const emptyShipmentForm: ShipmentForm = {
	carrier_name: "",
	service_name: "",
	tracking_number: "",
	shipping_amount: "0",
	estimated_delivery: "",
	description: "",
	notes: "",
	item_ids: {},
};

const emptyEditShipmentForm: EditShipmentForm = {
	shipment_id: "",
	status: "pending",
	carrier_name: "",
	service_name: "",
	tracking_number: "",
	shipping_amount: "0",
	estimated_delivery: "",
	description: "",
	notes: "",
};

const PAYMENT_HISTORY_BATCH_SIZE = 3;

function getMemberLocaleFromPathname(pathname?: string | null): "id" | "en" {
	const firstSegment = String(pathname || "").split("/").filter(Boolean)[0] || "";
	return firstSegment.toLowerCase() === "en" ? "en" : "id";
}

function formatDateTime(value?: string | null, locale: "id" | "en" = "id") {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(locale === "en" ? "en-US" : "id-ID");
}

function requiresPaymentProof(payment: Payment): boolean {
	return String(payment.provider_key || "").trim().toLowerCase() === "bank_transfer";
}

function isSuccessfulPayment(payment: Payment): boolean {
	const status = String(payment.status || "").trim().toLowerCase();
	return ["paid", "success", "succeeded", "settled", "completed"].includes(status);
}

function getPaymentSortTime(payment: Payment): number {
	const timestamp = payment.created_at || payment.updated_at || "";
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function money(currency: string, amount: number) {
	return `${currency || "IDR"} ${formatAmount(amount || 0, { fractionDigits: 0 })}`;
}

function parseOrderMetadata(raw: unknown): Record<string, any> | null {
	if (!raw) return null;
	if (typeof raw === "object") return raw as Record<string, any>;
	if (typeof raw !== "string") return null;
	const text = raw.trim();
	if (!text) return null;
	try {
		const parsed = JSON.parse(text);
		if (parsed && typeof parsed === "object") return parsed as Record<string, any>;
	} catch {
		// ignore
	}
	return null;
}

function parseCustomerConfirmation(raw: unknown): {
	status?: string;
	seller_message?: string;
	requested_at?: string;
	approved_at?: string;
	rejected_at?: string;
	reject_reason?: string;
} | null {
	const metadata = parseOrderMetadata(raw);
	const value = metadata?.customer_confirmation;
	if (!value || typeof value !== "object") return null;
	return value as {
		status?: string;
		seller_message?: string;
		requested_at?: string;
		approved_at?: string;
		rejected_at?: string;
		reject_reason?: string;
	};
}

function parseDisputeMetadata(raw: unknown): {
	opened_at?: string;
	customer_reason?: string;
	seller_note?: string;
	seller_note_at?: string;
	seller_member_id?: string;
	admin_decision?: string;
	admin_note?: string;
	resolved_by_admin_id?: string;
	resolved_at?: string;
	refund_note?: string;
	refund_completed_by_admin_id?: string;
	refund_completed_at?: string;
} | null {
	const metadata = parseOrderMetadata(raw);
	const value = metadata?.dispute;
	if (!value || typeof value !== "object") return null;
	return value as {
		opened_at?: string;
		customer_reason?: string;
		seller_note?: string;
		seller_note_at?: string;
		seller_member_id?: string;
		admin_decision?: string;
		admin_note?: string;
		resolved_by_admin_id?: string;
		resolved_at?: string;
		refund_note?: string;
		refund_completed_by_admin_id?: string;
		refund_completed_at?: string;
	};
}

function normalizePaymentStatus(status?: string | null) {
	return String(status || "").trim().toLowerCase();
}

function translateOrderStatus(t: ReturnType<typeof useTranslations>, status?: string | null) {
	const value = String(status || "").trim().toLowerCase() === "confirmed" ? "processing" : String(status || "").trim().toLowerCase();
	const statusKeyMap: Record<string, string> = {
		awaiting_quote: "orderStatus.awaitingQuote",
		shipped: "orderStatus.shipped",
		waiting_customer_confirmation: "orderStatus.waitingCustomerConfirmation",
		in_dispute: "orderStatus.inDispute",
		refunded: "orderStatus.refunded",
		quote_ready: "orderStatus.quoteReady",
		paid: "orderStatus.paid",
		processing: "orderStatus.processing",
		completed: "orderStatus.completed",
		verification: "orderStatus.verification",
		expired: "orderStatus.expired",
		cancelled: "orderStatus.cancelled",
		canceled: "orderStatus.cancelled",
		pending: "orderStatus.pending",
		delivered: "orderStatus.completed",
	};
	const key = statusKeyMap[value];
	return key ? t(key, value.replace(/_/g, " ")) : value || "-";
}

function translatePaymentStatus(t: ReturnType<typeof useTranslations>, status?: string | null) {
	const value = normalizePaymentStatus(status);
	const statusKeyMap: Record<string, string> = {
		pending: "paymentStatus.pending",
		unpaid: "paymentStatus.unpaid",
		paid: "paymentStatus.paid",
		failed: "paymentStatus.failed",
		refunded: "paymentStatus.refunded",
		cancelled: "paymentStatus.cancelled",
		canceled: "paymentStatus.cancelled",
		expired: "paymentStatus.expired",
	};
	const key = statusKeyMap[value];
	return key ? t(key, value.replace(/_/g, " ")) : value || "-";
}

function translateDeliveryStatus(t: ReturnType<typeof useTranslations>, status?: string | null) {
	const value = String(status || "").trim().toLowerCase();
	const statusKeyMap: Record<string, string> = {
		not_applicable: "deliveryStatus.notApplicable",
		pending: "deliveryStatus.pending",
		ready_to_ship: "deliveryStatus.readyToShip",
		partially_shipped: "deliveryStatus.partiallyShipped",
		shipped: "deliveryStatus.shipped",
		in_transit: "deliveryStatus.shipped",
		delivered: "deliveryStatus.delivered",
		exception: "deliveryStatus.exception",
		returned: "deliveryStatus.returned",
		cancelled: "deliveryStatus.cancelled",
		canceled: "deliveryStatus.cancelled",
	};
	const key = statusKeyMap[value];
	return key ? t(key, value.replace(/_/g, " ")) : value || "-";
}

function orderStatusBadge(status: string) {
	const value = String(status || "").toLowerCase() === "confirmed" ? "processing" : String(status || "").toLowerCase();
	if (["waiting_customer_confirmation"].includes(value)) return "bg-sky-50 text-sky-700 border-sky-200";
	if (["in_dispute"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
	if (["refunded"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
	if (["completed"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
	if (["paid"].includes(value)) return "bg-teal-50 text-teal-700 border-teal-200";
	if (["processing", "packed"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
	if (["shipped", "delivered"].includes(value)) return "bg-indigo-50 text-indigo-700 border-indigo-200";
	if (["pending", "unpaid", "awaiting_payment", "awaiting_quote"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
	if (["expired"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
	if (["failed", "cancelled", "canceled", "rejected"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
	return "bg-slate-50 text-slate-700 border-slate-200";
}

function shipmentStatusBadge(status: string) {
	const value = status.toLowerCase();
	if (value === "not_applicable") return "bg-slate-100 text-slate-700 border-slate-200";
	if (value === "pending") return "bg-amber-100 text-amber-700 border-amber-200";
	if (value === "ready_to_ship") return "bg-sky-100 text-sky-700 border-sky-200";
	if (value === "partially_shipped") return "bg-indigo-100 text-indigo-700 border-indigo-200";
	if (value === "delivered") return "bg-emerald-100 text-emerald-700 border-emerald-200";
	if (value === "shipped" || value === "in_transit") return "bg-indigo-100 text-indigo-700 border-indigo-200";
	if (value === "exception") return "bg-rose-100 text-rose-700 border-rose-200";
	if (value === "returned") return "bg-orange-100 text-orange-700 border-orange-200";
	if (value === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
	if (value === "processing") return "bg-sky-100 text-sky-700 border-sky-200";
	return "bg-slate-100 text-slate-700 border-slate-200";
}

const makeTempID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function OrderDetailModal({ open, loading, order, businessID, businessName, onClose, onRefresh }: Props) {
	const [invoiceDownloading, setInvoiceDownloading] = useState(false);
	const [visiblePaymentCount, setVisiblePaymentCount] = useState(PAYMENT_HISTORY_BATCH_SIZE);
	const [proofsByPaymentID, setProofsByPaymentID] = useState<Record<string, PaymentProof[]>>({});
	const [openingProofKey, setOpeningProofKey] = useState("");
	const [manualValidationKey, setManualValidationKey] = useState("");
	const [shipments, setShipments] = useState<OrderShipment[]>([]);
	const [loadingShipments, setLoadingShipments] = useState(false);
	const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
	const [shippingQuoteForm, setShippingQuoteForm] = useState<ShippingQuoteForm>(emptyShippingQuoteForm);
	const [savingShippingQuote, setSavingShippingQuote] = useState(false);
	const [shippingAddressForm, setShippingAddressForm] = useState<ShippingAddressForm>(emptyShippingAddressForm);
	const [savingShippingAddress, setSavingShippingAddress] = useState(false);
	const [extraChargeRows, setExtraChargeRows] = useState<ExtraChargeRow[]>([]);
	const [savingExtraCharges, setSavingExtraCharges] = useState(false);
	const [shippableItems, setShippableItems] = useState<OrderItem[]>([]);
	const [loadingShippableItems, setLoadingShippableItems] = useState(false);
	const [shipmentForm, setShipmentForm] = useState<ShipmentForm>(emptyShipmentForm);
	const [creatingShipment, setCreatingShipment] = useState(false);
	const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
	const [editShipmentForm, setEditShipmentForm] = useState<EditShipmentForm>(emptyEditShipmentForm);
	const [savingShipment, setSavingShipment] = useState(false);
	const [editingShipmentID, setEditingShipmentID] = useState("");
	const [editShipmentModalOpen, setEditShipmentModalOpen] = useState(false);
	const [customerConfirmationFeatureEnabled, setCustomerConfirmationFeatureEnabled] = useState(false);
	const [confirmationMessage, setConfirmationMessage] = useState("");
	const [disputeNote, setDisputeNote] = useState("");
	const [savingDisputeNote, setSavingDisputeNote] = useState(false);
	const [requestingCustomerConfirmation, setRequestingCustomerConfirmation] = useState(false);

	const displayOrder = order;
	const uiLocale = typeof window === "undefined" ? "id" : getMemberLocaleFromPathname(window.location.pathname);
	const t = useTranslations("common", uiLocale);
	const orderMetadata = useMemo(() => parseOrderMetadata(displayOrder?.metadata), [displayOrder?.metadata]);
	const customerConfirmation = useMemo(() => parseCustomerConfirmation(displayOrder?.metadata), [displayOrder?.metadata]);
	const dispute = useMemo(() => parseDisputeMetadata(displayOrder?.metadata), [displayOrder?.metadata]);
	const shippingQuote = orderMetadata?.shipping_quote || orderMetadata?.shippingQuote || null;
	const shippingAddress = orderMetadata?.shipping_address || orderMetadata?.shippingAddress || null;
	const payments = useMemo(
		() => [...(displayOrder?.payments || [])].sort((left, right) => getPaymentSortTime(right) - getPaymentSortTime(left)),
		[displayOrder?.payments],
	);
	const visiblePayments = payments.slice(0, visiblePaymentCount);
	const canLoadMorePayments = visiblePaymentCount < payments.length;
	const needsManualPaymentValidation = useMemo(
		() => Boolean(displayOrder && String(displayOrder.payment_status || "").toLowerCase() !== "paid" && payments.some((payment) => isSuccessfulPayment(payment))),
		[displayOrder, payments],
	);

	useEffect(() => {
		if (!open) {
			setInvoiceDownloading(false);
			setShipments([]);
			setLoadingShipments(false);
			setDeliveryModalOpen(false);
			setShippingQuoteForm(emptyShippingQuoteForm);
			setSavingShippingQuote(false);
			setShippingAddressForm(emptyShippingAddressForm);
			setSavingShippingAddress(false);
			setExtraChargeRows([]);
			setSavingExtraCharges(false);
			setShippableItems([]);
			setLoadingShippableItems(false);
			setShipmentForm(emptyShipmentForm);
			setCreatingShipment(false);
			setShipmentModalOpen(false);
			setEditShipmentForm(emptyEditShipmentForm);
			setSavingShipment(false);
			setEditingShipmentID("");
			setEditShipmentModalOpen(false);
			setVisiblePaymentCount(PAYMENT_HISTORY_BATCH_SIZE);
			setProofsByPaymentID({});
			setOpeningProofKey("");
		}
	}, [open, order?.id]);

	useEffect(() => {
		if (!displayOrder) return;
		setShippingQuoteForm({
			shipping_amount: shippingQuote?.shipping_amount != null ? String(shippingQuote.shipping_amount) : String(displayOrder.shipping_amount || 0),
			carrier_name: String(shippingQuote?.carrier_name || ""),
			service_name: String(shippingQuote?.service_name || ""),
			tracking_number: String(shippingQuote?.tracking_number || ""),
			estimated_delivery: String(shippingQuote?.estimated_delivery || ""),
			description: String(shippingQuote?.description || ""),
			notes: String(shippingQuote?.notes || ""),
		});
		setShippingAddressForm({ address_id: String(shippingAddress?.address_id || shippingAddress?.id || "") });
		setExtraChargeRows(
			(displayOrder.extra_charges || []).map((item: OrderExtraCharge) => ({
				id: item.id || makeTempID(),
				name: item.name || "",
				amount: String(item.amount ?? 0),
				notes: item.notes || "",
				sort_order: String(item.sort_order ?? 0),
			})),
		);
		setConfirmationMessage(String(customerConfirmation?.seller_message || ""));
		setDisputeNote(String(dispute?.seller_note || ""));
	}, [displayOrder?.id, displayOrder?.metadata, displayOrder?.extra_charges, customerConfirmation?.seller_message, dispute?.seller_note]);

	useEffect(() => {
		if (!open) return;
		let active = true;
		void fetchStoreMaintenanceInfo().then((info) => {
			if (active) {
				setCustomerConfirmationFeatureEnabled(Boolean(info.order_customer_confirmation));
			}
		});
		return () => {
			active = false;
		};
	}, [open]);

	useEffect(() => {
		if (!open || !displayOrder?.id) return;
		let active = true;
		setLoadingShipments(true);
		setLoadingShippableItems(true);
		Promise.all([
			listMemberOrderShipments(businessID, displayOrder.id).catch(() => ({ data: [] as OrderShipment[] })),
			listMemberShippableItems(businessID, displayOrder.id).catch(() => ({ data: [] as OrderItem[] })),
		])
			.then(([shipmentsRes, itemsRes]) => {
				if (!active) return;
				setShipments(shipmentsRes.data || []);
				setShippableItems(itemsRes.data || []);
				setShipmentForm((current) => ({
					...current,
					item_ids:
						Object.keys(current.item_ids).length > 0
							? current.item_ids
							: Object.fromEntries((itemsRes.data || []).map((item) => [item.id, false])),
				}));
			})
			.finally(() => {
				if (active) {
					setLoadingShipments(false);
					setLoadingShippableItems(false);
				}
			});
		return () => {
			active = false;
		};
	}, [open, displayOrder?.id, businessID]);

	useEffect(() => {
		if (!open || !displayOrder?.id || payments.length === 0) {
			setProofsByPaymentID({});
			return;
		}

		let cancelled = false;

		const run = async () => {
			const proofPayments = payments.filter((payment) => requiresPaymentProof(payment));
			if (proofPayments.length === 0) {
				setProofsByPaymentID({});
				return;
			}

			const entries = await Promise.all(
				proofPayments.map(async (payment) => {
					try {
						const result = await listMemberOrderPaymentProofs(businessID, displayOrder.id, payment.id);
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

		void run();
		return () => {
			cancelled = true;
		};
	}, [open, displayOrder?.id, businessID, payments]);

	const refreshOrder = async () => {
		if (onRefresh) {
			await onRefresh();
		}
	};

	const handleDownloadInvoice = async () => {
		if (!displayOrder?.id) return;
		setInvoiceDownloading(true);
		try {
			const blob = await downloadMemberOrderInvoice(businessID, displayOrder.id);
			const url = URL.createObjectURL(blob);
			window.open(url, "_blank", "noopener,noreferrer");
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal download invoice");
		} finally {
			setInvoiceDownloading(false);
		}
	};

	const openProof = async (paymentID: string, proofID: string) => {
		if (!displayOrder?.id) return;
		const opKey = `${paymentID}:${proofID}`;
		setOpeningProofKey(opKey);
		try {
			const blob = await getMemberOrderPaymentProofBlob(businessID, displayOrder.id, paymentID, proofID);
			const objectURL = URL.createObjectURL(blob);
			window.open(objectURL, "_blank", "noopener,noreferrer");
			setTimeout(() => URL.revokeObjectURL(objectURL), 120_000);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal membuka bukti pembayaran");
		} finally {
			setOpeningProofKey("");
		}
	};

	const manualValidatePayment = async (paymentID: string) => {
		if (!displayOrder?.id) return;
		const payment = payments.find((item) => item.id === paymentID) || null;
		if (!payment || !isSuccessfulPayment(payment)) {
			notifyError("Payment source harus berstatus sukses");
			return;
		}
		const note = window.prompt("Catatan validasi manual (opsional):", "");
		if (note === null) return;
		const confirmMessage = `Validasi manual payment ${paymentID} untuk order ${displayOrder.order_number || displayOrder.id} dan sinkronkan status order?`;
		if (!window.confirm(confirmMessage)) return;
		setManualValidationKey(paymentID);
		try {
			await validateMemberOrderPaymentFromHistory(businessID, displayOrder.id, paymentID, { note: note.trim() || undefined });
			notifySuccess("Order berhasil divalidasi manual");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal validasi manual payment");
		} finally {
			setManualValidationKey("");
		}
	};

	const openDeliveryModal = () => {
		setDeliveryModalOpen(true);
	};

	const openCreateShipmentModal = () => {
		if (!displayOrder?.id) return;
		setShipmentForm({
			carrier_name: String(shippingQuote?.carrier_name || ""),
			service_name: String(shippingQuote?.service_name || ""),
			tracking_number: "",
			shipping_amount: shippingQuote?.shipping_amount != null ? String(shippingQuote.shipping_amount) : "0",
			estimated_delivery: String(shippingQuote?.estimated_delivery || ""),
			description: String(shippingQuote?.description || ""),
			notes: String(shippingQuote?.notes || ""),
			item_ids: Object.fromEntries(shippableItems.map((item) => [item.id, false])),
		});
		setShipmentModalOpen(true);
	};

	const deliveryPageHref = displayOrder?.id && businessID
		? `/member/orders/${encodeURIComponent(displayOrder.id)}/delivery?business_id=${encodeURIComponent(businessID)}`
		: "#";

	const handleSaveShippingQuote = async () => {
		if (!displayOrder?.id) return;
		const shippingAmount = Number(shippingQuoteForm.shipping_amount || "0");
		if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
			notifyError("Shipping amount harus angka >= 0");
			return;
		}
		setSavingShippingQuote(true);
		try {
			await updateMemberOrderShippingQuote(businessID, displayOrder.id, {
				shipping_amount: shippingAmount,
				carrier_name: shippingQuoteForm.carrier_name.trim(),
				service_name: shippingQuoteForm.service_name.trim(),
				tracking_number: shippingQuoteForm.tracking_number.trim(),
				estimated_delivery: shippingQuoteForm.estimated_delivery.trim(),
				description: shippingQuoteForm.description.trim(),
				notes: shippingQuoteForm.notes.trim(),
			});
			notifySuccess("Shipping quote updated");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal update shipping quote");
		} finally {
			setSavingShippingQuote(false);
		}
	};

	const handleSaveShippingAddress = async () => {
		if (!displayOrder?.id) return;
		if (!shippingAddressForm.address_id.trim()) {
			notifyError("Address ID wajib diisi");
			return;
		}
		setSavingShippingAddress(true);
		try {
			await updateMemberOrderShippingAddress(businessID, displayOrder.id, { address_id: shippingAddressForm.address_id.trim() });
			notifySuccess("Shipping address updated");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal update shipping address");
		} finally {
			setSavingShippingAddress(false);
		}
	};

	const handleSaveExtraCharges = async () => {
		if (!displayOrder?.id) return;
		setSavingExtraCharges(true);
		try {
			const charges = extraChargeRows.map((row) => ({
				name: row.name.trim(),
				amount: Number(row.amount || 0),
				notes: row.notes.trim(),
				sort_order: Number(row.sort_order || 0),
			}));
			await replaceMemberOrderExtraCharges(businessID, displayOrder.id, { charges });
			notifySuccess("Extra charges replaced");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal update extra charges");
		} finally {
			setSavingExtraCharges(false);
		}
	};

	const selectedShipmentItemIDs = useMemo(
		() => Object.entries(shipmentForm.item_ids).filter(([, selected]) => selected).map(([id]) => id),
		[shipmentForm.item_ids],
	);

	const handleCreateShipment = async () => {
		if (!displayOrder?.id) return;
		if (selectedShipmentItemIDs.length === 0) {
			notifyError("Pilih minimal 1 item shipment");
			return;
		}
		const shippingAmount = Number(shipmentForm.shipping_amount || "0");
		if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
			notifyError("Biaya kirim harus angka >= 0");
			return;
		}
		setCreatingShipment(true);
		try {
			await createMemberOrderShipment(businessID, displayOrder.id, {
				carrier_name: shipmentForm.carrier_name.trim(),
				service_name: shipmentForm.service_name.trim(),
				tracking_number: shipmentForm.tracking_number.trim(),
				shipping_amount: shippingAmount,
				estimated_delivery: shipmentForm.estimated_delivery.trim(),
				description: shipmentForm.description.trim(),
				notes: shipmentForm.notes.trim(),
				item_ids: selectedShipmentItemIDs,
			});
			notifySuccess("Shipment created");
				setShipmentModalOpen(false);
			setShipmentForm(emptyShipmentForm);
			await Promise.all([
				listMemberOrderShipments(businessID, displayOrder.id).then((res) => setShipments(res.data || [])),
				refreshOrder(),
			]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal membuat shipment");
		} finally {
			setCreatingShipment(false);
		}
	};

	const handleStartEditShipment = (shipment: OrderShipment) => {
		setEditingShipmentID(shipment.id);
		setEditShipmentForm({
			shipment_id: shipment.id,
			status: (shipment.status || "pending") as EditShipmentForm["status"],
			carrier_name: shipment.carrier_name || "",
			service_name: shipment.service_name || "",
			tracking_number: shipment.tracking_number || "",
			shipping_amount: String(shipment.shipping_amount ?? 0),
			estimated_delivery: shipment.estimated_delivery || "",
			description: shipment.description || "",
			notes: shipment.notes || "",
		});
		setEditShipmentModalOpen(true);
	};

	const handleSaveShipment = async () => {
		if (!displayOrder?.id || !editShipmentForm.shipment_id) return;
		const shippingAmount = Number(editShipmentForm.shipping_amount || "0");
		if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
			notifyError("Biaya kirim shipment harus angka >= 0");
			return;
		}
		setSavingShipment(true);
		try {
			await updateMemberOrderShipment(businessID, displayOrder.id, editShipmentForm.shipment_id, {
				status: editShipmentForm.status,
				carrier_name: editShipmentForm.carrier_name.trim(),
				service_name: editShipmentForm.service_name.trim(),
				tracking_number: editShipmentForm.tracking_number.trim(),
				shipping_amount: shippingAmount,
				estimated_delivery: editShipmentForm.estimated_delivery.trim(),
				description: editShipmentForm.description.trim(),
				notes: editShipmentForm.notes.trim(),
			});
			notifySuccess("Shipment updated");
			setEditingShipmentID("");
			setEditShipmentModalOpen(false);
			setEditShipmentForm(emptyEditShipmentForm);
			await Promise.all([
				listMemberOrderShipments(businessID, displayOrder.id).then((res) => setShipments(res.data || [])),
				refreshOrder(),
			]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal update shipment");
		} finally {
			setSavingShipment(false);
		}
	};

	const handleDeleteShipment = async (shipmentID: string) => {
		if (!displayOrder?.id) return;
		if (typeof window !== "undefined" && !window.confirm("Hapus shipment ini?")) return;
		try {
			await deleteMemberOrderShipment(businessID, displayOrder.id, shipmentID);
			notifySuccess("Shipment deleted");
			await Promise.all([
				listMemberOrderShipments(businessID, displayOrder.id).then((res) => setShipments(res.data || [])),
				refreshOrder(),
			]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus shipment");
		}
	};

	const hasEligibleShipment = useMemo(
		() => shipments.some((shipment) => ["shipped", "delivered"].includes(String(shipment.status || "").toLowerCase())),
		[shipments],
	);
	const hasShippingAddress = useMemo(() => {
		if (!shippingAddress) return false;
		return [
			shippingAddress.receiver_name,
			shippingAddress.phone_number,
			shippingAddress.address_summary,
			shippingAddress.address_line_1,
			shippingAddress.city,
			shippingAddress.province,
			shippingAddress.postal_code,
		].some((value) => String(value || "").trim().length > 0);
	}, [shippingAddress]);
	const latestShipment = useMemo(() => {
		if (!shipments.length) return null;
		return [...shipments].sort((a, b) => {
			const left = a.updated_at ? new Date(a.updated_at).getTime() : 0;
			const right = b.updated_at ? new Date(b.updated_at).getTime() : 0;
			return right - left;
		})[0] || null;
	}, [shipments]);
	const latestShipmentStatusMeta = useMemo(() => {
		const status = String(latestShipment?.status || "").toLowerCase();
		switch (status) {
			case "delivered":
				return { label: "delivered", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
			case "shipped":
				return { label: "shipped", className: "bg-sky-100 text-sky-700 border-sky-200" };
			case "processing":
				return { label: "processing", className: "bg-amber-100 text-amber-700 border-amber-200" };
			case "cancelled":
				return { label: "cancelled", className: "bg-slate-100 text-slate-700 border-slate-200" };
			default:
				return { label: status || "pending", className: "bg-amber-100 text-amber-700 border-amber-200" };
		}
	}, [latestShipment?.status]);
	const shippingQuoteReady = Boolean(shippingQuote);
	const displayedTrackingNumber = String(latestShipment?.tracking_number || shippingQuote?.tracking_number || "").trim();
	const displayedShipmentEta = String(latestShipment?.estimated_delivery || shippingQuote?.estimated_delivery || "").trim();
	const displayOrderStatus = String(displayOrder?.status || "").toLowerCase();
	const disputeDecision = String(dispute?.admin_decision || "").toLowerCase();
	const shouldShowCustomerConfirmationSection = Boolean(
		customerConfirmationFeatureEnabled || customerConfirmation || ["waiting_customer_confirmation", "in_dispute"].includes(displayOrderStatus),
	);
	const customerConfirmationRequestEligible = Boolean(
		displayOrder?.id &&
		String(displayOrder.payment_status || "").toLowerCase() === "paid" &&
		hasEligibleShipment &&
		!["completed", "cancelled", "canceled"].includes(displayOrderStatus),
	);

	const canRequestCustomerConfirmation = Boolean(
		customerConfirmationFeatureEnabled && customerConfirmationRequestEligible,
	);
	const canEditDisputeNote = Boolean(displayOrder?.id && displayOrderStatus === "in_dispute" && (!disputeDecision || disputeDecision === "open"));

	const handleRequestCustomerConfirmation = async () => {
		if (!displayOrder?.id) return;
		if (!customerConfirmationFeatureEnabled) {
			notifyError("Fitur customer confirmation sedang dimatikan.");
			return;
		}
		if (!canRequestCustomerConfirmation) {
			notifyError("Order belum bisa diajukan ke customer. Pastikan pembayaran lunas dan shipment sudah dikirim.");
			return;
		}
		setRequestingCustomerConfirmation(true);
		try {
			await requestMemberOrderCustomerConfirmation(businessID, displayOrder.id, {
				message: confirmationMessage.trim() || undefined,
			});
			notifySuccess("Permintaan konfirmasi sudah dikirim ke customer via email.");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal mengirim permintaan konfirmasi ke customer");
		} finally {
			setRequestingCustomerConfirmation(false);
		}
	};

	const handleSaveDisputeNote = async () => {
		if (!displayOrder?.id) return;
		if (!canEditDisputeNote) {
			notifyError("Dispute note hanya bisa diubah saat dispute masih menunggu review admin.");
			return;
		}
		if (!disputeNote.trim()) {
			notifyError("Tulis catatan seller terlebih dahulu.");
			return;
		}
		setSavingDisputeNote(true);
		try {
			await upsertMemberOrderDisputeNote(businessID, displayOrder.id, { note: disputeNote.trim() });
			notifySuccess("Catatan dispute berhasil disimpan.");
			await refreshOrder();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menyimpan catatan dispute");
		} finally {
			setSavingDisputeNote(false);
		}
	};

	const orderItems = displayOrder?.order_items || [];

	return (
		<>
		<MemberModal
			open={open}
			onClose={onClose}
			title={displayOrder ? `${displayOrder.order_number}` : "Order Detail"}
			maxWidth="2xl"
			footer={
				<>
					<button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Close
					</button>
					<button type="button" onClick={() => void refreshOrder()} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Refresh
					</button>
						{displayOrder?.id ? (
							<a href={`/member/complaints?order_id=${encodeURIComponent(displayOrder.id)}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
								Complaint List
							</a>
						) : null}
					<button type="button" onClick={() => void handleDownloadInvoice()} disabled={invoiceDownloading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70">
						{invoiceDownloading ? "Downloading..." : "Download Invoice"}
					</button>
				</>
			}
		>
			{loading ? (
				<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading order detail...</div>
			) : displayOrder ? (
				<div className="space-y-6">
					<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">Order</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{displayOrder.order_number}</p>
							<p className="text-xs text-slate-500">{displayOrder.id}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">Business</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{businessName || displayOrder.business_id || "-"}</p>
							<p className="text-xs text-slate-500">{displayOrder.business_id || "-"}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
							<p className="mt-2 text-lg font-semibold text-slate-900">{displayOrder.customer?.name || displayOrder.customer?.id || displayOrder.customer_id || "-"}</p>
							<p className="text-xs text-slate-500">{displayOrder.customer?.email || displayOrder.customer?.phone || "-"}</p>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
							<div className="mt-2 flex flex-wrap gap-2">
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(displayOrder.status)}`}>{translateOrderStatus(t, displayOrder.status)}</span>
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(displayOrder.payment_status)}`}>{translatePaymentStatus(t, displayOrder.payment_status)}</span>
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${shipmentStatusBadge(displayOrder.delivery_status || "")}`}>{translateDeliveryStatus(t, displayOrder.delivery_status || "")}</span>
							</div>
						</div>
					</section>

					{shouldShowCustomerConfirmationSection ? <section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Customer Confirmation</h4>
								<p className="mt-1 text-xs text-slate-500">Seller mengajukan barang sudah sampai, lalu customer akan menerima email untuk approve atau reject.</p>
							</div>
							{customerConfirmationFeatureEnabled ? (
								<button
									type="button"
									onClick={() => void handleRequestCustomerConfirmation()}
									disabled={!canRequestCustomerConfirmation || requestingCustomerConfirmation}
									className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{requestingCustomerConfirmation
										? "Sending..."
										: displayOrderStatus === "waiting_customer_confirmation"
											? "Resend Request"
											: "Request Customer Confirmation"}
								</button>
							) : null}
						</div>

						<div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
							<label className="block text-sm">
								<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Message to Customer</span>
								<textarea
									value={confirmationMessage}
									onChange={(event) => setConfirmationMessage(event.target.value)}
									disabled={!customerConfirmationFeatureEnabled}
									className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
									placeholder="Contoh: Barang sudah tiba, silakan dicek ya."
								/>
							</label>

							<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
								<div className="flex items-center justify-between gap-3">
									<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current State</span>
									<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(displayOrder.status)}`}>{translateOrderStatus(t, displayOrder.status)}</span>
								</div>
								<div className="mt-3 space-y-2 text-xs text-slate-600">
									<div>Pembayaran: <span className="font-medium text-slate-800">{translatePaymentStatus(t, displayOrder.payment_status)}</span></div>
									<div>Shipment siap: <span className="font-medium text-slate-800">{hasEligibleShipment ? "Ya" : "Belum"}</span></div>
									{customerConfirmation?.requested_at ? <div>Diajukan: <span className="font-medium text-slate-800">{formatDateTime(customerConfirmation.requested_at, uiLocale)}</span></div> : null}
									{customerConfirmation?.approved_at ? <div>Disetujui: <span className="font-medium text-slate-800">{formatDateTime(customerConfirmation.approved_at, uiLocale)}</span></div> : null}
									{customerConfirmation?.rejected_at ? <div>Ditolak: <span className="font-medium text-slate-800">{formatDateTime(customerConfirmation.rejected_at, uiLocale)}</span></div> : null}
									{customerConfirmation?.reject_reason ? (
										<div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
											Alasan customer: {customerConfirmation.reject_reason}
										</div>
									) : null}
									{dispute?.customer_reason ? (
										<div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
											<div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Dispute</div>
											<div className="mt-1">Alasan customer: {dispute.customer_reason}</div>
												{dispute.opened_at ? <div className="mt-1 text-[11px] text-rose-600">Dibuka: {formatDateTime(dispute.opened_at, uiLocale)}</div> : null}
										</div>
									) : null}
									{dispute?.seller_note ? (
										<div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700">
											<div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Catatan Seller</div>
											<div className="mt-1 whitespace-pre-wrap">{dispute.seller_note}</div>
												{dispute.seller_note_at ? <div className="mt-1 text-[11px] text-slate-500">Diperbarui: {formatDateTime(dispute.seller_note_at, uiLocale)}</div> : null}
										</div>
									) : null}
									{dispute?.admin_decision ? (
										<div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700">
											<div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Keputusan Admin</div>
											<div className="mt-1 font-medium text-slate-800">{dispute.admin_decision}</div>
											{dispute.admin_note ? <div className="mt-1 whitespace-pre-wrap">{dispute.admin_note}</div> : null}
											{dispute.refund_note ? <div className="mt-1 whitespace-pre-wrap">Refund: {dispute.refund_note}</div> : null}
												{dispute.resolved_at ? <div className="mt-1 text-[11px] text-slate-500">Diputuskan: {formatDateTime(dispute.resolved_at, uiLocale)}</div> : null}
												{dispute.refund_completed_at ? <div className="mt-1 text-[11px] text-slate-500">Refund selesai: {formatDateTime(dispute.refund_completed_at, uiLocale)}</div> : null}
										</div>
									) : null}
									{!customerConfirmationFeatureEnabled ? (
										<div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700">
											Fitur customer confirmation sedang dimatikan. Order yang sudah masuk alur ini tetap bisa dipantau di sini.
										</div>
									) : !customerConfirmationRequestEligible ? (
										<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
											Order baru bisa diajukan setelah lunas dan ada shipment dengan status shipped atau delivered.
										</div>
									) : null}
								</div>
							</div>
						</div>
						{displayOrderStatus === "in_dispute" ? (
							<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggapan Seller</div>
										<p className="mt-1 text-xs text-slate-500">Catatan ini dipakai admin saat memutuskan dispute.</p>
									</div>
									{disputeDecision && disputeDecision !== "open" ? (
										<span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">Dispute locked: {disputeDecision}</span>
									) : null}
								</div>
								<textarea
									value={disputeNote}
									onChange={(event) => setDisputeNote(event.target.value)}
									disabled={!canEditDisputeNote || savingDisputeNote}
									className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
									placeholder="Jelaskan versi seller, misalnya status resi, bukti serah terima, atau hal yang perlu dicek admin."
								/>
								<div className="mt-3 flex justify-end">
									<button
										type="button"
										onClick={() => void handleSaveDisputeNote()}
										disabled={!canEditDisputeNote || savingDisputeNote}
										className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{savingDisputeNote ? "Saving..." : dispute?.seller_note ? "Update Seller Note" : "Send Seller Note"}
									</button>
								</div>
							</div>
						) : null}
					</section> : null}

					<section id="member-order-shipments" className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Order Summary</h4>
								<p className="text-xs text-slate-500">Ringkasan nilai order dan item.</p>
							</div>
							<div className="flex flex-wrap gap-2 text-sm">
								<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Subtotal {money(displayOrder.currency, displayOrder.subtotal)}</span>
								<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Shipping {money(displayOrder.currency, displayOrder.shipping_amount)}</span>
								<span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Grand {money(displayOrder.currency, displayOrder.grand_total)}</span>
							</div>
						</div>
						<div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
							<table className="min-w-full text-sm">
								<thead className="bg-slate-50 text-left text-slate-600">
									<tr>
										<th className="px-3 py-2">Item</th>
										<th className="px-3 py-2">Qty</th>
										<th className="px-3 py-2">Price</th>
										<th className="px-3 py-2">Tax</th>
										<th className="px-3 py-2">Total</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-200">
									{orderItems.map((item) => (
										<tr key={item.id}>
											<td className="px-3 py-2">
												<div className="font-medium text-slate-900">{item.product_name || item.sku || item.id}</div>
												<div className="text-xs text-slate-500">{item.product_id || "-"}</div>
											</td>
											<td className="px-3 py-2 text-slate-700">{item.qty}</td>
											<td className="px-3 py-2 text-slate-700">{money(displayOrder.currency, item.unit_price)}</td>
											<td className="px-3 py-2 text-slate-700">{money(displayOrder.currency, item.tax_amount)}</td>
											<td className="px-3 py-2 text-slate-700">{money(displayOrder.currency, item.line_total)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section className="grid gap-4 xl:grid-cols-2">
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<h4 className="text-sm font-semibold text-slate-900">Payments</h4>
							{needsManualPaymentValidation ? (
								<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
									Ada payment sukses tetapi order masih belum paid. Gunakan Validasi Manual pada payment source yang benar.
								</div>
							) : null}
							<div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto pr-1" style={{ colorScheme: "light" }}>
								{payments.length === 0 ? <p className="text-sm text-slate-500">No payments found.</p> : null}
								{visiblePayments.map((payment) => {
									const proofRequired = requiresPaymentProof(payment);
									const paymentProofs = proofsByPaymentID[payment.id] || [];
									const canManualValidate = isSuccessfulPayment(payment) && String(displayOrder?.payment_status || "").toLowerCase() !== "paid";
									return (
										<div key={payment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
											<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<p className="font-medium text-slate-900">{payment.payment_method || payment.gateway_name || payment.provider_key || payment.id}</p>
													<p className="mt-1 text-xs text-slate-500">{payment.id}</p>
													<p className="mt-1 text-xs text-slate-500">Payment time: {formatDateTime(payment.created_at || payment.updated_at, uiLocale)}</p>
												</div>
												<div className="text-right">
													<p className="text-sm font-semibold text-slate-900">{money(payment.currency, payment.amount)}</p>
													<div className="mt-2 flex items-center justify-end gap-2">
														<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(payment.status || "")}`}>{translatePaymentStatus(t, payment.status)}</span>
														{proofRequired ? (
															<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(payment.proof_status || "")}`}>{payment.proof_status}</span>
														) : null}
													</div>
													{canManualValidate ? (
														<div className="mt-2 flex justify-end">
															<button
																type="button"
																onClick={() => void manualValidatePayment(payment.id)}
																disabled={manualValidationKey === payment.id}
																className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
															>
																{manualValidationKey === payment.id ? "Memvalidasi..." : "Validasi Manual"}
															</button>
														</div>
													) : null}
												</div>
											</div>
											{proofRequired && paymentProofs.length > 0 ? (
												<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
													<div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bukti Transfer</div>
													<div className="mt-2 space-y-2">
														{paymentProofs.map((proof) => {
															const opKey = `${payment.id}:${proof.id}`;
															return (
																<div key={proof.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
																	<div className="min-w-0">
																		<div className="truncate font-medium text-slate-800">{proof.id}</div>
																		<div className="text-slate-500">{proof.status} · {formatDateTime(proof.created_at, uiLocale)}</div>
																	</div>
																	<button
																		type="button"
																		onClick={() => void openProof(payment.id, proof.id)}
																		disabled={openingProofKey === opKey}
																		className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
																	>
																		{openingProofKey === opKey ? "Membuka..." : "Lihat"}
																	</button>
																</div>
															);
														})}
													</div>
												</div>
											) : proofRequired ? (
												<div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
													Belum ada file bukti pembayaran pada transaksi ini.
												</div>
											) : null}
										</div>
									);
								})}
								{canLoadMorePayments ? (
									<div className="flex justify-center pt-1">
										<button
											type="button"
											onClick={() => setVisiblePaymentCount((current) => current + PAYMENT_HISTORY_BATCH_SIZE)}
											className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
										>
											Muat lebih banyak
										</button>
									</div>
								) : null}
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Delivery System</h4>
								<p className="mt-1 text-xs text-slate-500">Ringkasan ongkir dan shipment sudah dirapikan di sini. Detail edit ada di sub-modal agar modal order utama tetap fokus ke informasi final.</p>
							</div>
							{shippingQuoteReady ? (
								<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Ready</span>
							) : (
								<span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span>
							)}
						</div>

						{!hasShippingAddress ? (
							<div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
								Alamat pengiriman belum dipilih. Buka Delivery System untuk memilih address customer.
							</div>
						) : null}

						<div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-700">
							<div className="rounded-lg bg-slate-50 p-3">
								<p className="text-xs uppercase text-slate-500">Ongkir Final</p>
								<p className="mt-1 font-semibold text-slate-900">{money(displayOrder?.currency || "", Number(shippingQuote?.shipping_amount || displayOrder?.shipping_amount || 0))}</p>
							</div>
							<div className="rounded-lg bg-slate-50 p-3">
								<p className="text-xs uppercase text-slate-500">Shipment</p>
								{latestShipment ? (
									<>
										<div className="mt-1 flex flex-wrap items-center gap-2">
											<p className="text-base font-semibold text-slate-900">{shipments.length} resi</p>
											<span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${latestShipmentStatusMeta.className}`}>
												{latestShipmentStatusMeta.label}
											</span>
										</div>
										<p className="mt-1 truncate text-xs text-slate-500">{latestShipment.carrier_name || "Carrier"}{latestShipment.service_name ? ` - ${latestShipment.service_name}` : ""}</p>
												<p className="mt-1 text-[11px] text-slate-500">Update terakhir: {formatDateTime(latestShipment.updated_at, uiLocale)}</p>
									</>
								) : displayedTrackingNumber ? (
									<>
										<div className="mt-1 flex flex-wrap items-center gap-2">
											<p className="text-base font-semibold text-slate-900">Resi tersimpan di ongkir</p>
											<span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Quote</span>
										</div>
										<p className="mt-1 truncate text-xs text-slate-500">{String(shippingQuote?.carrier_name || "Carrier")}{shippingQuote?.service_name ? ` - ${String(shippingQuote.service_name)}` : ""}</p>
										<p className="mt-1 text-[11px] text-slate-500">Tracking: {displayedTrackingNumber}</p>
									</>
								) : (
									<p className="mt-1 font-semibold text-slate-900">Belum ada resi</p>
								)}
							</div>
							<div className="rounded-lg bg-slate-50 p-3">
								<p className="text-xs uppercase text-slate-500">Resi Terakhir</p>
								<p className="mt-1 truncate font-semibold text-slate-900">{displayedTrackingNumber || "-"}</p>
								<p className="mt-1 text-xs text-slate-500">ETA: {displayedShipmentEta || "-"}</p>
							</div>
						</div>

						<div className="mt-4 flex items-center justify-between gap-2">
							<a href={deliveryPageHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
								Halaman Pengiriman ↗
							</a>
							<button type="button" onClick={openDeliveryModal} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
								Kelola Delivery
							</button>
						</div>
					</section>

					<MemberModal
						open={deliveryModalOpen}
						title="Delivery System"
						onClose={() => setDeliveryModalOpen(false)}
						maxWidth="2xl"
						footer={
							<button
								type="button"
								onClick={() => setDeliveryModalOpen(false)}
								className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
							>
								Tutup
							</button>
						}
					>
						<div className="space-y-4">
							<div className="rounded-xl border border-slate-200 bg-white p-4">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<h5 className="text-sm font-semibold text-slate-900">Shipping Address</h5>
										<p className="mt-1 text-xs text-slate-500">Alamat pengiriman dipakai sebagai snapshot ongkir dan shipment.</p>
									</div>
									{displayOrder?.id ? (
										<a href={deliveryPageHref} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">
											Buka halaman delivery
										</a>
									) : null}
								</div>

								{hasShippingAddress ? (
									<div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
										<div className="font-medium text-slate-900">{shippingAddress?.receiver_name || shippingAddress?.name || shippingAddress?.address_summary || shippingAddress?.address_line_1 || "-"}</div>
										<div className="mt-1 text-xs text-slate-500">{shippingAddress?.address_line_1 || shippingAddress?.address_summary || "-"}</div>
									</div>
								) : (
									<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Alamat customer belum diisi.</div>
								)}

								<label className="mt-3 block text-sm">
									<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address ID</span>
									<input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingAddressForm.address_id} onChange={(e) => setShippingAddressForm({ address_id: e.target.value })} placeholder="UUID alamat customer" />
								</label>

								<div className="mt-3 flex justify-end">
									<button type="button" onClick={() => void handleSaveShippingAddress()} disabled={savingShippingAddress} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
										{savingShippingAddress ? "Menyimpan..." : "Pilih Alamat Ini"}
									</button>
								</div>
							</div>

							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<h5 className="text-sm font-semibold text-slate-900">Shipping Quote</h5>
										<p className="mt-1 text-xs text-slate-500">Isi ongkir final dulu untuk buka pembayaran.</p>
									</div>
									{shippingQuoteReady ? (
										<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Ready</span>
									) : (
										<span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span>
									)}
								</div>

								{!hasShippingAddress ? (
									<div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
										Alamat customer belum diisi. Lengkapi alamat dulu sebelum menyiapkan ongkir.
									</div>
								) : null}

								<div className="mt-3 grid gap-3 sm:grid-cols-2">
									<label className="text-sm">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ongkir</span>
										<input type="number" min="0" step="0.01" value={shippingQuoteForm.shipping_amount} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
									</label>
									<label className="text-sm">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kurir / Forwarder</span>
										<input value={shippingQuoteForm.carrier_name} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, carrier_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="DHL / JNE / FedEx / Forwarder" />
									</label>
									<label className="text-sm">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span>
										<input value={shippingQuoteForm.service_name} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, service_name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Express / Economy / Air / Sea" />
									</label>
									<label className="text-sm">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ETA</span>
										<input value={shippingQuoteForm.estimated_delivery} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="3-5 hari kerja / 7-14 hari" />
									</label>
									<label className="text-sm">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi Ongkir</span>
										<input value={shippingQuoteForm.description} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Alasan tarif, rute, volumetrik, dll" />
									</label>
									<label className="text-sm sm:col-span-2">
										<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan Internal / Ekstra</span>
										<textarea value={shippingQuoteForm.notes} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, notes: e.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Catatan tambahan, bea, asuransi, dokumen ekspor, dll" />
									</label>
								</div>

								{shippingQuote ? (
									<div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
										<div className="font-semibold text-slate-900">Detail Ongkir Tersimpan</div>
										<div className="mt-2 grid gap-1 sm:grid-cols-2">
											<div>Kurir: {String(shippingQuote.carrier_name || "-")}</div>
											<div>Service: {String(shippingQuote.service_name || "-")}</div>
											<div>Resi: {String(shippingQuote.tracking_number || "-")}</div>
											<div>ETA: {String(shippingQuote.estimated_delivery || "-")}</div>
											<div className="sm:col-span-2">Deskripsi: {String(shippingQuote.description || "-")}</div>
											<div className="sm:col-span-2">Catatan: {String(shippingQuote.notes || "-")}</div>
										</div>
									</div>
								) : null}

								<div className="mt-4 flex justify-end">
									<button type="button" onClick={() => void handleSaveShippingQuote()} disabled={savingShippingQuote || !hasShippingAddress} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
										{savingShippingQuote ? "Menyimpan..." : !hasShippingAddress ? "Isi Alamat Dulu" : "Simpan Ongkir"}
									</button>
								</div>
							</div>

							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<h5 className="text-sm font-semibold text-slate-900">Delivery / Shipments</h5>
										<p className="mt-1 text-xs text-slate-500">Pilih item non-digital per shipment. Satu order bisa punya banyak resi.</p>
									</div>
									<button type="button" onClick={openCreateShipmentModal} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
										Tambah Resi
									</button>
								</div>

								{loadingShipments ? (
									<p className="mt-3 text-sm text-slate-500">Memuat shipment...</p>
								) : shipments.length === 0 ? (
									<p className="mt-3 text-sm text-slate-500">Belum ada shipment untuk order ini.</p>
								) : (
									<div className="mt-3 space-y-2">
										{shipments.map((shipment) => (
											<div key={shipment.id} className="rounded-lg border border-slate-200 bg-white p-3">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<div className="text-sm text-slate-800">
														<p className="font-semibold text-slate-900">{shipment.carrier_name || "Carrier"} {shipment.service_name ? `- ${shipment.service_name}` : ""}</p>
														<p className="text-xs text-slate-500">Resi: {shipment.tracking_number || "-"} | Status: {shipment.status || "pending"}</p>
													</div>
													<div className="flex items-center gap-2">
														<span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{shipment.items?.length || 0} item</span>
														<button type="button" onClick={() => handleStartEditShipment(shipment)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Edit Shipment</button>
													</div>
												</div>
												<div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
													<div>Biaya Kirim: {money(displayOrder?.currency || "", shipment.shipping_amount || 0)}</div>
													<div>ETA: {shipment.estimated_delivery || "-"}</div>
													<div className="sm:col-span-2">Catatan: {shipment.notes || "-"}</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</MemberModal>

					<MemberModal
						open={shipmentModalOpen}
						title="Buat Shipment / Resi"
						onClose={() => setShipmentModalOpen(false)}
						maxWidth="lg"
						footer={
							<>
								<button type="button" onClick={() => setShipmentModalOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
									Batal
								</button>
								<button type="button" onClick={() => void handleCreateShipment()} disabled={creatingShipment} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
									{creatingShipment ? "Menyimpan..." : "Simpan"}
								</button>
							</>
						}
					>
						<div className="space-y-4">
							{loadingShippableItems ? <p className="text-sm text-slate-500">Memuat item shipment...</p> : null}
							{shippableItems.length > 0 ? (
								<div>
									<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pilih Item</p>
									<div className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2">
										{shippableItems.map((item) => (
											<label key={item.id} className="flex items-center gap-2 text-sm">
												<input type="checkbox" checked={Boolean(shipmentForm.item_ids[item.id])} onChange={(event) => setShipmentForm((prev) => ({ ...prev, item_ids: { ...prev.item_ids, [item.id]: event.target.checked } }))} />
												{item.product_name} (x{item.qty})
											</label>
										))}
									</div>
								</div>
							) : (
								<p className="text-sm text-slate-500">Belum ada item yang bisa dikirim.</p>
							)}

							<div className="grid gap-3 md:grid-cols-2">
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.carrier_name} onChange={(e) => setShipmentForm((prev) => ({ ...prev, carrier_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.service_name} onChange={(e) => setShipmentForm((prev) => ({ ...prev, service_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.tracking_number} onChange={(e) => setShipmentForm((prev) => ({ ...prev, tracking_number: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping Amount</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.shipping_amount} onChange={(e) => setShipmentForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Delivery</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.estimated_delivery} onChange={(e) => setShipmentForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.notes} onChange={(e) => setShipmentForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
								<label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.description} onChange={(e) => setShipmentForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
							</div>
						</div>
					</MemberModal>

					<MemberModal
						open={editShipmentModalOpen}
						title="Edit Shipment"
						onClose={() => setEditShipmentModalOpen(false)}
						maxWidth="lg"
						footer={
							<>
								<button type="button" onClick={() => setEditShipmentModalOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
									Batal
								</button>
								<button type="button" onClick={() => void handleSaveShipment()} disabled={savingShipment} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
									{savingShipment ? "Menyimpan..." : "Simpan"}
								</button>
							</>
						}
					>
						<div className="space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<label className="text-sm">
									<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
									<select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.status} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, status: e.target.value as EditShipmentForm["status"] }))}>
										<option value="pending">pending</option>
										<option value="processing">processing</option>
										<option value="ready_to_ship">ready_to_ship</option>
										<option value="shipped">shipped</option>
										<option value="in_transit">in_transit</option>
										<option value="delivered">delivered</option>
										<option value="exception">exception</option>
										<option value="returned">returned</option>
										<option value="cancelled">cancelled</option>
									</select>
								</label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.carrier_name} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, carrier_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.service_name} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, service_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.tracking_number} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, tracking_number: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping Amount</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.shipping_amount} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Delivery</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.estimated_delivery} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.notes} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
								<label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.description} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
							</div>
						</div>
					</MemberModal>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Extra Charges</h4>
								<p className="text-xs text-slate-500">Replace seluruh extra charges order ini sekaligus.</p>
							</div>
							<div className="flex items-center gap-2">
								<button type="button" onClick={() => setExtraChargeRows((rows) => [...rows, { id: makeTempID(), name: "", amount: "0", notes: "", sort_order: String(rows.length) }])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
									+ Add Charge
								</button>
								<button type="button" onClick={() => void handleSaveExtraCharges()} disabled={savingExtraCharges} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
									{savingExtraCharges ? "Saving..." : "Save Charges"}
								</button>
							</div>
						</div>
						<div className="mt-4 space-y-3">
							{extraChargeRows.length === 0 ? <p className="text-sm text-slate-500">No extra charges yet.</p> : null}
							{extraChargeRows.map((row, index) => (
								<div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_0.7fr_1fr_0.5fr_auto]">
									<input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.name} onChange={(e) => setExtraChargeRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} placeholder="Name" />
									<input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.amount} onChange={(e) => setExtraChargeRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: e.target.value } : item))} placeholder="Amount" />
									<input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.notes} onChange={(e) => setExtraChargeRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, notes: e.target.value } : item))} placeholder="Notes" />
									<input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={row.sort_order} onChange={(e) => setExtraChargeRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, sort_order: e.target.value } : item))} placeholder="Sort" />
									<button type="button" onClick={() => setExtraChargeRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-200">
										Remove
									</button>
								</div>
							))}
						</div>
					</section>

				</div>
			) : null}
		</MemberModal>
		</>
	);
}