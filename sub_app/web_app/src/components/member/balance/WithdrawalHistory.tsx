import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { listSellerWithdrawals } from "./api";
import type { SellerWithdrawal } from "./types";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
	pending:   { label: "Menunggu", className: "bg-yellow-100 text-yellow-700" },
	approved:  { label: "Disetujui", className: "bg-emerald-100 text-emerald-700" },
	rejected:  { label: "Ditolak", className: "bg-rose-100 text-rose-700" },
	processed: { label: "Diproses", className: "bg-emerald-100 text-emerald-700" },
};

interface Props {
	businessID: string;
	refreshKey?: number;
	onRequestNew?: () => void;
}

export default function WithdrawalHistory({ businessID, refreshKey, onRequestNew }: Props) {
	const [withdrawals, setWithdrawals] = useState<SellerWithdrawal[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("");
	const limit = 20;

	useEffect(() => {
		setLoading(true);
		listSellerWithdrawals(businessID, statusFilter, page, limit)
			.then((res) => {
				setWithdrawals(res.data ?? []);
				setTotal(res.total ?? 0);
			})
			.catch((err) => notifyError(err?.message || "Gagal memuat penarikan"))
			.finally(() => setLoading(false));
	}, [businessID, statusFilter, page, refreshKey]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<select
					value={statusFilter}
					onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
					className="rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
				>
					<option value="">Semua Status</option>
					<option value="pending">Menunggu</option>
					<option value="approved">Disetujui</option>
					<option value="rejected">Ditolak</option>
					<option value="processed">Diproses</option>
				</select>

				{onRequestNew && (
					<button
						onClick={onRequestNew}
						className="rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
					>
						+ Tarik Dana
					</button>
				)}
			</div>

			{loading ? (
				<div className="space-y-2">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
					))}
				</div>
			) : withdrawals.length === 0 ? (
				<div className="rounded-[24px] border border-dashed border-[#e0d6c6] bg-[#fcfbf8] px-6 py-12 text-center text-slate-500">
					<p className="text-lg font-medium text-slate-700">Belum ada permintaan penarikan</p>
					{onRequestNew && (
						<button
							onClick={onRequestNew}
							className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
						>
							Buat permintaan pertama
						</button>
					)}
				</div>
			) : (
				<>
					<div className="text-sm text-slate-500">{total} permintaan</div>
					<div className="divide-y divide-[#f0e6d6] overflow-hidden rounded-[24px] border border-[#ece3d5] bg-[#fcfbf8]">
						{withdrawals.map((w) => {
							const badge = STATUS_BADGE[w.status] ?? { label: w.status, className: "bg-gray-100 text-gray-600" };
							return (
								<div key={w.id} className="px-4 py-4 sm:px-5">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-sm font-semibold text-slate-900">
													{formatCents(w.amount)}
												</span>
												<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
													{badge.label}
												</span>
											</div>
											<p className="text-xs text-slate-500">
												{w.bank_name} — {w.bank_account_number} a/n {w.bank_account_name}
											</p>
											<p className="mt-0.5 text-xs text-slate-400">
												{new Date(w.created_at).toLocaleString("id-ID")}
											</p>
											{w.admin_notes && (
												<p className="mt-1 text-xs italic text-amber-700">
													Catatan admin: {w.admin_notes}
												</p>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-between pt-4">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400"
							>
								← Sebelumnya
							</button>
							<span className="text-sm text-slate-500">Halaman {page} / {totalPages}</span>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
