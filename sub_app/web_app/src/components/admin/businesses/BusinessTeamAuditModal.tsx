/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { notifyError } from "../../../lib/notification";
import { adminGet } from "../entities/adminApi";
import AdminModal from "../ui/AdminModal";
import type { Business } from "./types";

type BusinessTeamAudit = {
	id: string;
	business_id: string;
	business_member_id?: string | null;
	target_user_id?: string | null;
	target_email?: string | null;
	actor_type: "admin" | "member" | string;
	actor_id?: string | null;
	action: "invite" | "accept" | "status" | "role" | "remove" | string;
	status_from?: string | null;
	status_to?: string | null;
	role_from?: string | null;
	role_to?: string | null;
	notes?: string | null;
	created_at: string;
};

type AuditListResponse = {
	data?: BusinessTeamAudit[];
	total?: number;
	page?: number;
	limit?: number;
};

type Props = {
	open: boolean;
	business: Business | null;
	onClose: () => void;
};

const actionLabelMap: Record<string, string> = {
	invite: "Invite",
	accept: "Accept",
	status: "Status change",
	role: "Role change",
	remove: "Remove member",
};

const formatDate = (value?: string | null) => {
	if (!value) return "-";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
};

const formatActor = (audit: BusinessTeamAudit) => {
	if (!audit.actor_id) return audit.actor_type || "-";
	return `${audit.actor_type || "actor"} / ${audit.actor_id.slice(0, 8)}`;
};

const formatTarget = (audit: BusinessTeamAudit) => {
	if (audit.target_email) return audit.target_email;
	if (audit.target_user_id) return audit.target_user_id;
	if (audit.business_member_id) return audit.business_member_id;
	return "-";
};

const formatChange = (audit: BusinessTeamAudit) => {
	const fragments: string[] = [];
	if (audit.status_from || audit.status_to) {
		fragments.push(`status: ${audit.status_from || "-"} -> ${audit.status_to || "-"}`);
	}
	if (audit.role_from || audit.role_to) {
		fragments.push(`role: ${audit.role_from || "-"} -> ${audit.role_to || "-"}`);
	}
	return fragments.length > 0 ? fragments.join(" | ") : "-";
};

export default function BusinessTeamAuditModal({ open, business, onClose }: Props) {
	const [audits, setAudits] = useState<BusinessTeamAudit[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit] = useState(20);
	const [total, setTotal] = useState(0);

	useEffect(() => {
		if (!open || !business) {
			setAudits([]);
			setError(null);
			setPage(1);
			setTotal(0);
			return;
		}

		let cancelled = false;

		const loadAudits = async () => {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({ page: String(page), limit: String(limit) });
				const res = await adminGet<AuditListResponse>(
					`/admin/catalog/businesses/${encodeURIComponent(business.id)}/team/audits?${params.toString()}`,
				);
				if (cancelled) return;
				setAudits(res.data || []);
				setTotal(res.total || 0);
			} catch (err) {
				if (!cancelled) {
					setAudits([]);
					setTotal(0);
					setError(err instanceof Error ? err.message : "Gagal memuat audit log");
					notifyError(err instanceof Error ? err.message : "Gagal memuat audit log");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		loadAudits();

		return () => {
			cancelled = true;
		};
	}, [business, limit, open, page]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return (
		<AdminModal
			open={open && !!business}
			onClose={onClose}
			title={`Business Audit${business ? ` - ${business.name}` : ""}`}
			maxWidth="xl"
			footer={
				<>
					<div className="flex items-center gap-2 text-sm text-slate-600">
						<span>
							Page {page} / {totalPages}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setPage((current) => Math.max(1, current - 1))}
							disabled={page <= 1 || loading}
							className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
						>
							Prev
						</button>
						<button
							type="button"
							onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
							disabled={page >= totalPages || loading}
							className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
						>
							Next
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
						>
							Close
						</button>
					</div>
				</>
			}
		>
			<div className="space-y-4">
				<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<div className="text-sm font-semibold text-slate-900">{business?.name || "Business"}</div>
					<div className="text-xs text-slate-500">/{business?.slug || ""}</div>
					<p className="mt-2 text-sm text-slate-600">Audit trail untuk invite, perubahan role, perubahan status, dan penghapusan member.</p>
				</div>

				{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

				<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full text-sm">
						<thead className="bg-slate-50 text-left text-slate-700">
							<tr>
								<th className="px-4 py-3">When</th>
								<th className="px-4 py-3">Action</th>
								<th className="px-4 py-3">Actor</th>
								<th className="px-4 py-3">Target</th>
								<th className="px-4 py-3">Changes</th>
								<th className="px-4 py-3">Notes</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={6}>
										Loading audit log...
									</td>
								</tr>
							) : audits.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={6}>
										No audit entries yet.
									</td>
								</tr>
							) : (
								audits.map((audit) => (
									<tr key={audit.id} className="border-t border-slate-100 align-top">
										<td className="px-4 py-4 text-xs text-slate-500">{formatDate(audit.created_at)}</td>
										<td className="px-4 py-4 text-slate-700">{actionLabelMap[audit.action] || audit.action}</td>
										<td className="px-4 py-4 text-xs text-slate-500">{formatActor(audit)}</td>
										<td className="px-4 py-4 text-xs text-slate-500">{formatTarget(audit)}</td>
										<td className="px-4 py-4 text-xs text-slate-500">{formatChange(audit)}</td>
										<td className="px-4 py-4 text-xs text-slate-500">{audit.notes || "-"}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="text-xs text-slate-500">
					Showing <span className="font-medium text-slate-900">{audits.length}</span> of <span className="font-medium text-slate-900">{total}</span> audit entries.
				</div>
			</div>
		</AdminModal>
	);
}