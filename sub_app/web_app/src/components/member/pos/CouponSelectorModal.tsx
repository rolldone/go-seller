import { useEffect, useState } from "react";

import { formatAmount } from "../../../lib/amountFormat";
import MemberModal from "../ui/MemberModal";
import { listMemberBusinessCoupons } from "../business-coupons/api";
import type { Coupon } from "../../admin/coupons/types";

type Props = {
	open: boolean;
	businessID?: string | null;
	onClose: () => void;
	onSelect: (coupon: Coupon) => void;
	pageSize?: number;
};

export default function CouponSelectorModal({ open, businessID, onClose, onSelect, pageSize = 200 }: Props) {
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(1);
	const [items, setItems] = useState<Coupon[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	useEffect(() => {
		if (!open) return;
		setPage(1);
	}, [open, query]);

	useEffect(() => {
		if (!open) return;
		setItems([]);
		setTotal(0);
		setError(null);
		if (!businessID) {
			setError("Pilih business dulu");
			return;
		}
		setLoading(true);
		listMemberBusinessCoupons(businessID, { q: query.trim(), business_id: businessID, is_active: "true", page, limit: pageSize })
			.then((res) => {
				setItems(res.data || []);
				setTotal(res.total || 0);
			})
			.catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat coupon"))
			.finally(() => setLoading(false));
	}, [businessID, open, page, pageSize, query]);

	return (
		<MemberModal open={open} onClose={onClose} title="Select Voucher" maxWidth="2xl">
			<div className="space-y-3">
				<div className="grid gap-2 md:grid-cols-[2fr,160px]">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search code or name"
						className="rounded border border-slate-300 px-3 py-2 text-sm"
					/>
					<div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
						{businessID ? businessID : "No business"}
					</div>
				</div>

				{loading ? (
					<div className="text-sm text-slate-500">Loading vouchers...</div>
				) : error ? (
					<div className="text-sm text-rose-600">{error}</div>
				) : items.length === 0 ? (
					<div className="text-sm text-slate-500">Tidak ada voucher aktif untuk business ini.</div>
				) : (
					<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Code</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Name</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Value</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Period</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{items.map((coupon) => (
									<tr key={coupon.id}>
										<td className="px-3 py-2 font-mono text-xs text-slate-600">{coupon.code}</td>
										<td className="px-3 py-2 text-slate-800">
											<div className="font-medium">{coupon.name}</div>
											<div className="text-xs text-slate-500 capitalize">{coupon.discount_type}</div>
										</td>
										<td className="px-3 py-2 text-slate-700 capitalize">{coupon.category.replace(/_/g, " ")}</td>
										<td className="px-3 py-2 text-right text-slate-700">
											{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatAmount(coupon.discount_value, { fractionDigits: 0 })}
										</td>
										<td className="px-3 py-2 text-xs text-slate-500">
											<div>{new Date(coupon.start_at).toLocaleDateString()}</div>
											<div>s/d {coupon.end_at ? new Date(coupon.end_at).toLocaleDateString() : "-"}</div>
										</td>
										<td className="px-3 py-2 text-right">
											<button
												type="button"
												onClick={() => onSelect(coupon)}
												className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
											>
												Use
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<div className="flex items-center justify-between text-sm text-slate-500">
					<span>{total} vouchers</span>
					<div className="flex items-center gap-2">
						<button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
							Prev
						</button>
						<span>Page {page}</span>
						<button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
							Next
						</button>
					</div>
				</div>
			</div>
		</MemberModal>
	);
}