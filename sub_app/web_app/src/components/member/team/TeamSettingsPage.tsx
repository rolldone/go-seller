import { useCallback, useEffect, useMemo, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import MemberModal from "../ui/MemberModal";
import { deleteBusinessTeamMember, inviteBusinessTeamMember, listBusinessTeamMembers, updateBusinessTeamMemberRole, updateBusinessTeamMemberStatus } from "./api";
import type { TeamInvitePayload, TeamInviteRole, TeamListResponse, TeamMember, TeamMemberStatus, TeamRolePayload } from "./types";

const TEAM_ROLE_OPTIONS: Array<{ value: TeamInviteRole; label: string; description: string }> = [
	{ value: "fulfillment", label: "Tim Fulfillment", description: "Mengurus shipment, packing, dan barang yang bisa dikirim." },
	{ value: "finance", label: "Tim Finance", description: "Mengurus biaya tambahan, verifikasi pembayaran, dan hal operasional keuangan." },
	{ value: "cs", label: "Tim CS", description: "Mengurus koordinasi pelanggan dan perubahan alamat/catatan operasional." },
];

const TEAM_ROLE_LABELS: Record<TeamInviteRole, string> = TEAM_ROLE_OPTIONS.reduce((accumulator, option) => {
	accumulator[option.value] = option.label;
	return accumulator;
}, {} as Record<TeamInviteRole, string>);

type InviteFormState = {
	email: string;
	role: TeamInviteRole | "";
};

const emptyInviteForm: InviteFormState = {
	email: "",
	role: "",
};

function normalizeTeamRole(role?: string | null) {
	const normalized = String(role || "").trim().toLowerCase();
	if (normalized === "fulfillment" || normalized === "finance" || normalized === "cs") {
		return normalized as TeamInviteRole;
	}
	return "";
}

const statusOptions: Array<{ value: TeamMemberStatus | "all"; label: string }> = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Active" },
	{ value: "invited", label: "Invited" },
	{ value: "suspended", label: "Suspended" },
];

function normalizeStatus(value?: string | null): TeamMemberStatus | "all" {
	const normalized = String(value || "").trim().toLowerCase();
	if (normalized === "active" || normalized === "invited" || normalized === "suspended") return normalized;
	return "all";
}

function statusLabel(status?: string | null) {
	const normalized = normalizeStatus(status);
	if (normalized === "active") return "Active";
	if (normalized === "invited") return "Invited";
	if (normalized === "suspended") return "Suspended";
	return "Unknown";
}

function statusTone(status?: string | null) {
	const normalized = normalizeStatus(status);
	if (normalized === "active") return "bg-emerald-100 text-emerald-700";
	if (normalized === "invited") return "bg-amber-100 text-amber-700";
	if (normalized === "suspended") return "bg-rose-100 text-rose-700";
	return "bg-slate-100 text-slate-700";
}

function formatDate(value?: string | null) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return date.toLocaleString();
}

function formatBusinessOptionLabel(business: Business) {
	return business.member_invited ? `${business.name} / ${business.slug} (diundang)` : `${business.name} / ${business.slug}`;
}

