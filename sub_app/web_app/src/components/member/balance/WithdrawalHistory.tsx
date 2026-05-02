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
	approved:  { label: "Disetujui", className: "bg-blue-100 text-blue-700" },
	rejected:  { label: "Ditolak", className: "bg-red-100 text-red-700" },
	processed: { label: "Diproses", className: "bg-green-100 text-green-700" },
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
			<div className="flex items-center justify-between">
				<select
					value={statusFilter}
					onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
					className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
						className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
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
				<div className="text-center py-12 text-gray-400">
					<p className="text-lg">Belum ada permintaan penarikan</p>
					{onRequestNew && (
						<button
							onClick={onRequestNew}
							className="mt-3 text-sm text-blue-600 hover:underline"
						>
							Buat permintaan pertama
						</button>
					)}
				</div>
			) : (
				<>
					<div className="text-sm text-gray-500">{total} permintaan</div>
					<div className="divide-y divide-gray-50">
						{withdrawals.map((w) => {
							const badge = STATUS_BADGE[w.status] ?? { label: w.status, className: "bg-gray-100 text-gray-600" };
							return (
								<div key={w.id} className="py-4">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-sm font-semibold text-gray-800">
													{formatCents(w.amount)}
												</span>
												<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
													{badge.label}
												</span>
											</div>
											<p className="text-xs text-gray-500">
												{w.bank_name} — {w.bank_account_number} a/n {w.bank_account_name}
											</p>
											<p className="text-xs text-gray-400 mt-0.5">
												{new Date(w.created_at).toLocaleString("id-ID")}
											</p>
											{w.admin_notes && (
												<p className="text-xs text-orange-600 mt-1 italic">
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
								className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
							>
								← Sebelumnya
							</button>
							<span className="text-sm text-gray-500">Halaman {page} / {totalPages}</span>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page >= totalPages}
								className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
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
