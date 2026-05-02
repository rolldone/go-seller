import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { getSellerBalance, listSellerMutations } from "./api";
import type { SellerBalance, SellerBalanceMutation } from "./types";
import WithdrawalFormModal from "./WithdrawalFormModal";
import WithdrawalHistory from "./WithdrawalHistory";
import MutationHistory from "./MutationHistory";

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
	const [loadingBalance, setLoadingBalance] = useState(true);
	const [activeTab, setActiveTab] = useState<"mutations" | "withdrawals">("mutations");
	const [showWithdrawModal, setShowWithdrawModal] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	const loadBalance = () => {
		setLoadingBalance(true);
		getSellerBalance(businessID)
			.then(setBalance)
			.catch((err) => notifyError(err?.message || "Gagal memuat saldo"))
			.finally(() => setLoadingBalance(false));
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

	return (
		<div className="space-y-6">
			{/* Balance Card */}
			<div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-blue-200 text-sm font-medium mb-1">Saldo Tersedia</p>
						{loadingBalance ? (
							<div className="h-10 w-40 bg-white/20 rounded animate-pulse" />
						) : (
							<p className="text-4xl font-bold tracking-tight">
								{balance ? formatCents(balance.balance) : "Rp 0"}
							</p>
						)}
						{balance && (
							<p className="text-blue-200 text-xs mt-2">
								Diperbarui: {new Date(balance.updated_at).toLocaleString("id-ID")}
							</p>
						)}
					</div>
					<button
						onClick={() => setShowWithdrawModal(true)}
						disabled={!balance || balance.balance <= 0}
						className="bg-white text-blue-700 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Tarik Dana
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="bg-white rounded-xl shadow-sm border border-gray-100">
				<div className="flex border-b border-gray-100">
					<button
						onClick={() => setActiveTab("mutations")}
						className={`px-6 py-3 text-sm font-medium transition-colors ${
							activeTab === "mutations"
								? "border-b-2 border-blue-600 text-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						Riwayat Transaksi
					</button>
					<button
						onClick={() => setActiveTab("withdrawals")}
						className={`px-6 py-3 text-sm font-medium transition-colors ${
							activeTab === "withdrawals"
								? "border-b-2 border-blue-600 text-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}
					>
						Penarikan Dana
					</button>
				</div>

				<div className="p-4">
					{activeTab === "mutations" && (
						<MutationHistory businessID={businessID} refreshKey={refreshKey} />
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

			{showWithdrawModal && balance && (
				<WithdrawalFormModal
					businessID={businessID}
					availableBalance={balance.balance}
					onSuccess={handleWithdrawSuccess}
					onClose={() => setShowWithdrawModal(false)}
				/>
			)}
		</div>
	);
}
