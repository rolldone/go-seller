import { useEffect, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import {
	getMyCustomerWalletSummary,
	listMyCustomerWithdrawals,
	type CustomerWalletSummary,
	type CustomerWalletWithdrawal,
} from "../auth/authApi";
import CustomerWithdrawalModal from "./CustomerWithdrawalModal";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

function formatDate(value?: string | null): string {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const STATUS_META: Record<string, { label: string; className: string }> = {
	submitted: { label: "Submitted", className: "bg-amber-100 text-amber-700" },
	under_review: { label: "Under Review", className: "bg-sky-100 text-sky-700" },
	awaiting_confirmation: { label: "Awaiting", className: "bg-indigo-100 text-indigo-700" },
	approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
	paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
	rejected: { label: "Rejected", className: "bg-rose-100 text-rose-700" },
	canceled: { label: "Canceled", className: "bg-zinc-100 text-zinc-700" },
};

interface Props {
	initialRefreshKey?: number;
}

export default function CustomerWalletSection({ initialRefreshKey = 0 }: Props) {
	const [summary, setSummary] = useState<CustomerWalletSummary | null>(null);
	const [withdrawals, setWithdrawals] = useState<CustomerWalletWithdrawal[]>([]);
	const [withdrawalTotal, setWithdrawalTotal] = useState(0);
	const [summaryLoading, setSummaryLoading] = useState(true);
	const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const [showModal, setShowModal] = useState(false);
	const limit = 10;

	const loadData = async () => {
		setSummaryLoading(true);
		setWithdrawalsLoading(true);
		const [summaryResult, withdrawalsResult] = await Promise.allSettled([
			getMyCustomerWalletSummary(),
			listMyCustomerWithdrawals(statusFilter, page, limit),
		]);

		const errors: string[] = [];
		if (summaryResult.status === "fulfilled") {
			setSummary(summaryResult.value);
		} else {
			errors.push(summaryResult.reason instanceof Error ? summaryResult.reason.message : "Gagal memuat wallet");
		}
		if (withdrawalsResult.status === "fulfilled") {
			setWithdrawals(withdrawalsResult.value.data || []);
			setWithdrawalTotal(withdrawalsResult.value.total ?? 0);
		} else {
			errors.push(withdrawalsResult.reason instanceof Error ? withdrawalsResult.reason.message : "Gagal memuat histori withdrawal");
		}

		if (errors.length > 0) {
			notifyError(errors[0]);
		}

		setSummaryLoading(false);
		setWithdrawalsLoading(false);
	};

	useEffect(() => {
		void loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [statusFilter, page, initialRefreshKey]);

	const availableBalance = summary?.available_balance ?? 0;
	const pendingAmount = summary?.withdrawal_pending_amount ?? 0;
	const totalWithdrawalCount = summary?.withdrawal_total_count ?? 0;

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-[28px] border border-[#eadfcc] bg-[linear-gradient(135deg,#fff9f1_0%,#ffffff_56%,#eef8f2_100%)] p-6 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)]">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-2xl">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Wallet Customer</p>
						<h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Kelola saldo refund dan permintaan tarik dana</h2>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Saldo cash berasal dari refund atau koreksi manual. Promo credit tetap bisa dipakai belanja, tetapi tidak bisa ditarik.
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowModal(true)}
						disabled={summaryLoading || availableBalance <= 0}
						className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Tarik Dana
					</button>
				</div>

				<div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Saldo cash</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{summaryLoading ? "..." : formatCents(summary?.cash_balance ?? 0)}</p>
						<p className="mt-1 text-xs text-slate-500">Bisa dipakai checkout dan tarik dana.</p>
					</div>
					<div className="rounded-[22px] border border-slate-200 bg-white/90 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Saldo promo</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{summaryLoading ? "..." : formatCents(summary?.promo_balance ?? 0)}</p>
						<p className="mt-1 text-xs text-slate-500">Tidak bisa ditarik.</p>
					</div>
					<div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Antrean tarik dana</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{summaryLoading ? "..." : formatCents(pendingAmount)}</p>
						<p className="mt-1 text-xs text-slate-500">Permintaan yang masih diproses manual.</p>
					</div>
					<div className="rounded-[22px] border border-sky-100 bg-sky-50/80 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Total request</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{summaryLoading ? "..." : totalWithdrawalCount}</p>
						<p className="mt-1 text-xs text-slate-500">Akumulasi permintaan tarik dana.</p>
					</div>
				</div>

				<div className="mt-4 rounded-[22px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-800">
					<span className="font-semibold">Catatan:</span> penarikan diproses manual. Jika ada fee, admin akan menampilkan breakdown gross-fee-net saat review.
				</div>
			</section>

			<section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
					<div>
						<h3 className="text-base font-semibold text-slate-900">Riwayat Tarik Dana</h3>
						<p className="text-xs text-slate-500">Pantau status permintaan yang sedang diproses atau sudah selesai.</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={statusFilter}
							onChange={(event) => {
								setStatusFilter(event.target.value);
								setPage(1);
							}}
							className="rounded-2xl border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="">Semua status</option>
							<option value="submitted">Submitted</option>
							<option value="under_review">Under review</option>
							<option value="awaiting_confirmation">Awaiting confirmation</option>
							<option value="approved">Approved</option>
							<option value="paid">Paid</option>
							<option value="rejected">Rejected</option>
							<option value="canceled">Canceled</option>
						</select>
						<button
							type="button"
							onClick={() => void loadData()}
							className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
						>
							Muat ulang
						</button>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-5 py-3">Request</th>
								<th className="px-5 py-3">Bank</th>
								<th className="px-5 py-3">Amount</th>
								<th className="px-5 py-3">Status</th>
								<th className="px-5 py-3">Timeline</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 bg-white">
							{withdrawalsLoading ? (
								<tr>
									<td className="px-5 py-10 text-center text-slate-500" colSpan={5}>Memuat riwayat tarik dana...</td>
								</tr>
							) : withdrawals.length === 0 ? (
								<tr>
									<td className="px-5 py-10 text-center text-slate-500" colSpan={5}>Belum ada permintaan tarik dana.</td>
								</tr>
							) : (
								withdrawals.map((withdrawal) => {
									const meta = STATUS_META[withdrawal.status] || { label: withdrawal.status, className: "bg-slate-100 text-slate-700" };
									return (
										<tr key={withdrawal.id} className="align-top">
											<td className="px-5 py-4">
												<p className="font-semibold text-slate-900">#{withdrawal.id}</p>
												<p className="mt-1 text-xs text-slate-500">{withdrawal.notes || "-"}</p>
											</td>
											<td className="px-5 py-4">
												<p className="font-semibold text-slate-900">{withdrawal.bank_name}</p>
												<p className="mt-1 text-xs text-slate-500">{withdrawal.bank_account_number}</p>
												<p className="mt-1 text-xs text-slate-500">{withdrawal.bank_account_name}</p>
											</td>
											<td className="px-5 py-4">
												<p className="font-semibold text-slate-900">Gross {formatCents(withdrawal.requested_amount)}</p>
												<p className="mt-1 text-xs text-slate-500">Fee {formatCents(withdrawal.admin_fee + withdrawal.other_fee)}</p>
												<p className="mt-1 text-xs text-slate-500">Net {formatCents(withdrawal.net_amount)}</p>
											</td>
											<td className="px-5 py-4">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
												{withdrawal.admin_notes ? <p className="mt-2 text-xs text-slate-500">{withdrawal.admin_notes}</p> : null}
											</td>
											<td className="px-5 py-4 text-xs text-slate-500">
												<p>Dibuat: {formatDate(withdrawal.created_at)}</p>
												<p>Review: {formatDate(withdrawal.reviewed_at)}</p>
												<p>Paid: {formatDate(withdrawal.paid_at)}</p>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
					<p className="text-slate-500">Total data: {withdrawalTotal}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((current) => Math.max(1, current - 1))}
							disabled={page <= 1}
							className="rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="text-slate-500">Halaman {page}</span>
						<button
							type="button"
							onClick={() => setPage((current) => current + 1)}
							disabled={page * limit >= withdrawalTotal}
							className="rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</section>

			<CustomerWithdrawalModal
				open={showModal}
				availableBalance={availableBalance}
				onClose={() => setShowModal(false)}
				onSuccess={async () => {
					setShowModal(false);
					notifySuccess("Permintaan tarik dana berhasil dibuat");
					await loadData();
				}}
			/>
		</div>
	);
}