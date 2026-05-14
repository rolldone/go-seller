import { formatAmount } from "../../../lib/amountFormat";
import { useTranslations } from "../../../i18n";
import type { Order } from "./types";

type Props = {
	items: Order[];
	loading: boolean;
	error: string | null;
	onView: (item: Order) => void;
};

const fmt = (value?: string | null) => {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
};

const money = (currency: string, amount: number) => {
	const safeCurrency = currency || "IDR";
	return `${safeCurrency} ${formatAmount(amount || 0, { fractionDigits: 0 })}`;
};

const normalizeOrderStatus = (status?: string | null) => {
	const normalized = String(status || "").trim().toLowerCase();
	return normalized === "confirmed" ? "processing" : normalized;
};

const normalizePaymentStatus = (status?: string | null) => String(status || "").trim().toLowerCase();

const translateOrderStatus = (t: ReturnType<typeof useTranslations>, status?: string | null) => {
	const value = normalizeOrderStatus(status);
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
};

const translatePaymentStatus = (t: ReturnType<typeof useTranslations>, status?: string | null) => {
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
};

const translateDeliveryStatus = (t: ReturnType<typeof useTranslations>, status?: string | null) => {
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
};

const badgeClass = (status: string) => {
	const value = normalizeOrderStatus(status);
	if (["completed"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
	if (["paid"].includes(value)) return "bg-teal-50 text-teal-700 border-teal-200";
	if (["processing", "packed"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
	if (["shipped", "delivered"].includes(value)) return "bg-indigo-50 text-indigo-700 border-indigo-200";
	if (["waiting_customer_confirmation"].includes(value)) return "bg-sky-50 text-sky-700 border-sky-200";
	if (["in_dispute"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
	if (["refunded"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
	if (["pending", "unpaid", "awaiting_payment", "awaiting_quote"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
	if (["expired"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
	if (["failed", "cancelled", "canceled", "rejected"].includes(value)) return "bg-rose-50 text-rose-700 border-rose-200";
	return "bg-slate-50 text-slate-700 border-slate-200";
};

const deliveryBadgeMeta = (t: ReturnType<typeof useTranslations>, status?: string | null) => {
	const value = String(status || "").trim().toLowerCase();
	if (value === "delivered") return { label: translateDeliveryStatus(t, value), className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
	if (value === "shipped" || value === "in_transit") return { label: translateDeliveryStatus(t, value), className: "bg-indigo-50 text-indigo-700 border-indigo-200" };
	if (value === "partially_shipped") return { label: translateDeliveryStatus(t, value), className: "bg-indigo-50 text-indigo-700 border-indigo-200" };
	if (value === "ready_to_ship") return { label: translateDeliveryStatus(t, value), className: "bg-sky-50 text-sky-700 border-sky-200" };
	if (value === "exception") return { label: translateDeliveryStatus(t, value), className: "bg-rose-50 text-rose-700 border-rose-200" };
	if (value === "returned") return { label: translateDeliveryStatus(t, value), className: "bg-orange-50 text-orange-700 border-orange-200" };
	if (value === "not_applicable") return { label: translateDeliveryStatus(t, value), className: "bg-slate-100 text-slate-700 border-slate-200" };
	if (value === "pending") return { label: translateDeliveryStatus(t, value), className: "bg-amber-50 text-amber-700 border-amber-200" };
	if (value === "cancelled" || value === "canceled") return { label: translateDeliveryStatus(t, value), className: "bg-slate-100 text-slate-700 border-slate-200" };
	return { label: translateDeliveryStatus(t, value), className: "bg-slate-50 text-slate-700 border-slate-200" };
};

const shipmentStatusMeta = (t: ReturnType<typeof useTranslations>, status?: string | null) => {
	const value = String(status || "").trim().toLowerCase();
	if (value === "exception") return { label: t("shipmentStatus.exception", "Masalah"), className: "bg-rose-100 text-rose-700 border-rose-200" };
	if (value === "returned") return { label: t("shipmentStatus.returned", "Dikembalikan"), className: "bg-orange-100 text-orange-700 border-orange-200" };
	if (value === "delivered") return { label: t("shipmentStatus.delivered", "Terkirim"), className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
	if (value === "shipped") return { label: t("shipmentStatus.shipped", "Dikirim"), className: "bg-indigo-100 text-indigo-700 border-indigo-200" };
	if (value === "in_transit") return { label: t("shipmentStatus.inTransit", "Dalam Pengiriman"), className: "bg-indigo-100 text-indigo-700 border-indigo-200" };
	if (value === "ready_to_ship") return { label: t("shipmentStatus.readyToShip", "Siap Kirim"), className: "bg-sky-100 text-sky-700 border-sky-200" };
	if (value === "pending") return { label: t("shipmentStatus.pending", "Pending"), className: "bg-amber-100 text-amber-700 border-amber-200" };
	if (value === "cancelled" || value === "canceled") return { label: t("shipmentStatus.cancelled", "Dibatalkan"), className: "bg-slate-100 text-slate-700 border-slate-200" };
	if (value === "processing") return { label: t("shipmentStatus.processing", "Diproses"), className: "bg-sky-100 text-sky-700 border-sky-200" };
	return { label: value || "-", className: "bg-slate-100 text-slate-700 border-slate-200" };
};

const shipmentStatusPriority = (status?: string | null) => {
	switch (String(status || "").trim().toLowerCase()) {
		case "exception": return 0;
		case "returned": return 1;
		case "delivered": return 2;
		case "shipped":
		case "in_transit": return 3;
		case "ready_to_ship": return 4;
		case "pending": return 5;
		default: return 9;
	}
};

const shipmentSummary = (t: ReturnType<typeof useTranslations>, shipments?: Array<{ status?: string | null }> | null) => {
	const rows = shipments || [];
	const counts = new Map<string, number>();
	for (const shipment of rows) {
		const key = String(shipment.status || "pending").toLowerCase();
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	return Array.from(counts.entries())
		.sort((a, b) => shipmentStatusPriority(a[0]) - shipmentStatusPriority(b[0]))
		.map(([status, count]) => ({ status, count, meta: shipmentStatusMeta(t, status) }));
};

export default function OrdersTable({ items, loading, error, onView }: Props) {
	const t = useTranslations("common", typeof window === "undefined" ? "id" : window.location.pathname.startsWith("/en/") ? "en" : "id");

	if (loading) {
		return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{t("loadingOrders", "Loading orders...")}</div>;
	}
	if (error) {
		return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
	}
	if (items.length === 0) {
		return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{t("noOrders", "No orders found.")}</div>;
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
			<table className="min-w-full divide-y divide-slate-200">
				<thead className="bg-slate-50">
					<tr>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Payment</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Delivery</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Channel</th>
						<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Grand Total</th>
						<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Created</th>
						<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-200">
					{items.map((item) => (
						<tr key={item.id} className="hover:bg-slate-50">
							<td className="px-4 py-3">
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium text-slate-900">{item.order_number}</p>
								</div>
								<p className="text-xs text-slate-500">{item.id}</p>
							</td>
							<td className="px-4 py-3 text-sm text-slate-700">
								{item.customer ? (
									<div>
										<div className="font-medium">{item.customer.name || item.customer.id}</div>
										{item.customer.email ? <div className="text-xs text-slate-500">{item.customer.email}</div> : null}
									</div>
								) : (
									item.customer_id || "-"
								)}
							</td>
							<td className="px-4 py-3 text-sm">
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.status)}`}>{translateOrderStatus(t, item.status)}</span>
							</td>
							<td className="px-4 py-3 text-sm">
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.payment_status)}`}>{translatePaymentStatus(t, item.payment_status)}</span>
							</td>
							<td className="px-4 py-3 text-sm">
								{(() => {
									const delivery = deliveryBadgeMeta(t, item.delivery_status);
									const summaries = shipmentSummary(t, item.shipments);
									return (
										<div className="flex flex-col gap-1">
											<span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${delivery.className}`} title={item.delivery_status || "-"}>
												{delivery.label}
											</span>
											{summaries.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{summaries.slice(0, 3).map(({ status, count, meta }) => (
														<span key={status} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`} title={status}>
															{count} {meta.label}
														</span>
													))}
													{summaries.length > 3 ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">+{summaries.length - 3}</span> : null}
												</div>
											) : item.shipments?.length ? (
												<div className="text-[10px] text-slate-400">{item.shipments.length} {t("orderList.shipmentsUnit", "shipments")}</div>
											) : null}
										</div>
									);
								})()}
							</td>
							<td className="px-4 py-3 text-sm text-slate-700">{item.channel || "-"}</td>
							<td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{money(item.currency, item.grand_total)}</td>
							<td className="px-4 py-3 text-sm text-slate-600">{fmt(item.created_at)}</td>
							<td className="px-4 py-3 text-right">
								<button
									type="button"
									onClick={() => onView(item)}
									className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
								>
									View
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}