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
					<div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
				))}
			</div>
		);
	}

	if (mutations.length === 0) {
		return (
			<div className="text-center py-12 text-gray-400">
				<p className="text-lg">Belum ada transaksi</p>
				<p className="text-sm mt-1">Transaksi akan muncul setelah ada order yang selesai</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="text-sm text-gray-500 mb-3">
				{total} transaksi ditemukan
			</div>

			<div className="divide-y divide-gray-50">
				{mutations.map((m) => (
					<div key={m.id} className="flex items-center justify-between py-3">
						<div className="flex items-center gap-3">
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
									m.mutation_type === "credit"
										? "bg-green-100 text-green-600"
										: "bg-red-100 text-red-600"
								}`}
							>
								{m.mutation_type === "credit" ? "+" : "−"}
							</div>
							<div>
								<p className="text-sm font-medium text-gray-800">
									{SOURCE_LABELS[m.source] ?? m.source}
								</p>
								{m.description && (
									<p className="text-xs text-gray-400 truncate max-w-xs">{m.description}</p>
								)}
								<p className="text-xs text-gray-400">
									{new Date(m.created_at).toLocaleString("id-ID")}
								</p>
							</div>
						</div>
						<div className="text-right flex-shrink-0 ml-4">
							<p
								className={`text-sm font-semibold ${
									m.mutation_type === "credit" ? "text-green-600" : "text-red-600"
								}`}
							>
								{m.mutation_type === "credit" ? "+" : "−"}
								{formatCents(m.amount)}
							</p>
							<p className="text-xs text-gray-400">Saldo: {formatCents(m.balance_after)}</p>
						</div>
					</div>
				))}
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
					<span className="text-sm text-gray-500">
						Halaman {page} / {totalPages}
					</span>
					<button
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
					>
						Berikutnya →
					</button>
				</div>
			)}
		</div>
	);
}
