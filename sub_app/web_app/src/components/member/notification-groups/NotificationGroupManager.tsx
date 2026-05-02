import { useState, useEffect } from "react";
import { notifyError } from "../../../lib/notification";
import type {
	MemberNotificationGroup,
	CreateNotificationGroupPayload,
	NotificationGroupMember,
} from "./types";
import { NOTIFICATION_EVENT_LABELS } from "./types";
import {
	listNotificationGroups,
	createNotificationGroup,
	updateNotificationGroup,
	deleteNotificationGroup,
} from "./api";
import { listBusinessTeamMembers } from "../team/api";
import type { TeamMember } from "../team/types";

interface Props {
	businessID: string;
}

const ALL_EVENTS = Object.keys(NOTIFICATION_EVENT_LABELS);
const surfaceClass = "rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm";

function memberLabel(member: TeamMember | NotificationGroupMember | null | undefined): string {
	if (!member) return "Member tidak dikenal";
	if ("user" in member && member.user) {
		const fullName = member.user.full_name.trim();
		if (fullName) return fullName;
		const email = member.user.email.trim();
		if (email) return email;
		return member.user_id;
	}
	if ("user_id" in member) {
		const fullName = member.user?.full_name?.trim();
		if (fullName) return fullName;
		const email = member.user?.email?.trim();
		if (email) return email;
		return member.user_id;
	}
	return "Member tidak dikenal";
}

