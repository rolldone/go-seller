import { useEffect, useMemo, useState, useRef } from "react";
import { NumericFormat } from "react-number-format";

import { notifyError, notifySuccess } from "../../../lib/notification";
import AdminModal from "../ui/AdminModal";
import {
	approveAdminWithdrawal,
	decideAdminSettlement,
	getAdminSellerBalanceSummary,
	listAdminWithdrawalAudits,
	listAdminWithdrawals,
	listAdminSettlements,
	processAdminWithdrawal,
	rejectAdminWithdrawal,
} from "./api";
import type {
	AdminSellerBalanceSummary,
	AdminSellerSettlement,
	AdminSellerWithdrawal,
	AdminSellerWithdrawalAudit,
} from "./types";

type WithdrawalActionType = "approve" | "reject" | "process";
type SettlementActionType = "hold" | "release" | "partial_release" | "refund";

const WITHDRAWAL_STATUS_META: Record<string, { label: string; badge: string }> = {
	pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
	approved: { label: "Approved", badge: "bg-sky-100 text-sky-700" },
	rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700" },
	processed: { label: "Processed", badge: "bg-emerald-100 text-emerald-700" },
};

const SETTLEMENT_STATUS_META: Record<string, { label: string; badge: string }> = {
	pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
	held: { label: "Held", badge: "bg-slate-100 text-slate-700" },
	partially_released: { label: "Partial", badge: "bg-sky-100 text-sky-700" },
	released: { label: "Released", badge: "bg-emerald-100 text-emerald-700" },
	refunded: { label: "Refunded", badge: "bg-rose-100 text-rose-700" },
	reversed: { label: "Reversed", badge: "bg-zinc-100 text-zinc-700" },
};

const DEFAULT_SETTLEMENT_STATUS = "pending";
const LOCKED_SETTLEMENT_FILTER = "locked";

function settlementOverviewKeyForStatus(status: string): string {
	switch (status) {
		case "pending":
			return "pending";
		case "held":
			return "held";
		case "partially_released":
			return "partial";
		case "released":
			return "released";
		case "refunded":
			return "refunded";
		case "reversed":
			return "reversed";
		case LOCKED_SETTLEMENT_FILTER:
			return "locked";
		default:
			return "";
	}
}

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

function formatDate(value: string | null): string {
	if (!value) return "-";
	return new Date(value).toLocaleString("id-ID");
}

function parseRupiahToCents(value: string): number | null {
	const digits = value.replace(/[^\d]/g, "");
	if (!digits) return null;
	const amount = Number(digits);
	if (!Number.isFinite(amount)) return null;
	return amount * 100;
}

function settlementRemainingAmount(settlement: AdminSellerSettlement): number {
	return Math.max(0, settlement.gross_amount - settlement.released_amount);
}

function withdrawalActionLabel(action: WithdrawalActionType): string {
	switch (action) {
		case "approve":
			return "Approve";
		case "reject":
			return "Reject";
		case "process":
			return "Mark Processed";
	}
}

function settlementActionLabel(action: SettlementActionType): string {
	switch (action) {
		case "hold":
			return "Hold";
		case "release":
			return "Release";
		case "partial_release":
			return "Partial Release";
		case "refund":
			return "Refund";
	}
}

function settlementSuccessLabel(action: SettlementActionType): string {
	switch (action) {
		case "hold":
			return "hold";
		case "release":
			return "release";
		case "partial_release":
			return "partial release";
		case "refund":
			return "refund";
	}
}

function decodeSettlementMetadata(metadata?: string | null): unknown {
	if (!metadata) return null;
	try {
		const decoded = atob(metadata);
		return JSON.parse(decoded);
	} catch {
		try {
			return JSON.parse(metadata);
		} catch {
			return metadata;
		}
	}
}

function formatSettlementMetadata(metadata?: string | null): string {
	const parsed = decodeSettlementMetadata(metadata);
	if (parsed == null) return "{}";
	if (typeof parsed === "string") return parsed;
	return JSON.stringify(parsed, null, 2);
}

