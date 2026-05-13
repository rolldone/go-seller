import { formatAmount } from "../../../lib/amountFormat";
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

const badgeLabel = (status?: string | null) => normalizeOrderStatus(status) || "-";

export default function OrdersTable({ items, loading, error, onView }: Props) {
	if (loading) {
		return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading orders...</div>;
	}
	if (error) {
		return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
	}
	if (items.length === 0) {
		return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No orders found.</div>;
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
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.status)}`}>{badgeLabel(item.status)}</span>
							</td>
							<td className="px-4 py-3 text-sm">
								<span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(item.payment_status)}`}>{badgeLabel(item.payment_status)}</span>
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