export default function TeamSettingsPage() {
	const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/en/") ? "en" : "id";
	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [members, setMembers] = useState<TeamMember[]>([]);
	const [total, setTotal] = useState(0);
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);
	const [loadingMembers, setLoadingMembers] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [businessError, setBusinessError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [statusFilter, setStatusFilter] = useState<TeamMemberStatus | "all">("all");
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteForm, setInviteForm] = useState<InviteFormState>(emptyInviteForm);
	const [inviteSubmitting, setInviteSubmitting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteSubmitting, setDeleteSubmitting] = useState(false);
	const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
	const [roleDrafts, setRoleDrafts] = useState<Record<string, TeamInviteRole | "">>({});
	const [roleSavingMemberID, setRoleSavingMemberID] = useState("");
	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
	const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessID) || null, [businesses, selectedBusinessID]);

	const syncQuery = useCallback((businessID: string, status: string) => {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		if (businessID) url.searchParams.set("business_id", businessID);
		else url.searchParams.delete("business_id");
		if (status && status !== "all") url.searchParams.set("status", status);
		else url.searchParams.delete("status");
		if (page > 1) url.searchParams.set("page", String(page));
		else url.searchParams.delete("page");
		if (limit !== 20) url.searchParams.set("limit", String(limit));
		else url.searchParams.delete("limit");
		window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
	}, [limit, page]);

	const loadBusinesses = useCallback(async () => {
		setLoadingBusinesses(true);
		setBusinessError(null);
		try {
			const res = await memberGet<BusinessListResponse>("/api/member/businesses?page=1&limit=500");
			const items = res.data || [];
			setBusinesses(items);
			setSelectedBusinessID((current) => current || items[0]?.id || "");
		} catch (err) {
			setBusinesses([]);
			setBusinessError(err instanceof Error ? err.message : "Gagal memuat toko");
		} finally {
			setLoadingBusinesses(false);
		}
	}, []);

	const loadMembers = useCallback(async () => {
		if (!selectedBusinessID) {
			setMembers([]);
			setTotal(0);
			setLoadingMembers(false);
			return;
		}

		setLoadingMembers(true);
		setError(null);
		try {
			const res = await listBusinessTeamMembers(selectedBusinessID, { status: statusFilter, page, limit });
			setMembers(res.data || []);
			setTotal(res.total || 0);
			setRoleDrafts(
				(res.data || []).reduce((accumulator, member) => {
					accumulator[member.id] = normalizeTeamRole(member.role) || "";
					return accumulator;
				}, {} as Record<string, TeamInviteRole | "">),
			);
		} catch (err) {
			setMembers([]);
			setTotal(0);
			setError(err instanceof Error ? err.message : "Gagal memuat team members");
		} finally {
			setLoadingMembers(false);
		}
	}, [limit, page, selectedBusinessID, statusFilter]);

	useEffect(() => {
		void loadBusinesses();
	}, [loadBusinesses]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const businessID = params.get("business_id")?.trim() || "";
		const status = normalizeStatus(params.get("status"));
		const pageValue = Number(params.get("page") || "1");
		const limitValue = Number(params.get("limit") || "20");
		if (businessID) setSelectedBusinessID(businessID);
		setStatusFilter(status);
		if (Number.isFinite(pageValue) && pageValue > 0) setPage(pageValue);
		if (Number.isFinite(limitValue) && limitValue > 0) setLimit(limitValue);
	}, []);

	useEffect(() => {
		void loadMembers();
		syncQuery(selectedBusinessID, statusFilter);
	}, [loadMembers, selectedBusinessID, statusFilter, syncQuery]);

	const handleOpenInvite = () => {
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setInviteForm(emptyInviteForm);
		setInviteOpen(true);
	};

	const handleRoleChange = async (member: TeamMember) => {
		if (!selectedBusinessID) return;
		if (member.is_owner) {
			notifyError("Owner role tidak bisa diubah");
			return;
		}
		const nextRole = roleDrafts[member.id];
		if (!nextRole) {
			notifyError("Role wajib dipilih");
			return;
		}
		setRoleSavingMemberID(member.id);
		try {
			const payload: TeamRolePayload = { role: nextRole };
			await updateBusinessTeamMemberRole(selectedBusinessID, member.id, payload);
			notifySuccess("Role member diperbarui");
			await loadMembers();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memperbarui role member");
		} finally {
			setRoleSavingMemberID("");
		}
	};

	const handleInviteSubmit = async () => {
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		const email = inviteForm.email.trim().toLowerCase();
		if (!email) {
			notifyError("Email wajib diisi");
			return;
		}
		if (!inviteForm.role) {
			notifyError("Role wajib dipilih");
			return;
		}
		setInviteSubmitting(true);
		try {
			const payload: TeamInvitePayload = {
				email,
				role: inviteForm.role,
			};
			await inviteBusinessTeamMember(selectedBusinessID, payload);
			notifySuccess("Member diundang");
			setInviteOpen(false);
			await loadMembers();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal mengundang member");
		} finally {
			setInviteSubmitting(false);
		}
	};

	const promptReason = (member: TeamMember, nextStatus: TeamMemberStatus) => {
		if (typeof window === "undefined") return "";
		if (nextStatus === "suspended") {
			return window.prompt(`Reason for suspending ${member.user?.full_name || member.user?.email || member.id}?`, member.suspension_reason || "") || "";
		}
		return member.suspension_reason || "";
	};

	const handleStatusChange = async (member: TeamMember, nextStatus: TeamMemberStatus) => {
		if (!selectedBusinessID) return;
		if (member.is_owner) {
			notifyError("Owner member tidak bisa diubah statusnya");
			return;
		}
		const reason = promptReason(member, nextStatus);
		if (nextStatus === "suspended" && typeof window !== "undefined") {
			const confirmed = window.confirm("Suspend member ini?");
			if (!confirmed) return;
		}
		if (nextStatus === "active" && typeof window !== "undefined") {
			const confirmed = window.confirm("Activate member ini?");
			if (!confirmed) return;
		}
		if (nextStatus === "invited" && typeof window !== "undefined") {
			const confirmed = window.confirm("Kirim ulang undangan member ini?");
			if (!confirmed) return;
		}
		try {
			await updateBusinessTeamMemberStatus(selectedBusinessID, member.id, { status: nextStatus, reason: reason || null });
			notifySuccess("Status member diperbarui");
			await loadMembers();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memperbarui status member");
		}
	};

	const handleDelete = async () => {
		if (!selectedBusinessID || !selectedMember) return;
		setDeleteSubmitting(true);
		try {
			await deleteBusinessTeamMember(selectedBusinessID, selectedMember.id);
			notifySuccess("Member dihapus dari team");
			setDeleteOpen(false);
			setSelectedMember(null);
			await loadMembers();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus member");
		} finally {
			setDeleteSubmitting(false);
		}
	};

	const resolveMemberName = (member: TeamMember) => member.user?.full_name || member.user?.email || member.user_id;
	const resolveMemberRoleLabel = (role?: string | null) => {
		const normalized = normalizeTeamRole(role);
		if (normalized) {
			return TEAM_ROLE_LABELS[normalized];
		}
		return role?.trim() || "-";
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Team Settings</h3>
					<p className="text-sm text-slate-600">Invite, suspend, dan remove member yang punya akses ke business.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<a href={buildLocalizedPath("/member/businesses", locale)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Back to Businesses
					</a>
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
							{[10, 20, 50].map((value) => (
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
								<th className="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{loadingMembers ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={5}>
										Loading team members...
									</td>
								</tr>
							) : members.length === 0 ? (
								<tr>
									<td className="px-4 py-4 text-slate-500" colSpan={5}>
										No team members yet.
									</td>
								</tr>
							) : (
								members.map((member) => (
									<tr key={member.id} className="border-t border-slate-100 align-top">
										<td className="px-4 py-4">
											<div className="font-medium text-slate-900">{resolveMemberName(member)}</div>
											<div className="text-xs text-slate-500">{member.user?.email || member.user_id}</div>
											{member.user?.phone_number ? <div className="text-xs text-slate-500">{member.user.phone_number}</div> : null}
											{member.is_owner ? <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Owner</div> : null}
										</td>
										<td className="px-4 py-4 text-slate-700">
											{member.is_owner ? (
												resolveMemberRoleLabel(member.role)
											) : (
												<div className="space-y-2 min-w-[180px]">
													<select
														className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
														value={roleDrafts[member.id] || ""}
														onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: normalizeTeamRole(event.target.value) }))}
													>
														<option value="">Pilih role</option>
														{TEAM_ROLE_OPTIONS.map((option) => (
															<option key={option.value} value={option.value} title={option.description}>
																{option.label}
															</option>
														))}
													</select>
													<button
														type="button"
														onClick={() => void handleRoleChange(member)}
														disabled={roleSavingMemberID === member.id || !roleDrafts[member.id]}
														className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														{roleSavingMemberID === member.id ? "Saving..." : "Save role"}
													</button>
												</div>
											)}
										</td>
										<td className="px-4 py-4">
											<div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(member.status)}`}>{statusLabel(member.status)}</div>
											{member.suspension_reason ? <div className="mt-2 max-w-xs text-xs text-slate-500">{member.suspension_reason}</div> : null}
										</td>
										<td className="px-4 py-4 text-xs text-slate-500">
											<div>Invited: {formatDate(member.invited_at)}</div>
											<div>Status changed: {formatDate(member.status_changed_at)}</div>
											{member.suspended_at ? <div>Suspended: {formatDate(member.suspended_at)}</div> : null}
										</td>
										<td className="px-4 py-4 text-right">
											{member.is_owner ? (
												<div className="text-xs text-slate-400">No actions</div>
											) : (
												<div className="flex flex-wrap justify-end gap-2">
													{member.status !== "invited" ? (
														<button type="button" onClick={() => void handleStatusChange(member, "invited")} className="rounded bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200">
															Reinvite
														</button>
													) : null}
													{member.status !== "active" ? (
														<button type="button" onClick={() => void handleStatusChange(member, "active")} className="rounded bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200">
															Activate
														</button>
													) : (
														<button type="button" onClick={() => void handleStatusChange(member, "suspended")} className="rounded bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200">
															Suspend
														</button>
													)}
													<button type="button" onClick={() => {
														setSelectedMember(member);
														setDeleteOpen(true);
													}} className="rounded bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
														Remove
														</button>
												</div>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			) : (
				<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Pilih business dulu untuk melihat team member.</div>
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

			<MemberModal
				open={inviteOpen}
				onClose={() => setInviteOpen(false)}
				title="Invite Team Member"
				maxWidth="lg"
				footer={
					<>
						<button type="button" onClick={() => setInviteOpen(false)} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
							Cancel
						</button>
						<button type="button" onClick={() => void handleInviteSubmit()} disabled={inviteSubmitting} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70">
							{inviteSubmitting ? "Inviting..." : "Invite"}
						</button>
					</>
				}
			>
				<div className="space-y-4">
					<p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						Email harus sudah terdaftar sebagai user member. Kalau belum ada user-nya, backend akan menolak undangan.
					</p>
					<div className="grid gap-3">
						<label className="space-y-1 text-sm">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
							<input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="member@example.com" />
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
							<select
								className="w-full rounded-lg border border-slate-300 px-3 py-2"
								value={inviteForm.role}
								onChange={(event) => setInviteForm((current) => ({ ...current, role: normalizeTeamRole(event.target.value) }))}
							>
								<option value="">Pilih role</option>
								{TEAM_ROLE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value} title={option.description}>
										{option.label}
									</option>
								))}
							</select>
							<p className="text-xs text-slate-500">Role sudah ditentukan: Tim Fulfillment, Tim Finance, dan Tim CS.</p>
						</label>
					</div>
				</div>
			</MemberModal>

			<EntityDeleteModal
				open={deleteOpen}
				title="Team Member"
				itemName={selectedMember ? resolveMemberName(selectedMember) : ""}
				description={`Remove ${selectedMember ? resolveMemberName(selectedMember) : "member ini"} from this team?`}
				submitting={deleteSubmitting}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDelete}
			/>
		</div>
	);
}