function GroupFormModal({
	businessID,
	availableMembers,
	loadingMembers,
	existing,
	onClose,
	onSaved,
}: {
	businessID: string;
	availableMembers: TeamMember[];
	loadingMembers: boolean;
	existing?: MemberNotificationGroup | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [name, setName] = useState(existing?.name ?? "");
	const [memberIds, setMemberIds] = useState<string[]>(
		existing?.members?.map((member) => member.user_id).filter((value): value is string => Boolean(value)) ?? [],
	);
	const [selectedEvents, setSelectedEvents] = useState<string[]>(
		existing?.event_types ? existing.event_types.split(",").filter(Boolean) : [],
	);
	const [isActive, setIsActive] = useState(existing?.is_active ?? true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedMembers = memberIds
		.map((memberID) => availableMembers.find((member) => member.user_id === memberID))
		.filter((member): member is TeamMember => Boolean(member));

	function toggleEvent(ev: string) {
		setSelectedEvents((prev) =>
			prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
		);
	}

	function toggleMember(memberID: string) {
		setMemberIds((prev) =>
			prev.includes(memberID) ? prev.filter((id) => id !== memberID) : [...prev, memberID],
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (memberIds.length === 0) {
			setError("Pilih minimal satu member bisnis untuk grup ini");
			return;
		}
		setLoading(true);
		try {
			if (existing) {
				await updateNotificationGroup(businessID, existing.id, {
					name,
					member_ids: memberIds,
					event_types: selectedEvents,
					is_active: isActive,
				});
			} else {
				const payload: CreateNotificationGroupPayload = {
					name,
					member_ids: memberIds,
					event_types: selectedEvents,
				};
				await createNotificationGroup(businessID, payload);
			}
			onSaved();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Gagal menyimpan";
			setError(msg);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-[28px] border border-[#e6d9c7] bg-white shadow-[0_32px_96px_-48px_rgba(15,23,42,0.45)]">
				<div className="flex items-center justify-between border-b border-[#f0e6d6] px-5 py-4">
					<h2 className="text-base font-semibold">
						{existing ? "Edit Grup Notifikasi" : "Tambah Grup Notifikasi"}
					</h2>
					<button onClick={onClose} className="text-slate-400 transition hover:text-slate-600">
						✕
					</button>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4 p-5">
					{error && (
						<div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
					)}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Nama Grup
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							placeholder="Contoh: Tim Finance"
							className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
					</div>
					<div>
						<div className="mb-2 flex items-center justify-between gap-3">
							<label className="block text-sm font-medium text-slate-700">
								Pilih Member Bisnis
							</label>
							<span className="text-xs text-slate-500">{memberIds.length} dipilih</span>
						</div>
						<div className="rounded-[24px] border border-[#ece3d5] bg-[#fcfbf8] p-3">
							{loadingMembers ? (
								<p className="text-sm text-slate-500">Memuat daftar member...</p>
							) : availableMembers.length === 0 ? (
								<p className="text-sm text-slate-500">
									Tidak ada member aktif yang bisa dipilih untuk bisnis ini.
								</p>
							) : (
								<div className="max-h-56 space-y-2 overflow-auto pr-1">
									{availableMembers.map((member) => {
										const checked = memberIds.includes(member.user_id);
										return (
											<label
												key={member.user_id}
												className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
													checked ? "border-emerald-300 bg-emerald-50" : "border-[#e5ded3] bg-white hover:bg-[#f8f6f2]"
												}`}
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={() => toggleMember(member.user_id)}
													className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
												/>
												<div className="min-w-0">
													<p className="font-medium text-slate-900">{member.user?.full_name?.trim() || member.user?.email?.trim() || member.user_id}</p>
													<p className="text-xs text-slate-500">{member.user?.email?.trim() || member.user_id}</p>
												</div>
											</label>
										);
									})}
								</div>
							)}
						</div>
						{selectedMembers.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{selectedMembers.slice(0, 4).map((member) => (
									<span key={member.user_id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
										{member.user?.full_name?.trim() || member.user?.email?.trim() || member.user_id}
									</span>
								))}
								{selectedMembers.length > 4 && (
									<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
										+{selectedMembers.length - 4} lainnya
									</span>
								)}
							</div>
						)}
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-slate-700">
							Jenis Notifikasi{" "}
							<span className="font-normal text-slate-400">(kosong = semua)</span>
						</label>
						<div className="space-y-2">
							{ALL_EVENTS.map((ev) => (
								<label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={selectedEvents.includes(ev)}
										onChange={() => toggleEvent(ev)}
										className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
									<span className="text-slate-700">{NOTIFICATION_EVENT_LABELS[ev]}</span>
								</label>
							))}
						</div>
					</div>
					{existing && (
						<div>
							<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
								<input
									type="checkbox"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
								/>
								<span>Aktif</span>
							</label>
						</div>
					)}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#f2ede5]"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{loading ? "Menyimpan..." : "Simpan"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function NotificationGroupManager({ businessID }: Props) {
	const [groups, setGroups] = useState<MemberNotificationGroup[]>([]);
	const [availableMembers, setAvailableMembers] = useState<TeamMember[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMembers, setLoadingMembers] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [editing, setEditing] = useState<MemberNotificationGroup | null>(null);
	const [deletingID, setDeletingID] = useState<number | null>(null);

	async function load() {
		setLoading(true);
		try {
			const data = await listNotificationGroups(businessID);
			setGroups(data);
		} finally {
			setLoading(false);
		}
	}

	async function loadMembers() {
		setLoadingMembers(true);
		try {
			const res = await listBusinessTeamMembers(businessID, { status: "active", page: 1, limit: 500 });
			setAvailableMembers(res.data ?? []);
		} catch (error) {
			setAvailableMembers([]);
			notifyError(error instanceof Error ? error.message : "Gagal memuat daftar member bisnis");
		} finally {
			setLoadingMembers(false);
		}
	}

	useEffect(() => {
		load();
	}, [businessID]);

	useEffect(() => {
		loadMembers();
	}, [businessID]);

	async function handleDelete(id: number) {
		if (!confirm("Hapus grup notifikasi ini?")) return;
		setDeletingID(id);
		try {
			await deleteNotificationGroup(businessID, id);
			setGroups((prev) => prev.filter((g) => g.id !== id));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Gagal menghapus";
			alert(msg);
		} finally {
			setDeletingID(null);
		}
	}

	function handleEdit(g: MemberNotificationGroup) {
		setEditing(g);
		setShowModal(true);
	}

	function handleAdd() {
		setEditing(null);
		setShowModal(true);
	}

	function renderEventBadges(eventTypes: string) {
		const events = eventTypes.split(",").filter(Boolean);
		if (events.length === 0) {
			return (
				<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
					Semua notifikasi
				</span>
			);
		}
		return (
			<div className="flex flex-wrap gap-1">
				{events.map((ev) => (
					<span
						key={ev}
						className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
					>
						{NOTIFICATION_EVENT_LABELS[ev] ?? ev}
					</span>
				))}
			</div>
		);
	}

	return (
		<div>
			<div className={`${surfaceClass} mb-4 p-5`}>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-2xl">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Grup Notifikasi Bisnis</p>
						<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Kelola penerima notifikasi bisnis</h2>
						<p className="mt-2 text-sm leading-6 text-slate-600">
							Pilih member bisnis yang akan menerima notifikasi event tertentu, lalu atur status aktifnya di satu tempat.
						</p>
					</div>
				<button
					onClick={handleAdd}
					disabled={loadingMembers || availableMembers.length === 0}
					className="rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					+ Tambah Grup
				</button>
				</div>
			</div>

			{loading ? (
				<div className="rounded-[24px] border border-dashed border-[#e0d6c6] bg-[#fcfbf8] py-8 text-center text-sm text-slate-400">Memuat...</div>
			) : groups.length === 0 ? (
				<div className="rounded-[24px] border border-dashed border-[#e0d6c6] bg-[#fcfbf8] py-10 text-center">
					<p className="text-sm text-slate-500">Belum ada grup notifikasi.</p>
					<button
						onClick={handleAdd}
						className="mt-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
					>
						Tambah sekarang
					</button>
				</div>
			) : (
				<div className="divide-y divide-[#f0e6d6] overflow-hidden rounded-[28px] border border-[#ece3d5] bg-[#fcfbf8]">
					{groups.map((g) => (
						<div key={g.id} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold text-slate-900">{g.name}</span>
									{!g.is_active && (
										<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
											Nonaktif
										</span>
									)}
								</div>
								<div className="mt-0.5 text-sm text-slate-500">
									{g.members?.length ? `${g.members.length} member dipilih` : "Belum ada member dipilih"}
								</div>
								{g.members?.length ? (
									<div className="mt-1 flex flex-wrap gap-1.5">
										{g.members.slice(0, 3).map((member) => (
											<span key={member.id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
												{memberLabel(member)}
											</span>
										))}
										{g.members.length > 3 && (
											<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
												+{g.members.length - 3} lainnya
											</span>
										)}
									</div>
								) : null}
								<div className="mt-1.5">{renderEventBadges(g.event_types)}</div>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<button
									onClick={() => handleEdit(g)}
									className="rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
								>
									Edit
								</button>
								<button
									onClick={() => handleDelete(g.id)}
									disabled={deletingID === g.id}
									className="rounded-full px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Hapus
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{showModal && (
				<GroupFormModal
					businessID={businessID}
					availableMembers={availableMembers}
					loadingMembers={loadingMembers}
					existing={editing}
					onClose={() => setShowModal(false)}
					onSaved={load}
				/>
			)}
		</div>
	);
}
