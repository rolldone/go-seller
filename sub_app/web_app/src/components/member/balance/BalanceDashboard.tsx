import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { getSellerBalance, getSellerSettlementSummary } from "./api";
import type { SellerBalance, SellerSettlementSummary } from "./types";
import WithdrawalFormModal from "./WithdrawalFormModal";
import WithdrawalHistory from "./WithdrawalHistory";
import MutationHistory from "./MutationHistory";
import SettlementHistory from "./SettlementHistory";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

interface Props {
	businessID: string;
}

export default function BalanceDashboard({ businessID }: Props) {
	const [balance, setBalance] = useState<SellerBalance | null>(null);
	const [settlementSummary, setSettlementSummary] = useState<SellerSettlementSummary | null>(null);
	const [loadingBalance, setLoadingBalance] = useState(true);
	const [activeTab, setActiveTab] = useState<"mutations" | "settlements" | "withdrawals">("mutations");
	const [showWithdrawModal, setShowWithdrawModal] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	const loadBalance = async () => {
		setLoadingBalance(true);
		const [balanceResult, summaryResult] = await Promise.allSettled([
			getSellerBalance(businessID),
			getSellerSettlementSummary(businessID),
		]);

		const errors: string[] = [];
		if (balanceResult.status === "fulfilled") {
			setBalance(balanceResult.value);
		} else {
			errors.push(balanceResult.reason?.message || "Gagal memuat saldo");
		}
		if (summaryResult.status === "fulfilled") {
			setSettlementSummary(summaryResult.value);
		} else {
			errors.push(summaryResult.reason?.message || "Gagal memuat ringkasan settlement");
		}

		if (errors.length > 0) {
			notifyError(errors[0]);
		}
		setLoadingBalance(false);
	};

	useEffect(() => {
		loadBalance();
	}, [businessID]);

	const handleWithdrawSuccess = () => {
		setShowWithdrawModal(false);
		loadBalance();
		setRefreshKey((k) => k + 1);
		setActiveTab("withdrawals");
		notifySuccess("Permintaan penarikan berhasil dibuat");
	};

	const availableBalance = settlementSummary?.available_balance ?? balance?.balance ?? 0;
	const pendingAmount = settlementSummary?.pending_amount ?? 0;
	const heldAmount = settlementSummary?.held_amount ?? 0;
	const releasedAmount = settlementSummary?.released_amount ?? 0;
	const lockedAmount = settlementSummary?.locked_amount ?? 0;

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-[28px] border border-[#e6d9c7] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_52%,#eef8f1_100%)] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl space-y-3">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
							<span>Saldo Toko</span>
						</div>
						<div>
							<h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Kelola saldo dan penarikan dana</h2>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
								Pantau saldo aktif, riwayat mutasi, dan status penarikan dalam satu tampilan yang selaras dengan halaman member lain.
							</p>
						</div>
					</div>
					<button
						onClick={() => setShowWithdrawModal(true)}
						disabled={loadingBalance || availableBalance <= 0}
						className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
					>
						Tarik Dana
					</button>
				</div>
				<div className="mt-6 rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Saldo tersedia</p>
					{loadingBalance ? (
						<div className="mt-3 h-10 w-40 animate-pulse rounded-2xl bg-slate-100" />
					) : (
						<p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
							{formatCents(availableBalance)}
						</p>
					)}
					{balance && (
						<p className="mt-2 text-xs text-slate-500">
							Diperbarui: {new Date(balance.updated_at).toLocaleString("id-ID")}
						</p>
					)}
				</div>

				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mt-4">
					<div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pending settlement</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{loadingBalance ? "..." : formatCents(pendingAmount)}</p>
						<p className="mt-1 text-xs text-slate-500">{settlementSummary ? `${settlementSummary.pending_count} settlement` : "Menunggu data"}</p>
					</div>
					<div className="rounded-[22px] border border-slate-200 bg-white/90 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ditahan settlement</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{loadingBalance ? "..." : formatCents(heldAmount)}</p>
						<p className="mt-1 text-xs text-slate-500">{settlementSummary ? `${settlementSummary.held_count} settlement` : "Menunggu data"}</p>
					</div>
					<div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Sudah cair</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{loadingBalance ? "..." : formatCents(releasedAmount)}</p>
						<p className="mt-1 text-xs text-slate-500">{settlementSummary ? `${settlementSummary.released_count} settlement` : "Menunggu data"}</p>
					</div>
					<div className="rounded-[22px] border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Dana belum cair</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{loadingBalance ? "..." : formatCents(lockedAmount)}</p>
						<p className="mt-1 text-xs text-slate-500">Pending + ditahan + sisa partial release.</p>
					</div>
				</div>

				<div className="mt-4 rounded-[22px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-800">
					<span className="font-semibold">Catatan:</span> pending berarti belum diputus, ditahan berarti menunggu review admin, dan sudah cair berarti nominalnya sudah masuk saldo yang bisa ditarik.
				</div>
			</section>

			<div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
				<div className="flex border-b border-[#f0e6d6] px-2 pt-2">
					<button
						onClick={() => setActiveTab("mutations")}
						className={`rounded-t-2xl px-5 py-3 text-sm font-medium transition-colors ${
							activeTab === "mutations"
								? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-700"
								: "text-slate-500 hover:bg-[#f2ede5] hover:text-slate-700"
						}`}
					>
						Riwayat Transaksi
					</button>
						<button
							onClick={() => setActiveTab("settlements")}
							className={`rounded-t-2xl px-5 py-3 text-sm font-medium transition-colors ${
								activeTab === "settlements"
									? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-700"
									: "text-slate-500 hover:bg-[#f2ede5] hover:text-slate-700"
							}`}
						>
							Riwayat Settlement
						</button>
					<button
						onClick={() => setActiveTab("withdrawals")}
						className={`rounded-t-2xl px-5 py-3 text-sm font-medium transition-colors ${
							activeTab === "withdrawals"
								? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-700"
								: "text-slate-500 hover:bg-[#f2ede5] hover:text-slate-700"
						}`}
					>
						Penarikan Dana
					</button>
				</div>

				<div className="p-5">
					{activeTab === "mutations" && (
						<MutationHistory businessID={businessID} refreshKey={refreshKey} />
					)}
					{activeTab === "settlements" && (
						<SettlementHistory businessID={businessID} refreshKey={refreshKey} />
					)}
					{activeTab === "withdrawals" && (
						<WithdrawalHistory
							businessID={businessID}
							refreshKey={refreshKey}
							onRequestNew={() => setShowWithdrawModal(true)}
						/>
					)}
				</div>
			</div>

			{showWithdrawModal && availableBalance > 0 && (
				<WithdrawalFormModal
					businessID={businessID}
					availableBalance={availableBalance}
					onSuccess={handleWithdrawSuccess}
					onClose={() => setShowWithdrawModal(false)}
				/>
			)}
		</div>
	);
}
