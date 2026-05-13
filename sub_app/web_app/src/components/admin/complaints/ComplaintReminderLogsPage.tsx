import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, MessageSquareText, ExternalLink } from "lucide-react";
import { notifyError } from "../../../lib/notification";
import { listComplaintReminderLogs, type ComplaintReminderLog } from "./complaintReminderApi";

const statusOptions: Array<{ value: string; label: string }> = [
	{ value: "all", label: "All statuses" },
	{ value: "queued", label: "Queued" },
	{ value: "processing", label: "Processing" },
	{ value: "retrying", label: "Retrying" },
	{ value: "sent", label: "Sent" },
	{ value: "skipped", label: "Skipped" },
	{ value: "failed", label: "Failed" },
];

const recipientOptions: Array<{ value: string; label: string }> = [
	{ value: "all", label: "All recipients" },
	{ value: "customer", label: "Customer" },
	{ value: "business", label: "Business" },
];

const senderOptions: Array<{ value: string; label: string }> = [
	{ value: "all", label: "All senders" },
	{ value: "customer", label: "Customer" },
	{ value: "member", label: "Member" },
	{ value: "admin", label: "Admin" },
];

function formatDateTime(value?: string | null): string {
	if (!value) return "-";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("id-ID");
}

function statusMeta(status?: string | null): { label: string; className: string } {
	const key = String(status || "").trim().toLowerCase();
	if (key === "queued") return { label: "Queued", className: "border-amber-200 bg-amber-50 text-amber-700" };
	if (key === "processing") return { label: "Processing", className: "border-sky-200 bg-sky-50 text-sky-700" };
	if (key === "retrying") return { label: "Retrying", className: "border-orange-200 bg-orange-50 text-orange-700" };
	if (key === "sent") return { label: "Sent", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
	if (key === "skipped") return { label: "Skipped", className: "border-slate-200 bg-slate-100 text-slate-700" };
	if (key === "failed") return { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-700" };
	return { label: key || "-", className: "border-slate-200 bg-slate-100 text-slate-700" };
}

function recipientMeta(value?: string | null): string {
	const key = String(value || "").trim().toLowerCase();
	if (key === "customer") return "Customer";
	if (key === "business") return "Business";
	return key || "-";
}

function senderMeta(value?: string | null): string {
	const key = String(value || "").trim().toLowerCase();
	if (key === "customer") return "Customer";
	if (key === "member") return "Member";
	if (key === "admin") return "Admin";
	return key || "-";
}

function buildComplaintThreadHref(log: ComplaintReminderLog): string {
	return `/admin/orders/${encodeURIComponent(log.order_id)}/complaints?complaint_id=${encodeURIComponent(log.complaint_case_id)}`;
}

export default function ComplaintReminderLogsPage() {
	const [items, setItems] = useState<ComplaintReminderLog[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [status, setStatus] = useState("all");
	const [recipientType, setRecipientType] = useState("all");
	const [senderType, setSenderType] = useState("all");
	const [orderID, setOrderID] = useState("");
	const [complaintCaseID, setComplaintCaseID] = useState("");
	const [q, setQ] = useState("");

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

	const loadData = async (overrides: {
		page?: number;
		limit?: number;
		status?: string;
		recipientType?: string;
		senderType?: string;
		orderID?: string;
		complaintCaseID?: string;
		q?: string;
	} = {}) => {
		const nextPage = overrides.page ?? page;
		const nextLimit = overrides.limit ?? limit;
		const nextStatus = overrides.status ?? status;
		const nextRecipientType = overrides.recipientType ?? recipientType;
		const nextSenderType = overrides.senderType ?? senderType;
		const nextOrderID = overrides.orderID ?? orderID;
		const nextComplaintCaseID = overrides.complaintCaseID ?? complaintCaseID;
		const nextQuery = overrides.q ?? q;

		setLoading(true);
		setError(null);
		try {
			const res = await listComplaintReminderLogs({
				status: nextStatus === "all" ? undefined : nextStatus,
				recipient_type: nextRecipientType === "all" ? undefined : nextRecipientType,
				sender_type: nextSenderType === "all" ? undefined : nextSenderType,
				order_id: nextOrderID.trim() || undefined,
				complaint_case_id: nextComplaintCaseID.trim() || undefined,
				q: nextQuery.trim() || undefined,
				page: nextPage,
				limit: nextLimit,
			});
			setItems(res.data || []);
			setTotal(res.total || 0);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Gagal memuat complaint reminder logs";
			setError(message);
			notifyError(message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, [page, limit, status, recipientType, senderType]);

	const handleApplyFilters = () => {
		if (page === 1) {
			void loadData({ page: 1 });
			return;
		}
		setPage(1);
	};

	const handleRefresh = () => {
		void loadData();
	};

	const handleResetFilters = () => {
		const shouldFetchImmediately = page === 1 && limit === 20 && status === "all" && recipientType === "all" && senderType === "all";
		setQ("");
		setOrderID("");
		setComplaintCaseID("");
		setStatus("all");
		setRecipientType("all");
		setSenderType("all");
		setPage(1);
		setLimit(20);
		if (shouldFetchImmediately) {
			void loadData({
				page: 1,
				limit: 20,
				status: "all",
				recipientType: "all",
				senderType: "all",
				orderID: "",
				complaintCaseID: "",
				q: "",
			});
		}
	};

	const visibleTotals = useMemo(() => {
		return items.reduce(
			(acc, item) => {
				const key = String(item.status || "").toLowerCase();
				if (key in acc) {
					acc[key as keyof typeof acc] += 1;
				}
				return acc;
			},
			{ queued: 0, processing: 0, retrying: 0, sent: 0, skipped: 0, failed: 0 },
		);
	}, [items]);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Complaint Reminder Logs</h1>
					<p className="mt-2 text-slate-600">Audit trail reminder complaint yang dikirim dari review plugin.</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleRefresh}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
					</button>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-xs font-semibold uppercase text-slate-500">Visible rows</div>
					<div className="mt-2 text-2xl font-bold text-slate-900">{items.length}</div>
					<div className="mt-1 text-sm text-slate-500">of {total} matching logs</div>
				</div>
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
					<div className="text-xs font-semibold uppercase text-emerald-700">Sent</div>
					<div className="mt-2 text-2xl font-bold text-emerald-700">{visibleTotals.sent}</div>
				</div>
				<div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
					<div className="text-xs font-semibold uppercase text-orange-700">Retrying</div>
					<div className="mt-2 text-2xl font-bold text-orange-700">{visibleTotals.retrying}</div>
				</div>
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
					<div className="text-xs font-semibold uppercase text-rose-700">Failed</div>
					<div className="mt-2 text-2xl font-bold text-rose-700">{visibleTotals.failed}</div>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="grid gap-4 xl:grid-cols-6">
					<div>
						<label className="block text-sm font-medium text-slate-700">Search</label>
						<input
							type="text"
							placeholder="Order, subject, email, error"
							value={q}
							onChange={(event) => setQ(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Order ID</label>
						<input
							type="text"
							placeholder="Filter by order id"
							value={orderID}
							onChange={(event) => setOrderID(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Complaint case ID</label>
						<input
							type="text"
							placeholder="Filter by complaint case id"
							value={complaintCaseID}
							onChange={(event) => setComplaintCaseID(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Status</label>
						<select
							value={status}
							onChange={(event) => setStatus(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						>
							{statusOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Recipient</label>
						<select
							value={recipientType}
							onChange={(event) => setRecipientType(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						>
							{recipientOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Sender</label>
						<select
							value={senderType}
							onChange={(event) => setSenderType(event.target.value)}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						>
							{senderOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700">Items per halaman</label>
						<select
							value={limit}
							onChange={(event) => {
								setLimit(Number(event.target.value));
								setPage(1);
							}}
							className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
						>
							<option value={10}>10</option>
							<option value={20}>20</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>
				</div>
				<div className="mt-4 flex gap-2">
					<button
						type="button"
						onClick={handleApplyFilters}
						className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
					>
						Apply filters
					</button>
					<button
						type="button"
						onClick={handleResetFilters}
						className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
					>
						Reset
					</button>
				</div>
			</div>

			{error && (
				<div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
					<AlertCircle className="h-5 w-5 text-red-600" />
					<span className="text-sm text-red-700">{error}</span>
				</div>
			)}

			<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table className="min-w-full text-sm">
					<thead className="bg-slate-50 text-left text-slate-700">
						<tr>
							<th className="px-4 py-3">Created</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Flow</th>
							<th className="px-4 py-3">Order</th>
							<th className="px-4 py-3">Complaint</th>
							<th className="px-4 py-3">Timing</th>
							<th className="px-4 py-3">Attempts</th>
							<th className="px-4 py-3">Notes</th>
							<th className="px-4 py-3">Action</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr>
								<td className="px-4 py-6 text-slate-500" colSpan={9}>
									<div className="flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading complaint reminder logs...
									</div>
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td className="px-4 py-6 text-slate-500" colSpan={9}>
									Belum ada reminder log yang cocok dengan filter.
								</td>
							</tr>
						) : (
							items.map((item) => {
								const status = statusMeta(item.status);
								return (
									<tr key={item.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
										<td className="px-4 py-4 text-xs text-slate-500">
											<div className="font-medium text-slate-700">{formatDateTime(item.created_at)}</div>
											<div className="mt-1 text-[11px] text-slate-400">Due {formatDateTime(item.due_at)}</div>
										</td>
										<td className="px-4 py-4">
											<div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}>{status.label}</div>
											<div className="mt-2 text-[11px] text-slate-500">{item.last_error ? item.last_error : item.skip_reason || item.next_run_at ? "Awaiting next action" : "-"}</div>
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div><span className="font-medium text-slate-700">From:</span> {senderMeta(item.sender_type)}</div>
											<div><span className="font-medium text-slate-700">To:</span> {recipientMeta(item.recipient_type)}</div>
											<div className="mt-1 truncate text-[11px] text-slate-400">{item.recipient_label}</div>
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div className="font-mono text-[11px] text-slate-700">{item.order_number}</div>
											<div className="mt-1 truncate text-[11px] text-slate-400">{item.order_id}</div>
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div className="max-w-xs font-medium text-slate-700">{item.complaint_subject}</div>
											<div className="mt-1 truncate text-[11px] text-slate-400">{item.complaint_case_id}</div>
											<div className="mt-1 truncate text-[11px] text-slate-400">{item.recipient_emails}</div>
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div>Expected: {formatDateTime(item.expected_last_message_at)}</div>
											<div>Sent: {formatDateTime(item.sent_at)}</div>
											<div>Skipped: {formatDateTime(item.skipped_at)}</div>
											<div>Next run: {formatDateTime(item.next_run_at)}</div>
										</td>
										<td className="px-4 py-4 text-xs text-slate-700">{item.attempt_count}</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div>Key: <span className="font-mono text-[11px] text-slate-700">{item.reminder_key}</span></div>
											<div className="mt-1 truncate">{item.last_error || item.skip_reason || "-"}</div>
										</td>
										<td className="px-4 py-4">
											<a
												href={buildComplaintThreadHref(item)}
												className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
											>
												<MessageSquareText className="h-4 w-4" />
												Open thread
												<ExternalLink className="h-3.5 w-3.5" />
											</a>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
				<p>
					Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
				</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setPage((current) => Math.max(1, current - 1))}
						disabled={page <= 1}
						className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
					>
						Prev
					</button>
					<button
						type="button"
						onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
						disabled={page >= totalPages}
						className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
					>
						Next
					</button>
				</div>
			</div>
		</div>
	);
}