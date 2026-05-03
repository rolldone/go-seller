import { useEffect, useMemo, useState } from "react";

import { notifyError } from "../../../lib/notification";
import { adminGet } from "../entities/adminApi";
import BusinessInviteModal from "./BusinessInviteModal";
import BusinessTeamAuditModal from "./BusinessTeamAuditModal";
import type { Business } from "./types";

type BusinessListResponse = {
	data?: Business[];
	total?: number;
};

type BusinessMemberUser = {
	id: string;
	full_name: string;
	email: string;
	phone_number?: string | null;
};

type BusinessMember = {
	id: string;
	business_id: string;
	user_id: string;
	is_owner: boolean;
	role?: string | null;
	status: string;
	invited_at?: string | null;
	status_changed_at?: string | null;
	suspended_at?: string | null;
	suspension_reason?: string | null;
	invited_by?: string | null;
	created_at: string;
	updated_at: string;
	user?: BusinessMemberUser | null;
};

type BusinessMembersResponse = {
	data?: BusinessMember[];
	total?: number;
};

const perPageOptions = [10, 20, 50];

const statusOptions: Array<{ value: string; label: string }> = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Active" },
	{ value: "invited", label: "Invited" },
	{ value: "suspended", label: "Suspended" },
];

const formatBusinessOptionLabel = (business: Business) => `${business.name} / ${business.slug}`;

const formatDate = (value?: string | null) => {
	if (!value) return "-";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
};

const normalizeStatus = (value?: string | null) => {
	const normalized = String(value || "").trim().toLowerCase();
	if (normalized === "active" || normalized === "invited" || normalized === "suspended") return normalized;
	return "all";
};

const statusLabel = (status?: string | null) => {
	const normalized = normalizeStatus(status);
	if (normalized === "active") return "Active";
	if (normalized === "invited") return "Invited";
	if (normalized === "suspended") return "Suspended";
	return "Unknown";
};

const statusTone = (status?: string | null) => {
	const normalized = normalizeStatus(status);
	if (normalized === "active") return "bg-emerald-100 text-emerald-700";
	if (normalized === "invited") return "bg-amber-100 text-amber-700";
	if (normalized === "suspended") return "bg-rose-100 text-rose-700";
	return "bg-slate-100 text-slate-700";
};

