import { useEffect, useMemo, useState } from "react";

import MemberModal from "../ui/MemberModal";
import { listMemberPosCustomers, type MemberPosCustomerHistoryItem } from "./api";

function formatLastOrderDate(value?: string | null) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleString("id-ID", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

type Props = {
	open: boolean;
	businessID?: string;
	currentCustomerID?: string;
	onClose: () => void;
	onSelect: (customer: MemberPosCustomerHistoryItem) => void;
};

export default function CustomerSelectorModal({ open, businessID, currentCustomerID, onClose, onSelect }: Props) {
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(10);
	const [items, setItems] = useState<MemberPosCustomerHistoryItem[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

	useEffect(() => {
		if (!open) return;
		setPage(1);
	}, [open, query, limit]);

	useEffect(() => {
		if (!open) return;
		if (!businessID) {
			setItems([]);
			setTotal(0);
			setError("Pilih business dulu");
			return;
		}
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await listMemberPosCustomers(businessID, {
					q: query || undefined,
					page,
					limit,
				});
				setItems(res.data || []);
				setTotal(res.total || 0);
			} catch (err) {
				setItems([]);
				setTotal(0);
				setError(err instanceof Error ? err.message : "Gagal mengambil customer history");
			} finally {
				setLoading(false);
			}
		};
		void run();
	}, [open, businessID, query, page, limit]);

	return (
		<MemberModal open={open} onClose={onClose} title="Select Customer" maxWidth="2xl">
			<div className="space-y-4">
				<div className="grid gap-2 md:grid-cols-[2fr,160px]">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search name, email, phone, or customer ID"
						className="rounded border border-slate-300 px-3 py-2 text-sm"
					/>
					<select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded border border-slate-300 px-3 py-2 text-sm">
						<option value={10}>10 / page</option>
						<option value={20}>20 / page</option>
						<option value={50}>50 / page</option>
					</select>
				</div>

				<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
					{loading ? (
						<div className="p-4 text-sm text-slate-500">Loading customer history...</div>
					) : error ? (
						<div className="p-4 text-sm text-rose-600">{error}</div>
					) : items.length === 0 ? (
						<div className="p-4 text-sm text-slate-500">Tidak ada customer dengan riwayat order untuk business ini.</div>
					) : (
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Customer</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Contact</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Orders</th>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Last Order</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{items.map((item) => {
									const selected = currentCustomerID === item.id;
									return (
										<tr key={item.id} className={selected ? "bg-emerald-50" : undefined}>
											<td className="px-3 py-2 text-slate-800">
												<div className="font-medium">{item.name || "-"}</div>
												<div className="text-xs text-slate-500">ID: {item.id}</div>
											</td>
											<td className="px-3 py-2 text-slate-700">
												<div>{item.email || "-"}</div>
												<div className="text-xs text-slate-500">{item.phone || "-"}</div>
											</td>
											<td className="px-3 py-2 text-right font-medium text-slate-700">{item.order_count}</td>
											<td className="px-3 py-2 text-slate-700">{formatLastOrderDate(item.last_order_at)}</td>
											<td className="px-3 py-2 text-right">
												<button
													type="button"
													onClick={() => onSelect(item)}
													className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
												>
													{selected ? "Selected" : "Choose"}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</div>

				<div className="flex items-center justify-between text-sm text-slate-500">
					<span>{total} customers</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
						>
							Prev
						</button>
						<span>
							Page {page} / {totalPages}
						</span>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</MemberModal>
	);
}
