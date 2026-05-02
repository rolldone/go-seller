import { useEffect, useMemo, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import AdminModal from "../ui/AdminModal";
import {
	approveAdminWithdrawal,
	getAdminSellerBalanceSummary,
	listAdminWithdrawalAudits,
	listAdminWithdrawals,
	processAdminWithdrawal,
	rejectAdminWithdrawal,
} from "./api";
import type { AdminSellerBalanceSummary, AdminSellerWithdrawal, AdminSellerWithdrawalAudit } from "./types";

type ActionType = "approve" | "reject" | "process";

const STATUS_META: Record<string, { label: string; badge: string }> = {
	pending: { label: "Pending", badge: "bg-amber-100 text-amber-700" },
	approved: { label: "Approved", badge: "bg-sky-100 text-sky-700" },
	rejected: { label: "Rejected", badge: "bg-rose-100 text-rose-700" },
	processed: { label: "Processed", badge: "bg-emerald-100 text-emerald-700" },
};

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

function actionLabel(action: ActionType): string {
	switch (action) {
		case "approve":
			return "Approve";
		case "reject":
			return "Reject";
		case "process":
			return "Mark Processed";
	}
}

export default function SellerBalanceAdminPage() {
	const [summary, setSummary] = useState<AdminSellerBalanceSummary | null>(null);
	const [summaryLoading, setSummaryLoading] = useState(true);
	const [items, setItems] = useState<AdminSellerWithdrawal[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("pending");
	const [selected, setSelected] = useState<AdminSellerWithdrawal | null>(null);
	const [actionType, setActionType] = useState<ActionType | null>(null);
	const [adminNotes, setAdminNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [auditTarget, setAuditTarget] = useState<AdminSellerWithdrawal | null>(null);
	const [audits, setAudits] = useState<AdminSellerWithdrawalAudit[]>([]);
	const [auditsLoading, setAuditsLoading] = useState(false);
	const limit = 20;

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

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
		setLoading(true);
		try {
			const res = await listAdminWithdrawals(status, page, limit);
			setItems(res.data || []);
			setTotal(res.total || 0);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat data withdrawal");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadSummary();
	}, []);

	useEffect(() => {
		void loadWithdrawals();
	}, [status, page]);

	const openAction = (item: AdminSellerWithdrawal, nextAction: ActionType) => {
		setSelected(item);
		setActionType(nextAction);
		setAdminNotes(item.admin_notes || "");
	};

	const closeAction = () => {
		setSelected(null);
		setActionType(null);
		setAdminNotes("");
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
		if (!selected || !actionType) return;
		setSubmitting(true);
		try {
			if (actionType === "approve") {
				await approveAdminWithdrawal(selected.id, adminNotes.trim() || undefined);
			}
			if (actionType === "reject") {
				await rejectAdminWithdrawal(selected.id, adminNotes.trim() || undefined);
			}
			if (actionType === "process") {
				await processAdminWithdrawal(selected.id, adminNotes.trim() || undefined);
			}
			notifySuccess(`Withdrawal #${selected.id} berhasil di-${actionLabel(actionType).toLowerCase()}`);
			closeAction();
			await Promise.all([loadSummary(), loadWithdrawals()]);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Aksi withdrawal gagal diproses");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Seller Balance</h3>
					<p className="text-sm text-slate-600">Pantau kewajiban saldo seller dan approval withdrawal dari satu tempat.</p>
				</div>
				<button
					type="button"
					onClick={() => {
						void loadSummary();
						void loadWithdrawals();
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

			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
					<div>
						<h4 className="text-sm font-semibold text-slate-900">Queue withdrawal seller</h4>
						<p className="text-xs text-slate-500">Gunakan filter status untuk review, approve, reject, atau tandai dana sudah ditransfer.</p>
					</div>
					<div className="flex items-center gap-2">
						<select
							value={status}
							onChange={(e) => {
								setPage(1);
								setStatus(e.target.value);
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
							{loading ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Memuat data withdrawal...</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Tidak ada withdrawal untuk filter ini.</td>
								</tr>
							) : (
								items.map((item) => {
									const meta = STATUS_META[item.status] || { label: item.status, badge: "bg-slate-100 text-slate-700" };
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
					<p className="text-slate-500">Total data: {total}</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((current) => Math.max(1, current - 1))}
							disabled={page <= 1}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sebelumnya
						</button>
						<span className="text-slate-500">Halaman {page} / {totalPages}</span>
						<button
							type="button"
							onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
							disabled={page >= totalPages}
							className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</div>

			<AdminModal
				open={Boolean(selected && actionType)}
				onClose={closeAction}
				title={selected && actionType ? `${actionLabel(actionType)} withdrawal #${selected.id}` : "Withdrawal action"}
				maxWidth="lg"
				footer={
					<>
						<button type="button" onClick={closeAction} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Batal</button>
						<button type="button" onClick={() => void submitAction()} disabled={submitting} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Memproses..." : actionType ? actionLabel(actionType) : "Simpan"}</button>
					</>
				}
			>
				{selected ? (
					<div className="space-y-4">
						<div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
							<p><span className="font-semibold">Seller:</span> <span className="font-mono text-xs">{selected.seller_id}</span></p>
							<p className="mt-1"><span className="font-semibold">Nominal:</span> {formatCents(selected.amount)}</p>
							<p className="mt-1"><span className="font-semibold">Rekening:</span> {selected.bank_name} / {selected.bank_account_number} / {selected.bank_account_name}</p>
						</div>
						<div>
							<label className="mb-1 block text-sm font-medium text-slate-700">Catatan admin</label>
							<textarea
								value={adminNotes}
								onChange={(e) => setAdminNotes(e.target.value)}
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
		</div>
	);
}