export default function BusinessMembersPage() {
	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [members, setMembers] = useState<BusinessMember[]>([]);
	const [total, setTotal] = useState(0);
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);
	const [loadingMembers, setLoadingMembers] = useState(true);
	const [businessError, setBusinessError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteBusiness, setInviteBusiness] = useState<Business | null>(null);
	const [auditOpen, setAuditOpen] = useState(false);
	const [auditBusiness, setAuditBusiness] = useState<Business | null>(null);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
	const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessID) || null, [businesses, selectedBusinessID]);

	const loadBusinesses = async () => {
		setLoadingBusinesses(true);
		setBusinessError(null);
		try {
			const res = await adminGet<BusinessListResponse>("/admin/catalog/businesses?page=1&limit=500");
			const nextBusinesses = res.data || [];
			setBusinesses(nextBusinesses);
			if (!selectedBusinessID) {
				setSelectedBusinessID(nextBusinesses[0]?.id || "");
			}
		} catch (err) {
			setBusinesses([]);
			setBusinessError(err instanceof Error ? err.message : "Gagal memuat business");
		} finally {
			setLoadingBusinesses(false);
		}
	};

	const loadMembers = async () => {
		if (!selectedBusinessID) {
			setMembers([]);
			setTotal(0);
			setLoadingMembers(false);
			return;
		}

		setLoadingMembers(true);
		setError(null);
		try {
			const query = new URLSearchParams();
			if (statusFilter !== "all") query.set("status", statusFilter);
			query.set("page", String(page));
			query.set("limit", String(limit));
			const res = await adminGet<BusinessMembersResponse>(`/admin/catalog/businesses/${encodeURIComponent(selectedBusinessID)}/team/members?${query.toString()}`);
			setMembers(res.data || []);
			setTotal(res.total || 0);
		} catch (err) {
			setMembers([]);
			setTotal(0);
			setError(err instanceof Error ? err.message : "Gagal memuat business members");
		} finally {
			setLoadingMembers(false);
		}
	};

	useEffect(() => {
		void loadBusinesses();
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const businessID = params.get("business_id")?.trim() || "";
		const pageValue = Number(params.get("page") || "1");
		const limitValue = Number(params.get("limit") || "20");
		const status = normalizeStatus(params.get("status"));
		if (businessID) setSelectedBusinessID(businessID);
		if (Number.isFinite(pageValue) && pageValue > 0) setPage(pageValue);
		if (Number.isFinite(limitValue) && limitValue > 0) setLimit(limitValue);
		setStatusFilter(status);
	}, []);

	useEffect(() => {
		void loadMembers();
	}, [page, limit, selectedBusinessID, statusFilter]);

	const handleOpenInvite = () => {
		if (!selectedBusiness) {
			notifyError("Pilih business dulu");
			return;
		}
		setInviteBusiness(selectedBusiness);
		setInviteOpen(true);
	};

	const handleOpenAudit = () => {
		if (!selectedBusiness) {
			notifyError("Pilih business dulu");
			return;
		}
		setAuditBusiness(selectedBusiness);
		setAuditOpen(true);
	};

	const handleInviteSaved = async () => {
		await loadMembers();
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Business Members</h3>
					<p className="text-sm text-slate-600">Lihat anggota business, status undangan, dan member aktif.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<a href="/admin/businesses" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Back to Businesses
					</a>
					<button type="button" onClick={handleOpenAudit} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" disabled={!selectedBusinessID}>
						Audit Log
					</button>
					<button type="button" onClick={handleOpenInvite} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" disabled={!selectedBusinessID}>
						+ Invite Member
					</button>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-[2fr_1fr_160px]">
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Business</span>
						<select
							className="w-full rounded-lg border border-slate-300 px-3 py-2"
							value={selectedBusinessID}
							onChange={(event) => {
								setPage(1);
								setSelectedBusinessID(event.target.value);
							}}
							disabled={loadingBusinesses || businesses.length === 0}
						>
							<option value="">{loadingBusinesses ? "Loading businesses..." : "Select business"}</option>
							{businesses.map((business) => (
								<option key={business.id} value={business.id}>
									{formatBusinessOptionLabel(business)}
								</option>
							))}
						</select>
					</label>

					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Status filter</span>
						<select
							className="w-full rounded-lg border border-slate-300 px-3 py-2"
							value={statusFilter}
							onChange={(event) => {
								setPage(1);
								setStatusFilter(normalizeStatus(event.target.value));
							}}
						>
							{statusOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Page size</span>
						<select
							className="w-full rounded-lg border border-slate-300 px-3 py-2"
							value={limit}
							onChange={(event) => {
								setPage(1);
								setLimit(Number(event.target.value));
							}}
						>
							{perPageOptions.map((value) => (
								<option key={value} value={value}>
									{value} / page
								</option>
							))}
						</select>
					</label>
				</div>
				<div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
					Selected target: <span className="font-medium text-slate-900">{selectedBusiness ? formatBusinessOptionLabel(selectedBusiness) : selectedBusinessID || "-"}</span>
				</div>
			</div>

			{businessError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{businessError}</div> : null}
			{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

			{selectedBusinessID ? (
				<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
					<table className="min-w-full text-sm">
						<thead className="bg-slate-50 text-left text-slate-700">
							<tr>
								<th className="px-4 py-3">Member</th>
								<th className="px-4 py-3">Role</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Timestamps</th>
							</tr>
						</thead>
						<tbody>
							{loadingMembers ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={4}>
										Loading business members...
									</td>
								</tr>
							) : members.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={4}>
										No business members yet.
									</td>
								</tr>
							) : (
								members.map((member) => (
									<tr key={member.id} className="border-t border-slate-100 align-top">
										<td className="px-4 py-4">
											<div className="font-medium text-slate-900">{member.user?.full_name || member.user?.email || member.user_id}</div>
											<div className="text-xs text-slate-500">{member.user?.email || member.user_id}</div>
											{member.user?.phone_number ? <div className="text-xs text-slate-500">{member.user.phone_number}</div> : null}
											{member.is_owner ? <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Owner</div> : null}
										</td>
										<td className="px-4 py-4 text-slate-700">{member.role?.trim() || "-"}</td>
										<td className="px-4 py-4">
											<div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(member.status)}`}>{statusLabel(member.status)}</div>
											{member.suspension_reason ? <div className="mt-2 max-w-xs text-xs text-slate-500">{member.suspension_reason}</div> : null}
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div>Invited: {formatDate(member.invited_at)}</div>
											<div>Status changed: {formatDate(member.status_changed_at)}</div>
											{member.suspended_at ? <div>Suspended: {formatDate(member.suspended_at)}</div> : null}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			) : (
				<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Pilih business dulu untuk melihat daftar member.</div>
			)}

			<div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
				<span>
					Showing <span className="font-medium text-slate-900">{members.length}</span> of <span className="font-medium text-slate-900">{total}</span> members
				</span>
				<div className="flex items-center gap-2">
					<button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-40">
						Prev
					</button>
					<span>
						Page {page} / {totalPages}
					</span>
					<button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-40">
						Next
					</button>
				</div>
			</div>

			<BusinessInviteModal
				open={inviteOpen}
				business={inviteBusiness}
				onClose={() => {
					setInviteOpen(false);
					setInviteBusiness(null);
				}}
				onSaved={handleInviteSaved}
			/>

			<BusinessTeamAuditModal
				open={auditOpen}
				business={auditBusiness}
				onClose={() => {
					setAuditOpen(false);
					setAuditBusiness(null);
				}}
			/>
		</div>
	);
}