export default function SellerBalanceAdminPage() {
	const [summary, setSummary] = useState<AdminSellerBalanceSummary | null>(null);
	const [summaryLoading, setSummaryLoading] = useState(true);

	const [withdrawalItems, setWithdrawalItems] = useState<AdminSellerWithdrawal[]>([]);
	const [withdrawalTotal, setWithdrawalTotal] = useState(0);
	const [withdrawalLoading, setWithdrawalLoading] = useState(true);
	const [withdrawalPage, setWithdrawalPage] = useState(1);
	const [withdrawalStatus, setWithdrawalStatus] = useState("pending");
	const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminSellerWithdrawal | null>(null);
	const [withdrawalActionType, setWithdrawalActionType] = useState<WithdrawalActionType | null>(null);
	const [withdrawalAdminNotes, setWithdrawalAdminNotes] = useState("");
	const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
	const [auditTarget, setAuditTarget] = useState<AdminSellerWithdrawal | null>(null);
	const [audits, setAudits] = useState<AdminSellerWithdrawalAudit[]>([]);
	const [auditsLoading, setAuditsLoading] = useState(false);

	const [settlementItems, setSettlementItems] = useState<AdminSellerSettlement[]>([]);
	const [settlementTotal, setSettlementTotal] = useState(0);
	const [settlementLoading, setSettlementLoading] = useState(true);
	const [settlementPage, setSettlementPage] = useState(1);
	const [settlementStatus, setSettlementStatus] = useState(DEFAULT_SETTLEMENT_STATUS);
	const [selectedOverviewKey, setSelectedOverviewKey] = useState<string>(() => settlementOverviewKeyForStatus(DEFAULT_SETTLEMENT_STATUS));
	const [settlementSellerFilter, setSettlementSellerFilter] = useState("");
	const [settlementOrderFilter, setSettlementOrderFilter] = useState("");
	const [settlementDateFrom, setSettlementDateFrom] = useState("");
	const [settlementDateTo, setSettlementDateTo] = useState("");
	const [selectedSettlement, setSelectedSettlement] = useState<AdminSellerSettlement | null>(null);
	const [settlementDetailTarget, setSettlementDetailTarget] = useState<AdminSellerSettlement | null>(null);
	const [settlementActionType, setSettlementActionType] = useState<SettlementActionType | null>(null);
	const [settlementAdminNotes, setSettlementAdminNotes] = useState("");
	const [settlementReleaseAmount, setSettlementReleaseAmount] = useState("");
	const [settlementSubmitting, setSettlementSubmitting] = useState(false);

	const limit = 20;

	const settlementQueueRef = useRef<HTMLDivElement | null>(null);

	const withdrawalTotalPages = useMemo(() => Math.max(1, Math.ceil(withdrawalTotal / limit)), [withdrawalTotal]);
	const settlementTotalPages = useMemo(() => Math.max(1, Math.ceil(settlementTotal / limit)), [settlementTotal]);
	const lockedSettlementCount =
		(summary?.settlement_pending_count ?? 0) +
		(summary?.settlement_held_count ?? 0) +
		(summary?.settlement_partially_released_count ?? 0);
	const settlementOverviewCards = useMemo(
		() => [
			{
				key: "pending",
				status: "pending",
				label: "Pending",
				amount: summary?.settlement_pending_amount ?? 0,
				countLabel: `${summary?.settlement_pending_count ?? 0} settlement`,
				helper: "Menunggu keputusan admin.",
				className: "border-amber-100 bg-amber-50/80",
				labelClassName: "text-amber-700",
			},
			{
				key: "held",
				status: "held",
				label: "Held",
				amount: summary?.settlement_held_amount ?? 0,
				countLabel: `${summary?.settlement_held_count ?? 0} settlement`,
				helper: "Dana ditahan sambil menunggu review lanjutan.",
				className: "border-slate-200 bg-white/90",
				labelClassName: "text-slate-600",
			},
			{
				key: "partial",
				status: "partially_released",
				label: "Partial",
				amount: summary?.settlement_partially_released_remaining_amount ?? 0,
				countLabel: `${summary?.settlement_partially_released_count ?? 0} settlement`,
				helper: "Sisa dana yang belum dilepas.",
				className: "border-sky-100 bg-sky-50/80",
				labelClassName: "text-sky-700",
			},
			{
				key: "released",
				status: "released",
				label: "Released",
				amount: summary?.settlement_released_amount ?? 0,
				countLabel: `${summary?.settlement_released_count ?? 0} settlement`,
				helper: "Sudah masuk ke saldo seller.",
				className: "border-emerald-100 bg-emerald-50/80",
				labelClassName: "text-emerald-700",
			},
			{
				key: "refunded",
				status: "refunded",
				label: "Refunded",
				amount: summary?.settlement_refunded_amount ?? 0,
				countLabel: `${summary?.settlement_refunded_count ?? 0} settlement`,
				helper: "Settlement dibatalkan dan dikembalikan.",
				className: "border-rose-100 bg-rose-50/80",
				labelClassName: "text-rose-700",
			},
			{
				key: "reversed",
				status: "reversed",
				label: "Reversed",
				amount: summary?.settlement_reversed_amount ?? 0,
				countLabel: `${summary?.settlement_reversed_count ?? 0} settlement`,
				helper: "Settlement dibalik setelah keputusan sebelumnya.",
				className: "border-zinc-200 bg-zinc-50/80",
				labelClassName: "text-zinc-700",
			},
			{
				key: "locked",
				status: LOCKED_SETTLEMENT_FILTER,
				label: "Dana terkunci",
				amount: summary?.settlement_locked_amount ?? 0,
				countLabel: `${lockedSettlementCount} settlement terkunci`,
				helper: "Pending + held + sisa partial release.",
				className: "border-amber-200 bg-amber-50",
				labelClassName: "text-amber-800",
			},
		],
		[lockedSettlementCount, summary],
	);

	const applySettlementStatusFilter = (status: string, overviewKey?: string) => {
		setSettlementPage(1);
		setSettlementStatus(status);
		setSelectedOverviewKey(overviewKey ?? settlementOverviewKeyForStatus(status));
	};

	const loadSummary = async () => {
		setSummaryLoading(true);
		try {
			const res = await getAdminSellerBalanceSummary();
			setSummary(res.summary);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat ringkasan saldo seller");
		} finally {
			setSummaryLoading(false);
		}
	};

	const loadWithdrawals = async () => {
		setWithdrawalLoading(true);
		try {
			const res = await listAdminWithdrawals(withdrawalStatus, withdrawalPage, limit);
			setWithdrawalItems(res.data || []);
			setWithdrawalTotal(res.total || 0);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat data withdrawal");
		} finally {
			setWithdrawalLoading(false);
		}
	};

	const loadSettlements = async () => {
		setSettlementLoading(true);
		try {
			const res = await listAdminSettlements(settlementStatus, settlementPage, limit, {
				sellerID: settlementSellerFilter.trim() || undefined,
				orderID: settlementOrderFilter.trim() || undefined,
				dateFrom: settlementDateFrom || undefined,
				dateTo: settlementDateTo || undefined,
			});
			setSettlementItems(res.data || []);
			setSettlementTotal(res.total || 0);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat data settlement");
		} finally {
			setSettlementLoading(false);
		}
	};

	useEffect(() => {
		void loadSummary();
	}, []);

	useEffect(() => {
		void loadWithdrawals();
	}, [withdrawalStatus, withdrawalPage]);

	useEffect(() => {
		void loadSettlements();
	}, [settlementStatus, settlementPage, settlementSellerFilter, settlementOrderFilter, settlementDateFrom, settlementDateTo]);

	const openAction = (item: AdminSellerWithdrawal, nextAction: WithdrawalActionType) => {
		setSelectedWithdrawal(item);
		setWithdrawalActionType(nextAction);
		setWithdrawalAdminNotes(item.admin_notes || "");
	};

	const closeAction = () => {
		setSelectedWithdrawal(null);
		setWithdrawalActionType(null);
		setWithdrawalAdminNotes("");
	};

	const openAudit = async (item: AdminSellerWithdrawal) => {
		setAuditTarget(item);
		setAudits([]);
		setAuditsLoading(true);
		try {
			const res = await listAdminWithdrawalAudits(item.id);
			setAudits(res.data || []);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat audit withdrawal");
		} finally {
			setAuditsLoading(false);
		}
	};

	const closeAudit = () => {
		setAuditTarget(null);
		setAudits([]);
	};

	const submitAction = async () => {
		if (!selectedWithdrawal || !withdrawalActionType) return;
		setWithdrawalSubmitting(true);
		try {
			if (withdrawalActionType === "approve") {
				await approveAdminWithdrawal(selectedWithdrawal.id, withdrawalAdminNotes.trim() || undefined);
			}
			if (withdrawalActionType === "reject") {
				await rejectAdminWithdrawal(selectedWithdrawal.id, withdrawalAdminNotes.trim() || undefined);
			}
			if (withdrawalActionType === "process") {
				await processAdminWithdrawal(selectedWithdrawal.id, withdrawalAdminNotes.trim() || undefined);
			}
			notifySuccess(`Withdrawal #${selectedWithdrawal.id} berhasil di-${withdrawalActionLabel(withdrawalActionType).toLowerCase()}`);
			closeAction();
			await Promise.all([loadSummary(), loadWithdrawals()]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Aksi withdrawal gagal diproses");
		} finally {
			setWithdrawalSubmitting(false);
		}
	};

	const openSettlementAction = (item: AdminSellerSettlement, nextAction: SettlementActionType) => {
		setSelectedSettlement(item);
		setSettlementActionType(nextAction);
		setSettlementAdminNotes(item.admin_note || "");
		setSettlementReleaseAmount(nextAction === "partial_release" ? String(Math.max(0, Math.round(settlementRemainingAmount(item) / 100))) : "");
	};

	const closeSettlementAction = () => {
		setSelectedSettlement(null);
		setSettlementActionType(null);
		setSettlementAdminNotes("");
		setSettlementReleaseAmount("");
	};

	const closeSettlementDetail = () => {
		setSettlementDetailTarget(null);
	};

	const submitSettlementAction = async () => {
		if (!selectedSettlement || !settlementActionType) return;
		setSettlementSubmitting(true);
		try {
			let releaseAmount: number | undefined;
			if (settlementActionType === "partial_release") {
				const parsed = parseRupiahToCents(settlementReleaseAmount);
				if (!parsed || parsed <= 0) {
					throw new Error("Nominal partial release wajib diisi");
				}
				const remaining = settlementRemainingAmount(selectedSettlement);
				if (parsed > remaining) {
					throw new Error("Nominal release melebihi sisa settlement");
				}
				releaseAmount = parsed;
			}
			await decideAdminSettlement(selectedSettlement.id, {
				decision: settlementActionType,
				release_amount: releaseAmount,
				admin_note: settlementAdminNotes.trim() || undefined,
			});
			notifySuccess(`Settlement #${selectedSettlement.id} berhasil di-${settlementSuccessLabel(settlementActionType)}`);
			closeSettlementAction();
			await Promise.all([loadSummary(), loadSettlements()]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Aksi settlement gagal diproses");
		} finally {
			setSettlementSubmitting(false);
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Seller Balance</h3>
					<p className="text-sm text-slate-600">Pantau saldo seller, queue withdrawal, dan settlement escrow dari satu tempat.</p>
				</div>
				<button
					type="button"
					onClick={() => {
						void loadSummary();
						void loadWithdrawals();
						void loadSettlements();
					}}
					className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
				>
					Refresh
				</button>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total saldo seller</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{summaryLoading ? "..." : formatCents(summary?.total_balance || 0)}
					</p>
					<p className="mt-1 text-xs text-slate-500">Dana yang masih menjadi kewajiban platform.</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Seller aktif bersaldo</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{summaryLoading ? "..." : summary?.positive_balance_seller_count || 0}
					</p>
					<p className="mt-1 text-xs text-slate-500">Jumlah seller dengan saldo di atas nol.</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<p className="text-sm text-slate-500">Total seller tercatat</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">
						{summaryLoading ? "..." : summary?.seller_count || 0}
					</p>
					<p className="mt-1 text-xs text-slate-500">Semua seller yang sudah punya ledger balance.</p>
				</div>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h4 className="text-sm font-semibold text-slate-900">Settlement per status</h4>
						<p className="text-xs text-slate-500">Ringkasan nominal settlement escrow yang sedang pending, ditahan, dilepas, di-refund, atau dibalik.</p>
					</div>
					<p className="text-xs font-medium text-slate-500">
						{summaryLoading ? "..." : `${summary?.settlement_total_count || 0} settlement tercatat`}
					</p>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					{settlementOverviewCards.map((card) => (
						<div
							key={card.key}
							role="button"
							tabIndex={0}
							onClick={() => {
								applySettlementStatusFilter(card.status || "", card.key);
								setTimeout(() => {
									settlementQueueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
									settlementQueueRef.current?.focus();
								}, 120);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									applySettlementStatusFilter(card.status || "", card.key);
									setTimeout(() => {
										settlementQueueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
										settlementQueueRef.current?.focus();
									}, 120);
								}
							}}
							className={`rounded-xl border p-4 shadow-sm ${card.className} cursor-pointer ${selectedOverviewKey === card.key ? "ring-2 ring-emerald-300" : ""}`}>
							<div className="flex items-center justify-between gap-3">
								<p className={`text-sm font-semibold ${card.labelClassName}`}>{card.label}</p>
								<span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-500">{summaryLoading ? "..." : card.countLabel}</span>
							</div>
							<p className="mt-2 text-2xl font-semibold text-slate-900">{summaryLoading ? "..." : formatCents(card.amount)}</p>
							<p className="mt-1 text-xs text-slate-500">{card.helper}</p>
						</div>
					))}
				</div>
			</div>

			<div ref={settlementQueueRef} tabIndex={-1} className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
					<div>
						<h4 className="text-sm font-semibold text-slate-900">Queue withdrawal seller</h4>
						<p className="text-xs text-slate-500">Gunakan filter status untuk review, approve, reject, atau tandai dana sudah ditransfer.</p>
					</div>
					<div className="flex items-center gap-2">
						<select
							value={withdrawalStatus}
							onChange={(e) => {
								setWithdrawalPage(1);
								setWithdrawalStatus(e.target.value);
							}}
							className="rounded border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="pending">Pending</option>
							<option value="approved">Approved</option>
							<option value="processed">Processed</option>
							<option value="rejected">Rejected</option>
							<option value="">All statuses</option>
						</select>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Withdrawal</th>
								<th className="px-4 py-3">Seller</th>
								<th className="px-4 py-3">Bank</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Timeline</th>
								<th className="px-4 py-3">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 bg-white">
							{withdrawalLoading ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Memuat data withdrawal...</td>
								</tr>
							) : withdrawalItems.length === 0 ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Tidak ada withdrawal untuk filter ini.</td>
								</tr>
							) : (
								withdrawalItems.map((item) => {
									const meta = WITHDRAWAL_STATUS_META[item.status] || { label: item.status, badge: "bg-slate-100 text-slate-700" };
									return (
										<tr key={item.id} className="align-top">
											<td className="px-4 py-4">
												<p className="font-semibold text-slate-900">#{item.id}</p>
												<p className="mt-1 text-sm text-slate-700">{formatCents(item.amount)}</p>
												{item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
											</td>
											<td className="px-4 py-4">
												<p className="font-mono text-xs text-slate-700">{item.seller_id}</p>
											</td>
											<td className="px-4 py-4">
												<p className="font-medium text-slate-800">{item.bank_name}</p>
												<p className="text-xs text-slate-500">{item.bank_account_number}</p>
												<p className="text-xs text-slate-500">a/n {item.bank_account_name}</p>
											</td>
											<td className="px-4 py-4">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
												{item.admin_notes ? <p className="mt-2 text-xs text-slate-500">{item.admin_notes}</p> : null}
											</td>
											<td className="px-4 py-4 text-xs text-slate-500">
												<p>Dibuat: {formatDate(item.created_at)}</p>
												<p>Review: {formatDate(item.reviewed_at)}</p>
												<p>Transfer: {formatDate(item.processed_at)}</p>
											</td>
											<td className="px-4 py-4">
												<div className="flex flex-wrap gap-2">
													<button type="button" onClick={() => void openAudit(item)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Audit</button>
													{item.status === "pending" ? (
														<>
															<button type="button" onClick={() => openAction(item, "approve")} className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">Approve</button>
															<button type="button" onClick={() => openAction(item, "reject")} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Reject</button>
														</>
													) : null}
													{item.status === "approved" ? (
														<>
															<button type="button" onClick={() => openAction(item, "process")} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Mark Processed</button>
															<button type="button" onClick={() => openAction(item, "reject")} className="rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">Reject</button>
														</>
													) : null}
													{item.status === "processed" || item.status === "rejected" ? <span className="text-xs text-slate-400">Tidak ada aksi</span> : null}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm">
					<p className="text-slate-500">Total data: {withdrawalTotal}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setWithdrawalPage((current) => Math.max(1, current - 1))}
							disabled={withdrawalPage <= 1}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="text-slate-500">Halaman {withdrawalPage} / {withdrawalTotalPages}</span>
						<button
							type="button"
							onClick={() => setWithdrawalPage((current) => Math.min(withdrawalTotalPages, current + 1))}
							disabled={withdrawalPage >= withdrawalTotalPages}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</div>

			<AdminModal
				open={Boolean(selectedWithdrawal && withdrawalActionType)}
				onClose={closeAction}
				title={selectedWithdrawal && withdrawalActionType ? `${withdrawalActionLabel(withdrawalActionType)} withdrawal #${selectedWithdrawal.id}` : "Withdrawal action"}
				maxWidth="lg"
				footer={
					<>
						<button type="button" onClick={closeAction} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Batal</button>
							<button type="button" onClick={() => void submitAction()} disabled={withdrawalSubmitting} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{withdrawalSubmitting ? "Memproses..." : withdrawalActionType ? withdrawalActionLabel(withdrawalActionType) : "Simpan"}</button>
					</>
				}
			>
					{selectedWithdrawal ? (
					<div className="space-y-4">
						<div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
								<p><span className="font-semibold">Seller:</span> <span className="font-mono text-xs">{selectedWithdrawal.seller_id}</span></p>
								<p className="mt-1"><span className="font-semibold">Nominal:</span> {formatCents(selectedWithdrawal.amount)}</p>
								<p className="mt-1"><span className="font-semibold">Rekening:</span> {selectedWithdrawal.bank_name} / {selectedWithdrawal.bank_account_number} / {selectedWithdrawal.bank_account_name}</p>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium text-slate-700">Catatan admin</label>
							<textarea
									value={withdrawalAdminNotes}
									onChange={(e) => setWithdrawalAdminNotes(e.target.value)}
								rows={4}
								className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
								placeholder="Tambahkan alasan atau catatan proses"
							/>
						</div>
					</div>
				) : null}
			</AdminModal>

			<AdminModal
				open={Boolean(auditTarget)}
				onClose={closeAudit}
				title={auditTarget ? `Audit withdrawal #${auditTarget.id}` : "Withdrawal audit"}
				maxWidth="xl"
			>
				{auditsLoading ? (
					<p className="text-sm text-slate-500">Memuat audit log...</p>
				) : audits.length === 0 ? (
					<p className="text-sm text-slate-500">Belum ada audit log.</p>
				) : (
					<div className="space-y-3">
						{audits.map((audit) => (
							<div key={audit.id} className="rounded-lg border border-slate-200 p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-semibold text-slate-900">{audit.action}</p>
									<p className="text-xs text-slate-500">{formatDate(audit.created_at)}</p>
								</div>
								<div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
									<p><span className="font-medium text-slate-800">Actor:</span> {audit.actor_type}{audit.actor_id ? ` (${audit.actor_id})` : ""}</p>
									<p><span className="font-medium text-slate-800">Status:</span> {audit.status_from || "-"} → {audit.status_to}</p>
								</div>
								{audit.notes ? <p className="mt-2 text-sm text-slate-600">{audit.notes}</p> : null}
							</div>
						))}
					</div>
				)}
			</AdminModal>

			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
					<div>
						<h4 className="text-sm font-semibold text-slate-900">Queue settlement escrow</h4>
						<p className="text-xs text-slate-500">Review settlement pending dan putuskan hold, release, partial release, atau refund.</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="text"
							value={settlementSellerFilter}
							onChange={(e) => {
								setSettlementPage(1);
								setSettlementSellerFilter(e.target.value);
							}}
							placeholder="Filter seller_id"
							className="w-44 rounded border border-slate-300 px-3 py-2 text-sm"
						/>
						<input
							type="text"
							value={settlementOrderFilter}
							onChange={(e) => {
								setSettlementPage(1);
								setSettlementOrderFilter(e.target.value);
							}}
							placeholder="Filter order_id"
							className="w-44 rounded border border-slate-300 px-3 py-2 text-sm"
						/>
						<input
							type="date"
							value={settlementDateFrom}
							onChange={(e) => {
								setSettlementPage(1);
								setSettlementDateFrom(e.target.value);
							}}
							className="rounded border border-slate-300 px-3 py-2 text-sm"
						/>
						<input
							type="date"
							value={settlementDateTo}
							onChange={(e) => {
								setSettlementPage(1);
								setSettlementDateTo(e.target.value);
							}}
							className="rounded border border-slate-300 px-3 py-2 text-sm"
						/>
						<button
							type="button"
							onClick={() => {
								setSettlementPage(1);
								setSettlementSellerFilter("");
								setSettlementOrderFilter("");
								setSettlementDateFrom("");
								setSettlementDateTo("");
							}}
							className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
						>
							Reset
						</button>
						<select
							value={settlementStatus}
							onChange={(e) => {
								applySettlementStatusFilter(e.target.value);
							}}
							className="rounded border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="pending">Pending</option>
							<option value="held">Held</option>
							<option value="partially_released">Partial</option>
							<option value="locked">Dana terkunci</option>
							<option value="released">Released</option>
							<option value="refunded">Refunded</option>
							<option value="reversed">Reversed</option>
							<option value="">All statuses</option>
						</select>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Settlement</th>
								<th className="px-4 py-3">Seller / Order</th>
								<th className="px-4 py-3">Amount</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Timeline</th>
								<th className="px-4 py-3">Aksi</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 bg-white">
							{settlementLoading ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Memuat data settlement...</td>
								</tr>
							) : settlementItems.length === 0 ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Tidak ada settlement untuk filter ini.</td>
								</tr>
							) : (
								settlementItems.map((item) => {
									const meta = SETTLEMENT_STATUS_META[item.status] || { label: item.status, badge: "bg-slate-100 text-slate-700" };
									const remaining = settlementRemainingAmount(item);
									const canRefund = item.released_amount <= 0;
									const canDecide = item.status !== "released" && item.status !== "refunded" && item.status !== "reversed";
									return (
										<tr key={item.id} className="align-top">
											<td className="px-4 py-4">
												<p className="font-semibold text-slate-900">#{item.id}</p>
												<p className="mt-1 text-xs text-slate-500">Scope: {item.release_scope}</p>
												<p className="mt-1 text-xs text-slate-500">Source: {item.source}</p>
											</td>
											<td className="px-4 py-4">
												<p className="font-mono text-xs text-slate-700">Seller {item.seller_id}</p>
												<p className="mt-1 font-mono text-xs text-slate-500">Order {item.order_id}</p>
												{item.reference_id ? <p className="mt-1 text-xs text-slate-500">Ref: {item.reference_type || "-"} / {item.reference_id}</p> : null}
											</td>
											<td className="px-4 py-4">
												<p className="font-semibold text-slate-900">Gross {formatCents(item.gross_amount)}</p>
												<p className="mt-1 text-xs text-slate-500">Released {formatCents(item.released_amount)}</p>
												<p className="mt-1 text-xs text-slate-500">Remaining {formatCents(remaining)}</p>
											</td>
											<td className="px-4 py-4">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
												{item.admin_note ? <p className="mt-2 text-xs text-slate-500">{item.admin_note}</p> : null}
											</td>
											<td className="px-4 py-4 text-xs text-slate-500">
												<p>Dibuat: {formatDate(item.created_at)}</p>
												<p>Diputus: {formatDate(item.decided_at)}</p>
												<p>Released: {formatDate(item.released_at)}</p>
											</td>
											<td className="px-4 py-4">
												<div className="flex flex-wrap gap-2">
													<button type="button" onClick={() => setSettlementDetailTarget(item)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Detail</button>
													{canDecide ? (
														<>
															<button type="button" onClick={() => openSettlementAction(item, "hold")} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Hold</button>
															<button type="button" onClick={() => openSettlementAction(item, "release")} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Release</button>
															<button type="button" onClick={() => openSettlementAction(item, "partial_release")} className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">Partial</button>
															{canRefund ? (
																<button type="button" onClick={() => openSettlementAction(item, "refund")} className="rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">Refund</button>
															) : null}
														</>
													) : (
														<span className="text-xs text-slate-400">Tidak ada aksi lanjutan</span>
													)}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm">
					<p className="text-slate-500">Total data: {settlementTotal}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setSettlementPage((current) => Math.max(1, current - 1))}
							disabled={settlementPage <= 1}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="text-slate-500">Halaman {settlementPage} / {settlementTotalPages}</span>
						<button
							type="button"
							onClick={() => setSettlementPage((current) => Math.min(settlementTotalPages, current + 1))}
							disabled={settlementPage >= settlementTotalPages}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</div>

			<AdminModal
				open={Boolean(selectedSettlement && settlementActionType)}
				onClose={closeSettlementAction}
				title={selectedSettlement && settlementActionType ? `${settlementActionLabel(settlementActionType)} settlement #${selectedSettlement.id}` : "Settlement action"}
				maxWidth="xl"
				footer={
					<>
						<button type="button" onClick={closeSettlementAction} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Batal</button>
						<button type="button" onClick={() => void submitSettlementAction()} disabled={settlementSubmitting} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{settlementSubmitting ? "Memproses..." : settlementActionType ? settlementActionLabel(settlementActionType) : "Simpan"}</button>
					</>
				}
			>
				{selectedSettlement ? (
					<div className="space-y-4">
						<div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
							<p><span className="font-semibold">Seller:</span> <span className="font-mono text-xs">{selectedSettlement.seller_id}</span></p>
							<p className="mt-1"><span className="font-semibold">Order:</span> <span className="font-mono text-xs">{selectedSettlement.order_id}</span></p>
							<p className="mt-1"><span className="font-semibold">Gross:</span> {formatCents(selectedSettlement.gross_amount)}</p>
							<p className="mt-1"><span className="font-semibold">Released:</span> {formatCents(selectedSettlement.released_amount)}</p>
							<p className="mt-1"><span className="font-semibold">Remaining:</span> {formatCents(settlementRemainingAmount(selectedSettlement))}</p>
							<p className="mt-1"><span className="font-semibold">Status:</span> {selectedSettlement.status}</p>
						</div>

						{settlementActionType === "partial_release" ? (
							<div>
								<label className="mb-1 block text-sm font-medium text-slate-700">Nominal partial release</label>
								<NumericFormat
									value={settlementReleaseAmount}
									valueIsNumericString
									onValueChange={(values) => setSettlementReleaseAmount(values.value)}
									thousandSeparator="."
									decimalScale={0}
									allowNegative={false}
									inputMode="numeric"
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
									placeholder="0"
								/>
								<p className="mt-1 text-xs text-slate-500">Maksimum {formatCents(settlementRemainingAmount(selectedSettlement))}.</p>
							</div>
						) : null}

						<div>
							<label className="mb-1 block text-sm font-medium text-slate-700">Catatan admin</label>
							<textarea
								value={settlementAdminNotes}
								onChange={(e) => setSettlementAdminNotes(e.target.value)}
								rows={4}
								className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
								placeholder="Tambahkan alasan atau catatan keputusan"
							/>
						</div>
					</div>
				) : null}
			</AdminModal>

			<AdminModal
				open={Boolean(settlementDetailTarget)}
				onClose={closeSettlementDetail}
				title={settlementDetailTarget ? `Detail settlement #${settlementDetailTarget.id}` : "Detail settlement"}
				maxWidth="xl"
			>
				{settlementDetailTarget ? (
					<div className="space-y-4 text-sm">
						<div className="grid gap-2 rounded-lg bg-slate-50 p-4 text-slate-700 md:grid-cols-2">
							<p><span className="font-semibold">Seller:</span> <span className="font-mono text-xs">{settlementDetailTarget.seller_id}</span></p>
							<p><span className="font-semibold">Order:</span> <span className="font-mono text-xs">{settlementDetailTarget.order_id}</span></p>
							<p><span className="font-semibold">Status:</span> {settlementDetailTarget.status}</p>
							<p><span className="font-semibold">Scope:</span> {settlementDetailTarget.release_scope}</p>
							<p><span className="font-semibold">Gross:</span> {formatCents(settlementDetailTarget.gross_amount)}</p>
							<p><span className="font-semibold">Released:</span> {formatCents(settlementDetailTarget.released_amount)}</p>
							<p><span className="font-semibold">Remaining:</span> {formatCents(settlementRemainingAmount(settlementDetailTarget))}</p>
							<p><span className="font-semibold">Ref:</span> {settlementDetailTarget.reference_type || "-"} / {settlementDetailTarget.reference_id || "-"}</p>
							<p><span className="font-semibold">Dibuat:</span> {formatDate(settlementDetailTarget.created_at)}</p>
							<p><span className="font-semibold">Diputus:</span> {formatDate(settlementDetailTarget.decided_at)}</p>
							<p><span className="font-semibold">Released At:</span> {formatDate(settlementDetailTarget.released_at)}</p>
							<p><span className="font-semibold">Admin Note:</span> {settlementDetailTarget.admin_note || "-"}</p>
						</div>
						<div>
							<p className="mb-2 font-semibold text-slate-800">Metadata</p>
							<pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">{formatSettlementMetadata(settlementDetailTarget.metadata)}</pre>
						</div>
					</div>
				) : null}
			</AdminModal>
		</div>
	);
}
