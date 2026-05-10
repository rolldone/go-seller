import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";
import {
	createMemberOrderShipment,
	deleteMemberOrderShipment,
	getMemberOrderByID,
	listMemberOrderShipments,
	listMemberShippableItems,
	type ShipmentStatus,
	updateMemberOrderShipment,
} from "./api";
import type { Order, OrderItem, OrderShipment } from "./types";

const money = (currency: string, amount: number) => `${currency || "IDR"} ${formatAmount(amount || 0, { fractionDigits: 0 })}`;

const fmt = (value?: string | null) => {
	if (!value) return "-";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString("id-ID");
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
		return null;
	}
	return null;
};

type BadgeVariant = "gray" | "amber" | "green" | "red" | "blue" | "indigo" | "orange" | "purple";

const BADGE_CLASSES: Record<BadgeVariant, string> = {
	gray: "bg-slate-100 text-slate-700",
	amber: "bg-amber-100 text-amber-800",
	green: "bg-emerald-100 text-emerald-800",
	red: "bg-red-100 text-red-700",
	blue: "bg-sky-100 text-sky-800",
	indigo: "bg-indigo-100 text-indigo-800",
	orange: "bg-orange-100 text-orange-800",
	purple: "bg-purple-100 text-purple-800",
};

function badge(label: string, variant: BadgeVariant) {
	return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASSES[variant]}`}>{label}</span>;
}

function paymentStatusBadge(status: string) {
	const value = String(status || "").toLowerCase();
	if (value === "paid") return badge("Lunas", "green");
	if (value === "pending" || value === "unpaid") return badge("Belum Bayar", "amber");
	if (value === "expired") return badge("Kedaluwarsa", "red");
	if (value === "cancelled" || value === "canceled") return badge("Dibatalkan", "gray");
	if (value === "refunded") return badge("Direfund", "purple");
	if (value === "failed") return badge("Gagal", "red");
	return badge(value || "-", "amber");
}

function orderStatusBadge(status: string) {
	const value = String(status || "").toLowerCase();
	if (value === "completed") return badge("Selesai", "green");
	if (value === "processing") return badge("Diproses", "blue");
	if (value === "shipped") return badge("Dikirim", "indigo");
	if (value === "waiting_customer_confirmation") return badge("Menunggu Konfirmasi", "orange");
	if (value === "in_dispute") return badge("Dispute", "red");
	if (value === "refunded") return badge("Direfund", "purple");
	if (value === "cancelled" || value === "canceled") return badge("Dibatalkan", "gray");
	if (value === "awaiting_quote") return badge("Menunggu Ongkir", "amber");
	if (value === "quote_ready") return badge("Ongkir Siap", "amber");
	if (value === "draft") return badge("Draft", "gray");
	return badge(value || "-", "amber");
}

function deliveryStatusBadge(status: string) {
	const value = String(status || "").toLowerCase();
	if (value === "not_applicable") return badge("Tidak Berlaku", "gray");
	if (value === "pending") return badge("Belum Dikirim", "amber");
	if (value === "ready_to_ship") return badge("Siap Kirim", "blue");
	if (value === "partially_shipped") return badge("Sebagian Dikirim", "indigo");
	if (value === "shipped") return badge("Dalam Pengiriman", "indigo");
	if (value === "delivered") return badge("Terkirim", "green");
	if (value === "exception") return badge("Ada Masalah", "red");
	if (value === "returned") return badge("Dikembalikan", "orange");
	if (value === "cancelled" || value === "canceled") return badge("Dibatalkan", "gray");
	return badge(value || "-", "gray");
}

function shipmentStatusBadge(status: string) {
	const value = String(status || "").toLowerCase();
	if (value === "delivered") return badge("Terkirim", "green");
	if (value === "shipped" || value === "in_transit") return badge("Dikirim", "indigo");
	if (value === "ready_to_ship") return badge("Siap Kirim", "blue");
	if (value === "pending") return badge("Belum Aktif", "amber");
	if (value === "exception") return badge("Masalah", "red");
	if (value === "returned") return badge("Dikembalikan", "orange");
	if (value === "cancelled" || value === "canceled") return badge("Dibatalkan", "gray");
	return badge(value || "-", "gray");
}

type ShipmentForm = {
	carrier_name: string;
	service_name: string;
	tracking_number: string;
	shipping_amount: string;
	estimated_delivery: string;
	description: string;
	notes: string;
};

const defaultShipmentForm: ShipmentForm = {
	carrier_name: "",
	service_name: "",
	tracking_number: "",
	shipping_amount: "0",
	estimated_delivery: "",
	description: "",
	notes: "",
};

type EditShipmentForm = ShipmentForm & {
	shipment_id: string;
	status: "pending" | "processing" | "ready_to_ship" | "shipped" | "in_transit" | "delivered" | "exception" | "returned" | "cancelled";
};

const defaultEditShipmentForm: EditShipmentForm = {
	shipment_id: "",
	status: "pending",
	...defaultShipmentForm,
};

const makeTempID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function OrderDeliveryPage() {
	const [initialized, setInitialized] = useState(false);
	const [businessID, setBusinessID] = useState("");
	const [orderID, setOrderID] = useState("");
	const [order, setOrder] = useState<Order | null>(null);
	const [shipments, setShipments] = useState<OrderShipment[]>([]);
	const [shippableItems, setShippableItems] = useState<OrderItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [addOpen, setAddOpen] = useState(false);
	const [addForm, setAddForm] = useState<ShipmentForm>(defaultShipmentForm);
	const [selectedItemIDs, setSelectedItemIDs] = useState<Record<string, boolean>>({});
	const [creatingShipment, setCreatingShipment] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editForm, setEditForm] = useState<EditShipmentForm>(defaultEditShipmentForm);
	const [savingShipment, setSavingShipment] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const parts = window.location.pathname.split("/").filter(Boolean);
		const ordersIndex = parts.findIndex((part) => part === "orders");
		const nextOrderID = ordersIndex >= 0 ? parts[ordersIndex + 1] : "";
		const params = new URLSearchParams(window.location.search);
		setOrderID(nextOrderID && nextOrderID !== "delivery" ? nextOrderID : "");
		setBusinessID(params.get("business_id")?.trim() || "");
		setInitialized(true);
	}, []);

	const backHref = businessID ? `/member/orders?business_id=${encodeURIComponent(businessID)}` : "/member/orders";

	useEffect(() => {
		if (!initialized) return;
		if (!orderID || !businessID) {
			setLoading(false);
			setError(!orderID ? "Order tidak ditemukan" : "business_id wajib diisi");
			return;
		}

		let active = true;
		setLoading(true);
		setError(null);

		void (async () => {
			try {
				const [orderRes, shipmentsRes] = await Promise.all([
					getMemberOrderByID(businessID, orderID),
					listMemberOrderShipments(businessID, orderID),
				]);
				if (!active) return;
				setOrder({ ...orderRes.data.order, payments: orderRes.data.payments || orderRes.data.order.payments || [] });
				setShipments(shipmentsRes.data || []);
				try {
					const itemRes = await listMemberShippableItems(businessID, orderID);
					if (active) setShippableItems(itemRes.data || []);
				} catch {
					if (active) setShippableItems([]);
				}
			} catch (err) {
				if (active) setError(err instanceof Error ? err.message : "Gagal memuat data order");
			} finally {
				if (active) setLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, [businessID, initialized, orderID]);

	const refreshAll = async () => {
		if (!orderID || !businessID) return;
		try {
			const [orderRes, shipmentsRes] = await Promise.all([
				getMemberOrderByID(businessID, orderID),
				listMemberOrderShipments(businessID, orderID),
			]);
			setOrder({ ...orderRes.data.order, payments: orderRes.data.payments || orderRes.data.order.payments || [] });
			setShipments(shipmentsRes.data || []);
			try {
				const itemRes = await listMemberShippableItems(businessID, orderID);
				setShippableItems(itemRes.data || []);
			} catch {
				setShippableItems([]);
			}
		} catch {
			// keep current state if refresh fails
		}
	};

	const buildAddFormFromQuote = (): ShipmentForm => {
		const metadata = parseOrderMetadata(order?.metadata);
		const shippingQuote = (metadata?.shipping_quote || metadata?.shippingQuote || null) as Record<string, any> | null;
		if (!shippingQuote) return defaultShipmentForm;

		return {
			carrier_name: String(shippingQuote.carrier_name || ""),
			service_name: String(shippingQuote.service_name || ""),
			tracking_number: "",
			shipping_amount: shippingQuote.shipping_amount != null ? String(shippingQuote.shipping_amount) : "0",
			estimated_delivery: String(shippingQuote.estimated_delivery || ""),
			description: String(shippingQuote.description || ""),
			notes: String(shippingQuote.notes || ""),
		};
	};

	const openAdd = () => {
		setAddForm(buildAddFormFromQuote());
		setSelectedItemIDs(Object.fromEntries(shippableItems.map((item) => [item.id, false])));
		setAddOpen(true);
	};

	const handleAddShipment = async () => {
		if (!order?.id || !businessID) return;
		const itemIDs = Object.entries(selectedItemIDs).filter(([, selected]) => selected).map(([itemID]) => itemID);
		if (itemIDs.length === 0) {
			notifyError("Pilih minimal 1 item shipment");
			return;
		}
		const shippingAmount = Number(addForm.shipping_amount || "0");
		if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
			notifyError("Biaya kirim harus angka >= 0");
			return;
		}

		setCreatingShipment(true);
		try {
			await createMemberOrderShipment(businessID, order.id, {
				carrier_name: addForm.carrier_name.trim(),
				service_name: addForm.service_name.trim(),
				tracking_number: addForm.tracking_number.trim(),
				shipping_amount: shippingAmount,
				estimated_delivery: addForm.estimated_delivery.trim(),
				description: addForm.description.trim(),
				notes: addForm.notes.trim(),
				item_ids: itemIDs,
			});
			notifySuccess("Shipment berhasil dibuat");
			setAddOpen(false);
			await refreshAll();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal membuat shipment");
		} finally {
			setCreatingShipment(false);
		}
	};

	const openEdit = (shipment: OrderShipment) => {
		setEditForm({
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
		setEditOpen(true);
	};

	const handleSaveEdit = async () => {
		if (!order?.id || !businessID || !editForm.shipment_id) return;
		const shippingAmount = Number(editForm.shipping_amount || "0");
		if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
			notifyError("Biaya kirim shipment harus angka >= 0");
			return;
		}

		setSavingShipment(true);
		try {
			await updateMemberOrderShipment(businessID, order.id, editForm.shipment_id, {
				status: editForm.status as ShipmentStatus,
				carrier_name: editForm.carrier_name.trim(),
				service_name: editForm.service_name.trim(),
				tracking_number: editForm.tracking_number.trim(),
				shipping_amount: shippingAmount,
				estimated_delivery: editForm.estimated_delivery.trim(),
				description: editForm.description.trim(),
				notes: editForm.notes.trim(),
			});
			notifySuccess("Shipment diperbarui");
			setEditOpen(false);
			setEditForm(defaultEditShipmentForm);
			await refreshAll();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memperbarui shipment");
		} finally {
			setSavingShipment(false);
		}
	};

	const handleDeleteShipment = async (shipmentID: string) => {
		if (!order?.id || !businessID) return;
		if (typeof window !== "undefined" && !window.confirm("Hapus shipment ini?")) return;
		try {
			await deleteMemberOrderShipment(businessID, order.id, shipmentID);
			notifySuccess("Shipment deleted");
			await refreshAll();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus shipment");
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-64 items-center justify-center">
				<p className="text-sm text-slate-500">Memuat data pengiriman...</p>
			</div>
		);
	}

	if (error || !order) {
		return (
			<div className="flex min-h-64 flex-col items-center justify-center gap-2">
				<p className="text-sm text-red-600">{error ?? "Order tidak ditemukan"}</p>
				<a href={backHref} className="text-sm text-sky-600 underline">
					← Kembali ke daftar order
				</a>
			</div>
		);
	}

	const activeShipments = shipments.filter((shipment) => !["cancelled", "canceled"].includes(String(shipment.status || "").toLowerCase()));
	const cancelledShipments = shipments.filter((shipment) => ["cancelled", "canceled"].includes(String(shipment.status || "").toLowerCase()));
	const shipmentStatuses: EditShipmentForm["status"][] = ["pending", "processing", "ready_to_ship", "shipped", "in_transit", "delivered", "exception", "returned", "cancelled"];

	return (
		<div className="mx-auto max-w-3xl px-4 py-6">
			<a href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-sky-600 hover:underline">
				← Kembali ke Orders
			</a>

			<div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-3 flex items-start justify-between gap-2">
					<div>
						<h1 className="text-lg font-bold text-slate-800">#{order.order_number}</h1>
						<p className="mt-0.5 text-sm text-slate-500">Business: {businessID}</p>
						{order.customer && (
							<p className="mt-1 text-sm text-slate-500">
								{order.customer.name || order.customer.id || order.customer_id || "-"} {order.customer.email ? `(${order.customer.email})` : ""}
							</p>
						)}
					</div>
					<span className="text-sm font-semibold text-slate-700">{money(order.currency, order.grand_total)}</span>
				</div>

				<div className="flex flex-wrap gap-3">
					<div className="flex flex-col gap-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</span>
						{paymentStatusBadge(order.payment_status)}
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order</span>
						{orderStatusBadge(order.status)}
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery</span>
						{deliveryStatusBadge(order.delivery_status || "pending")}
					</div>
				</div>
			</div>

			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-base font-semibold text-slate-800">Pengiriman ({activeShipments.length})</h2>
				<button type="button" onClick={openAdd} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
					+ Tambah Shipment
				</button>
			</div>

			{activeShipments.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
					<p className="text-sm text-slate-500">Belum ada shipment aktif.</p>
				</div>
			) : null}

			<div className="flex flex-col gap-3">
				{activeShipments.map((shipment) => (
					<div key={shipment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<div className="mb-2 flex items-center justify-between gap-2">
							<div className="flex flex-wrap items-center gap-2">
								{shipmentStatusBadge(shipment.status)}
								{shipment.carrier_name ? <span className="text-xs font-medium text-slate-600">{shipment.carrier_name}</span> : null}
								{shipment.service_name ? <span className="text-xs text-slate-500">{shipment.service_name}</span> : null}
							</div>
							<div className="flex items-center gap-2">
								<button type="button" onClick={() => openEdit(shipment)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
									Edit
								</button>
								<button type="button" onClick={() => void handleDeleteShipment(shipment.id)} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50">
									Delete
								</button>
							</div>
						</div>
						{shipment.tracking_number ? <p className="mb-1 text-sm font-mono font-semibold text-slate-800">Resi: {shipment.tracking_number}</p> : null}
						{shipment.estimated_delivery ? <p className="text-xs text-slate-500">Estimasi: {shipment.estimated_delivery}</p> : null}
						{shipment.description ? <p className="mt-1 text-xs text-slate-500">{shipment.description}</p> : null}
						<div className="mt-2 flex gap-4 text-xs text-slate-400">
							{shipment.shipped_at ? <span>Dikirim: {fmt(shipment.shipped_at)}</span> : null}
							{shipment.delivered_at ? <span>Tiba: {fmt(shipment.delivered_at)}</span> : null}
						</div>
						{(shipment.items?.length ?? 0) > 0 ? <p className="mt-2 text-xs text-slate-400">{shipment.items!.length} item terlampir</p> : null}
					</div>
				))}
			</div>

			{cancelledShipments.length > 0 ? (
				<details className="mt-4">
					<summary className="cursor-pointer text-sm text-slate-400">{cancelledShipments.length} shipment dibatalkan</summary>
					<div className="mt-2 flex flex-col gap-2 opacity-60">
						{cancelledShipments.map((shipment) => (
							<div key={shipment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<div className="mb-2 flex items-center justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2">
										{shipmentStatusBadge(shipment.status)}
										{shipment.carrier_name ? <span className="text-xs font-medium text-slate-600">{shipment.carrier_name}</span> : null}
										{shipment.service_name ? <span className="text-xs text-slate-500">{shipment.service_name}</span> : null}
									</div>
									<button type="button" onClick={() => openEdit(shipment)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
										Edit
									</button>
								</div>
								{shipment.tracking_number ? <p className="mb-1 text-sm font-mono font-semibold text-slate-800">Resi: {shipment.tracking_number}</p> : null}
								{shipment.estimated_delivery ? <p className="text-xs text-slate-500">Estimasi: {shipment.estimated_delivery}</p> : null}
								{shipment.description ? <p className="mt-1 text-xs text-slate-500">{shipment.description}</p> : null}
								<div className="mt-2 flex gap-4 text-xs text-slate-400">
									{shipment.shipped_at ? <span>Dikirim: {fmt(shipment.shipped_at)}</span> : null}
									{shipment.delivered_at ? <span>Tiba: {fmt(shipment.delivered_at)}</span> : null}
								</div>
								{(shipment.items?.length ?? 0) > 0 ? <p className="mt-2 text-xs text-slate-400">{shipment.items!.length} item terlampir</p> : null}
							</div>
						))}
					</div>
				</details>
			) : null}

			{addOpen ? (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
					<div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
						<h3 className="mb-4 text-base font-bold text-slate-800">Tambah Shipment</h3>

						{shippableItems.length > 0 ? (
							<div className="mb-4">
								<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pilih Item</p>
								<div className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2">
									{shippableItems.map((item) => (
										<label key={item.id} className="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												checked={!!selectedItemIDs[item.id]}
												onChange={(event) => setSelectedItemIDs((prev) => ({ ...prev, [item.id]: event.target.checked }))}
											/>
											{item.product_name} (x{item.qty})
										</label>
									))}
								</div>
							</div>
						) : null}

						<div className="flex flex-col gap-3">
							{[
								["Kurir", "carrier_name"],
								["Service", "service_name"],
								["No. Resi", "tracking_number"],
								["Estimasi Tiba", "estimated_delivery"],
								["Deskripsi", "description"],
								["Catatan", "notes"],
							].map(([label, key]) => (
								<label key={key} className="text-sm">
									<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
									<input
										value={(addForm as Record<string, string>)[key]}
										onChange={(event) => setAddForm((current) => ({ ...current, [key]: event.target.value }))}
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									/>
								</label>
							))}
							<label className="text-sm">
								<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Biaya Kirim</span>
								<input
									type="number"
									min="0"
									value={addForm.shipping_amount}
									onChange={(event) => setAddForm((current) => ({ ...current, shipping_amount: event.target.value }))}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								/>
							</label>
						</div>

						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
								Batal
							</button>
							<button type="button" onClick={() => void handleAddShipment()} disabled={creatingShipment} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
								{creatingShipment ? "Menyimpan..." : "Simpan"}
							</button>
						</div>
					</div>
				</div>
			) : null}

			{editOpen ? (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
					<div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
						<h3 className="mb-4 text-base font-bold text-slate-800">Edit Shipment</h3>

						<div className="flex flex-col gap-3">
							<label className="text-sm">
								<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
								<select
									value={editForm.status}
									onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as EditShipmentForm["status"] }))}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{shipmentStatuses.map((status) => (
										<option key={status} value={status}>
											{status}
										</option>
									))}
								</select>
							</label>

							{[
								["Kurir", "carrier_name"],
								["Service", "service_name"],
								["No. Resi", "tracking_number"],
								["Estimasi Tiba", "estimated_delivery"],
								["Deskripsi", "description"],
								["Catatan", "notes"],
							].map(([label, key]) => (
								<label key={key} className="text-sm">
									<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
									<input
										value={(editForm as Record<string, string>)[key]}
										onChange={(event) => setEditForm((current) => ({ ...current, [key]: event.target.value }))}
										className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
									/>
								</label>
							))}
							<label className="text-sm">
								<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Biaya Kirim</span>
								<input
									type="number"
									min="0"
									value={editForm.shipping_amount}
									onChange={(event) => setEditForm((current) => ({ ...current, shipping_amount: event.target.value }))}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								/>
							</label>
						</div>

						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
								Batal
							</button>
							<button type="button" onClick={() => void handleSaveEdit()} disabled={savingShipment} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
								{savingShipment ? "Menyimpan..." : "Simpan"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}