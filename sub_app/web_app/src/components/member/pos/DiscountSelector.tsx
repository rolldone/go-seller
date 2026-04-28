import { useEffect, useState } from "react";

import { formatAmount } from "../../../lib/amountFormat";
import MemberModal from "../ui/MemberModal";
import { listMemberBusinessDiscounts } from "../business-discounts/api";
import type { Discount } from "../discounts/types";

type Props = {
	open: boolean;
	businessID?: string | null;
	productID?: string | null;
	onClose: () => void;
	onSelect: (discount: Discount) => void;
	pageSize?: number;
};

export default function DiscountSelector({ open, businessID, productID, onClose, onSelect, pageSize = 200 }: Props) {
	const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setAvailableDiscounts([]);
		setError(null);
		if (!businessID) {
			setError("Pilih business dulu");
			return;
		}
		if (!productID) {
			setError("Product ID is required");
			return;
		}
		setLoading(true);
		listMemberBusinessDiscounts(businessID, { q: "", is_active: "true", business_id: businessID, page: 1, limit: pageSize })
			.then((res) => {
				const items = (res.data || []).filter((discount) => !discount.product_ids?.length || discount.product_ids.includes(productID));
				setAvailableDiscounts(items);
			})
			.catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat discount"))
			.finally(() => setLoading(false));
	}, [businessID, open, pageSize, productID]);

	return (
		<MemberModal open={open} onClose={onClose} title="Select Discount" maxWidth="xl">
			<div className="space-y-3">
				{businessID ? <div className="text-xs text-slate-500">Business: {businessID}</div> : null}
				{productID ? <div className="text-xs text-slate-500">Product: {productID}</div> : null}
				{loading ? (
					<div className="text-sm text-slate-500">Loading discounts...</div>
				) : error ? (
					<div className="text-sm text-rose-600">{error}</div>
				) : availableDiscounts.length === 0 ? (
					<div className="text-sm text-slate-500">Tidak ada discount aktif untuk produk ini.</div>
				) : (
					<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Name</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Type</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Priority</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Value</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{availableDiscounts.map((discount) => (
									<tr key={discount.id}>
										<td className="px-3 py-2 text-slate-800">{discount.name}</td>
										<td className="px-3 py-2 text-slate-700 capitalize">{discount.discount_type}</td>
										<td className="px-3 py-2 text-right font-medium text-slate-700">{discount.priority}</td>
										<td className="px-3 py-2 text-right text-slate-700">
											{discount.discount_type === "percentage" ? `${discount.discount_value}%` : formatAmount(discount.discount_value, { fractionDigits: 0 })}
										</td>
										<td className="px-3 py-2 text-right">
											<button
												type="button"
												onClick={() => onSelect(discount)}
												className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
											>
												Select
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</MemberModal>
	);
}
