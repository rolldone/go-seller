import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { listSellerMutations } from "./api";
import type { SellerBalanceMutation } from "./types";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

const SOURCE_LABELS: Record<string, string> = {
	order: "Pembayaran Order",
	withdraw: "Penarikan Dana",
	fee: "Biaya",
	admin_adjust: "Penyesuaian Admin",
};

interface Props {
	businessID: string;
	refreshKey?: number;
}

export default function MutationHistory({ businessID, refreshKey }: Props) {
	const [mutations, setMutations] = useState<SellerBalanceMutation[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const limit = 20;

	useEffect(() => {
		setLoading(true);
		listSellerMutations(businessID, page, limit)
			.then((res) => {
				setMutations(res.data ?? []);
				setTotal(res.total ?? 0);
			})
			.catch((err) => notifyError(err?.message || "Gagal memuat riwayat"))
			.finally(() => setLoading(false));
	}, [businessID, page, refreshKey]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	if (loading) {
		return (
			<div className="space-y-2">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
				))}
			</div>
		);
	}

	if (mutations.length === 0) {
		return (
			<div className="rounded-[24px] border border-dashed border-[#e0d6c6] bg-[#fcfbf8] px-6 py-12 text-center text-slate-500">
				<p className="text-lg font-medium text-slate-700">Belum ada transaksi</p>
				<p className="mt-1 text-sm">Transaksi akan muncul setelah ada order yang selesai</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="mb-3 text-sm text-slate-500">
				{total} transaksi ditemukan
			</div>

			<div className="divide-y divide-[#f0e6d6] overflow-hidden rounded-[24px] border border-[#ece3d5] bg-[#fcfbf8]">
				{mutations.map((m) => (
					<div key={m.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
						<div className="flex items-center gap-3">
							<div
								className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
									m.mutation_type === "credit"
										? "bg-emerald-100 text-emerald-700"
										: "bg-rose-100 text-rose-700"
								}`}
							>
								{m.mutation_type === "credit" ? "+" : "−"}
							</div>
							<div>
								<p className="text-sm font-medium text-slate-900">
									{SOURCE_LABELS[m.source] ?? m.source}
								</p>
								{m.description && (
									<p className="max-w-xs truncate text-xs text-slate-400">{m.description}</p>
								)}
								<p className="text-xs text-slate-400">
									{new Date(m.created_at).toLocaleString("id-ID")}
								</p>
							</div>
						</div>
						<div className="ml-4 flex-shrink-0 text-right">
							<p
								className={`text-sm font-semibold ${
									m.mutation_type === "credit" ? "text-emerald-700" : "text-rose-700"
								}`}
							>
								{m.mutation_type === "credit" ? "+" : "−"}
								{formatCents(m.amount)}
							</p>
							<p className="text-xs text-slate-400">Saldo: {formatCents(m.balance_after)}</p>
						</div>
					</div>
				))}
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
					<span className="text-sm text-slate-500">
						Halaman {page} / {totalPages}
					</span>
					<button
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400"
					>
						Berikutnya →
					</button>
				</div>
			)}
		</div>
	);
}
