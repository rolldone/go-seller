import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";
import MemberModal from "../ui/MemberModal";
import {
	createMemberOrderShipment,
	deleteMemberOrderShipment,
	downloadMemberOrderInvoice,
	listMemberOrderShipments,
	listMemberShippableItems,
	replaceMemberOrderExtraCharges,
	updateMemberOrderShippingAddress,
	updateMemberOrderShippingQuote,
	updateMemberOrderShipment,
} from "./api";
import type { Order, OrderExtraCharge, OrderItem, OrderShipment } from "./types";

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
	status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
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

function formatDateTime(value?: string | null) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
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

function orderStatusBadge(status: string) {
	const value = status.toLowerCase();
	if (["paid", "confirmed", "processing", "packed", "shipped", "delivered", "completed"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
	if (["pending", "unpaid", "awaiting_payment", "awaiting_quote"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
	if (["expired"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
	if (["failed", "cancelled", "canceled", "rejected"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
	return "bg-slate-50 text-slate-700 border-slate-200";
}

function shipmentStatusBadge(status: string) {
	const value = status.toLowerCase();
	if (value === "delivered") return "bg-emerald-100 text-emerald-700 border-emerald-200";
	if (value === "shipped") return "bg-sky-100 text-sky-700 border-sky-200";
	if (value === "processing") return "bg-amber-100 text-amber-700 border-amber-200";
	if (value === "cancelled") return "bg-slate-100 text-slate-700 border-slate-200";
	return "bg-amber-100 text-amber-700 border-amber-200";
}

const makeTempID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function OrderDetailModal({ open, loading, order, businessID, businessName, onClose, onRefresh }: Props) {
	const [invoiceDownloading, setInvoiceDownloading] = useState(false);
	const [shipments, setShipments] = useState<OrderShipment[]>([]);
	const [loadingShipments, setLoadingShipments] = useState(false);
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
	const [editShipmentForm, setEditShipmentForm] = useState<EditShipmentForm>(emptyEditShipmentForm);
	const [savingShipment, setSavingShipment] = useState(false);
	const [editingShipmentID, setEditingShipmentID] = useState("");

	const displayOrder = order;
	const orderMetadata = useMemo(() => parseOrderMetadata(displayOrder?.metadata), [displayOrder?.metadata]);
	const shippingQuote = orderMetadata?.shipping_quote || orderMetadata?.shippingQuote || null;
	const shippingAddress = orderMetadata?.shipping_address || orderMetadata?.shippingAddress || null;

	useEffect(() => {
		if (!open) {
			setInvoiceDownloading(false);
			setShipments([]);
			setLoadingShipments(false);
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
			setEditShipmentForm(emptyEditShipmentForm);
			setSavingShipment(false);
			setEditingShipmentID("");
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
	}, [displayOrder?.id, displayOrder?.metadata, displayOrder?.extra_charges]);

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

	const orderItems = displayOrder?.order_items || [];
	const payments = displayOrder?.payments || [];

	return (
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
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(displayOrder.status)}`}>{displayOrder.status}</span>
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(displayOrder.payment_status)}`}>{displayOrder.payment_status}</span>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
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
							<div className="mt-3 space-y-3">
								{payments.length === 0 ? <p className="text-sm text-slate-500">No payments found.</p> : null}
								{payments.map((payment) => (
									<div key={payment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
										<div className="flex items-center justify-between gap-3">
											<p className="font-medium text-slate-900">{payment.provider_key || payment.payment_method || payment.id}</p>
											<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusBadge(payment.status)}`}>{payment.status}</span>
										</div>
										<p className="mt-1 text-xs text-slate-500">{money(payment.currency, payment.amount)} · {payment.external_reference || payment.provider_transaction_id || "-"}</p>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<h4 className="text-sm font-semibold text-slate-900">Shipping Address</h4>
							<p className="mt-1 text-xs text-slate-500">Jika alamat perlu diubah, isi `address_id` customer di bawah.</p>
							<div className="mt-3 space-y-3">
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
									<div className="font-medium text-slate-900">{shippingAddress?.receiver_name || shippingAddress?.name || shippingAddress?.address_summary || shippingAddress?.address_line_1 || "-"}</div>
									<div className="mt-1 text-xs text-slate-500">{shippingAddress?.address_line_1 || shippingAddress?.address_summary || "-"}</div>
								</div>
								<label className="block text-sm">
									<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Address ID</span>
									<input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingAddressForm.address_id} onChange={(e) => setShippingAddressForm({ address_id: e.target.value })} placeholder="UUID alamat customer" />
								</label>
								<div className="flex justify-end">
									<button type="button" onClick={() => void handleSaveShippingAddress()} disabled={savingShippingAddress} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
										{savingShippingAddress ? "Saving..." : "Update Address"}
									</button>
								</div>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Shipping Quote</h4>
								<p className="text-xs text-slate-500">Update ongkir, carrier, dan resi untuk order ini.</p>
							</div>
							<button type="button" onClick={() => void handleSaveShippingQuote()} disabled={savingShippingQuote} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
								{savingShippingQuote ? "Saving..." : "Save Quote"}
							</button>
						</div>
						<div className="mt-4 grid gap-3 md:grid-cols-2">
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping Amount</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.shipping_amount} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} /></label>
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.carrier_name} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, carrier_name: e.target.value }))} /></label>
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.service_name} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, service_name: e.target.value }))} /></label>
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking Number</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.tracking_number} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, tracking_number: e.target.value }))} /></label>
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Delivery</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.estimated_delivery} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} /></label>
							<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.notes} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
							<label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2" value={shippingQuoteForm.description} onChange={(e) => setShippingQuoteForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
						</div>
					</section>

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

					<section className="rounded-2xl border border-slate-200 bg-white p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h4 className="text-sm font-semibold text-slate-900">Shipments</h4>
								<p className="text-xs text-slate-500">Create, update, and delete shipment untuk order ini.</p>
							</div>
							{loadingShippableItems ? <span className="text-xs text-slate-500">Loading shippable items...</span> : null}
						</div>
						<div className="mt-4 space-y-3">
							{shipments.length === 0 ? <p className="text-sm text-slate-500">No shipments found.</p> : null}
							{shipments.map((shipment) => (
								<div key={shipment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className="font-medium text-slate-900">{shipment.carrier_name || "Shipment"}</p>
											<p className="text-xs text-slate-500">{shipment.service_name || "-"} · {shipment.tracking_number || "-"}</p>
											<div className="mt-2 flex flex-wrap gap-2">
												<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${shipmentStatusBadge(shipment.status)}`}>{shipment.status}</span>
												<span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">{money(displayOrder.currency, shipment.shipping_amount || 0)}</span>
											</div>
										</div>
										<div className="flex gap-2">
											<button type="button" onClick={() => handleStartEditShipment(shipment)} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">Edit</button>
											<button type="button" onClick={() => void handleDeleteShipment(shipment.id)} className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-200">Delete</button>
										</div>
									</div>
									{shipment.items?.length ? <div className="mt-2 text-xs text-slate-500">{shipment.items.length} item(s)</div> : null}
								</div>
							))}
						</div>

						<div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
							<h5 className="text-sm font-semibold text-slate-900">Create Shipment</h5>
							<div className="mt-3 grid gap-3 md:grid-cols-2">
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.carrier_name} onChange={(e) => setShipmentForm((prev) => ({ ...prev, carrier_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.service_name} onChange={(e) => setShipmentForm((prev) => ({ ...prev, service_name: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.tracking_number} onChange={(e) => setShipmentForm((prev) => ({ ...prev, tracking_number: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping Amount</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.shipping_amount} onChange={(e) => setShipmentForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Delivery</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.estimated_delivery} onChange={(e) => setShipmentForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} /></label>
								<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.notes} onChange={(e) => setShipmentForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
								<label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" value={shipmentForm.description} onChange={(e) => setShipmentForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
							</div>
							<div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
								{shippableItems.map((item) => (
									<label key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
										<input type="checkbox" checked={Boolean(shipmentForm.item_ids[item.id])} onChange={(e) => setShipmentForm((prev) => ({ ...prev, item_ids: { ...prev.item_ids, [item.id]: e.target.checked } }))} />
										<span>{item.product_name || item.id}</span>
									</label>
								))}
								{shippableItems.length === 0 ? <p className="text-sm text-slate-500">No shippable items available.</p> : null}
							</div>
							<div className="mt-4 flex justify-end">
								<button type="button" onClick={() => void handleCreateShipment()} disabled={creatingShipment} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
									{creatingShipment ? "Creating..." : "Create Shipment"}
								</button>
							</div>
						</div>

						{editingShipmentID ? (
							<div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
								<h5 className="text-sm font-semibold text-slate-900">Edit Shipment</h5>
								<div className="mt-3 grid gap-3 md:grid-cols-2">
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.status} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, status: e.target.value as EditShipmentForm["status"] }))}><option value="pending">pending</option><option value="processing">processing</option><option value="shipped">shipped</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Carrier</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.carrier_name} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, carrier_name: e.target.value }))} /></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.service_name} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, service_name: e.target.value }))} /></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.tracking_number} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, tracking_number: e.target.value }))} /></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping Amount</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.shipping_amount} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, shipping_amount: e.target.value }))} /></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Delivery</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.estimated_delivery} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, estimated_delivery: e.target.value }))} /></label>
									<label className="text-sm"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.notes} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
									<label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span><textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" value={editShipmentForm.description} onChange={(e) => setEditShipmentForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
								</div>
								<div className="mt-4 flex justify-end gap-2">
									<button type="button" onClick={() => { setEditingShipmentID(""); setEditShipmentForm(emptyEditShipmentForm); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
									<button type="button" onClick={() => void handleSaveShipment()} disabled={savingShipment} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingShipment ? "Saving..." : "Save Shipment"}</button>
								</div>
							</div>
						) : null}
					</section>
				</div>
			) : null}
		</MemberModal>
	);
}