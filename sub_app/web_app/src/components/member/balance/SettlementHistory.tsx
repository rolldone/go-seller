import { useEffect, useState } from "react";

import { notifyError } from "../../../lib/notification";
import { listSellerSettlements } from "./api";
import type { SellerSettlement } from "./types";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

function remainingAmount(settlement: SellerSettlement): number {
	return Math.max(0, settlement.gross_amount - settlement.released_amount);
}

const STATUS_META: Record<string, { label: string; className: string }> = {
	pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
	held: { label: "Ditahan", className: "bg-slate-100 text-slate-700" },
	partially_released: { label: "Partial", className: "bg-sky-100 text-sky-700" },
	released: { label: "Cair", className: "bg-emerald-100 text-emerald-700" },
	refunded: { label: "Refunded", className: "bg-rose-100 text-rose-700" },
	reversed: { label: "Reversed", className: "bg-zinc-100 text-zinc-700" },
};

interface Props {
	businessID: string;
	refreshKey?: number;
}

export default function SettlementHistory({ businessID, refreshKey }: Props) {
	const [settlements, setSettlements] = useState<SellerSettlement[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const limit = 20;

	useEffect(() => {
		setLoading(true);
		listSellerSettlements(businessID, statusFilter, page, limit)
			.then((res) => {
				setSettlements(res.data ?? []);
				setTotal(res.total ?? 0);
			})
			.catch((err) => notifyError(err?.message || "Gagal memuat settlement"))
			.finally(() => setLoading(false));
	}, [businessID, statusFilter, page, refreshKey]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return (
		<div className="space-y-4">
			<div className="rounded-[24px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-800">
				<p className="font-semibold uppercase tracking-[0.18em] text-sky-700">Penjelasan status dana</p>
				<p className="mt-1">
					Pending = belum diputus admin. Ditahan = dana menunggu review lanjutan. Partial/Cair = sebagian atau seluruh dana sudah masuk saldo tersedia. Refund = settlement dibatalkan.
				</p>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="text-sm text-slate-500">
					{total} settlement ditemukan
				</div>
				<select
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value);
						setPage(1);
					}}
					className="rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
				>
					<option value="">Semua Status</option>
					<option value="pending">Pending</option>
					<option value="held">Ditahan</option>
					<option value="partially_released">Partial</option>
					<option value="released">Cair</option>
					<option value="refunded">Refunded</option>
					<option value="reversed">Reversed</option>
				</select>
			</div>

			{loading ? (
				<div className="space-y-2">
					{[...Array(4)].map((_, index) => (
						<div key={index} className="h-16 rounded-[24px] bg-slate-100 animate-pulse" />
					))}
				</div>
			) : settlements.length === 0 ? (
				<div className="rounded-[24px] border border-dashed border-[#e0d6c6] bg-[#fcfbf8] px-6 py-12 text-center text-slate-500">
					<p className="text-lg font-medium text-slate-700">Belum ada settlement</p>
					<p className="mt-1 text-sm">Settlement akan muncul ketika order sudah diproses atau masih menunggu keputusan admin.</p>
				</div>
			) : (
				<>
					<div className="divide-y divide-[#f0e6d6] overflow-hidden rounded-[24px] border border-[#ece3d5] bg-[#fcfbf8]">
						{settlements.map((settlement) => {
							const meta = STATUS_META[settlement.status] ?? { label: settlement.status, className: "bg-slate-100 text-slate-700" };
							const remaining = remainingAmount(settlement);
							return (
								<div key={settlement.id} className="px-4 py-4 sm:px-5">
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-sm font-semibold text-slate-900">Order {settlement.order_id}</span>
												<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
											</div>
											<p className="text-xs text-slate-500">Scope: {settlement.release_scope} · Source: {settlement.source}</p>
											{settlement.admin_note ? <p className="text-xs italic text-amber-700">Catatan admin: {settlement.admin_note}</p> : null}
										</div>
										<div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3 lg:min-w-[360px] lg:text-right">
											<div>
												<p className="text-xs uppercase tracking-wide text-slate-500">Gross</p>
												<p className="font-semibold text-slate-900">{formatCents(settlement.gross_amount)}</p>
											</div>
											<div>
												<p className="text-xs uppercase tracking-wide text-slate-500">Cair</p>
												<p className="font-semibold text-emerald-700">{formatCents(settlement.released_amount)}</p>
											</div>
											<div>
												<p className="text-xs uppercase tracking-wide text-slate-500">Sisa</p>
												<p className="font-semibold text-slate-900">{formatCents(remaining)}</p>
											</div>
										</div>
									</div>
									<div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
										<p>Dibuat: {new Date(settlement.created_at).toLocaleString("id-ID")}</p>
										<p>Diputus: {settlement.decided_at ? new Date(settlement.decided_at).toLocaleString("id-ID") : "-"}</p>
										<p>Cair: {settlement.released_at ? new Date(settlement.released_at).toLocaleString("id-ID") : "-"}</p>
									</div>
								</div>
							);
						})}
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-4">
							<button
								onClick={() => setPage((current) => Math.max(1, current - 1))}
								disabled={page <= 1}
								className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400"
							>
								← Sebelumnya
							</button>
							<span className="text-sm text-slate-500">Halaman {page} / {totalPages}</span>
							<button
								onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
								disabled={page >= totalPages}
								className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400"
							>
								Berikutnya →
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}