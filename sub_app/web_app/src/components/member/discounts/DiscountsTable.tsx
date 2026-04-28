import { formatAmount } from "../../../lib/amountFormat";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { Discount } from "./types";

type Props = {
	discounts: Discount[];
	loading: boolean;
	error: string | null;
	onEdit: (discount: Discount) => void;
	onDelete: (discount: Discount) => void;
};

const shortID = (value: string) => value.slice(0, 8);

const copyID = async (value: string) => {
	try {
		await navigator.clipboard.writeText(value);
		notifySuccess("ID copied");
	} catch (err) {
		notifyError(err instanceof Error ? err.message : "Gagal copy ID");
	}
};

const formatDate = (value: string | null | undefined) => {
	if (!value) return "-";
	return new Date(value).toLocaleDateString();
};

export default function DiscountsTable({ discounts, loading, error, onEdit, onDelete }: Props) {
	if (loading) return <div className="text-sm text-slate-500">Loading discounts...</div>;
	if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
	if (discounts.length === 0) return <div className="text-sm text-slate-500">Belum ada discount.</div>;

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
			<table className="min-w-full text-sm">
				<thead className="bg-slate-50 text-left text-slate-700">
					<tr>
						<th className="px-3 py-2">ID</th>
						<th className="px-3 py-2">Name</th>
						<th className="px-3 py-2">Type</th>
						<th className="px-3 py-2">Priority</th>
						<th className="px-3 py-2">Value</th>
						<th className="px-3 py-2">Period</th>
						<th className="px-3 py-2">Usage Limit</th>
						<th className="px-3 py-2">Status</th>
						<th className="px-3 py-2">Actions</th>
					</tr>
				</thead>
				<tbody>
					{discounts.map((discount) => (
						<tr key={discount.id} className="border-t border-slate-100">
							<td className="px-3 py-2">
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs text-slate-500">{shortID(discount.id)}</span>
									<button type="button" onClick={() => copyID(discount.id)} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
										Copy
									</button>
								</div>
							</td>
							<td className="px-3 py-2 text-slate-800">
								<div className="font-medium">{discount.name}</div>
								{discount.description ? <div className="text-xs text-slate-400">{discount.description}</div> : null}
							</td>
							<td className="px-3 py-2">
								<span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">{discount.discount_type}</span>
							</td>
							<td className="px-3 py-2 font-semibold text-slate-700">{discount.priority}</td>
							<td className="px-3 py-2 text-slate-700">
								{discount.discount_type === "percentage" ? `${discount.discount_value}%` : formatAmount(discount.discount_value, { fractionDigits: 0 })}
								{discount.max_discount_amount ? <div className="text-xs text-slate-400">max {formatAmount(discount.max_discount_amount, { fractionDigits: 0 })}</div> : null}
							</td>
							<td className="px-3 py-2 text-xs text-slate-700">
								<div>{formatDate(discount.start_at)}</div>
								<div className="text-slate-400">s/d {formatDate(discount.end_at)}</div>
							</td>
							<td className="px-3 py-2 text-xs text-slate-700">
								{discount.usage_limit != null ? <div>Total: {discount.usage_limit}</div> : <div className="text-xs text-slate-400">Unlimited</div>}
								{discount.usage_limit_per_user != null ? <div>Per user: {discount.usage_limit_per_user}</div> : null}
							</td>
							<td className="px-3 py-2">
								<span className={`rounded px-2 py-0.5 text-xs font-medium ${discount.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
									{discount.is_active ? "Active" : "Inactive"}
								</span>
								{discount.per_user_only ? <div className="mt-0.5 text-xs text-slate-400">Per-user</div> : null}
							</td>
							<td className="px-3 py-2">
								<div className="flex gap-2">
									<button type="button" onClick={() => onEdit(discount)} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
										Edit
									</button>
									<button type="button" onClick={() => onDelete(discount)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">
										Delete
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}