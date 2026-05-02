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
			<div className="w-full max-w-md rounded-lg bg-white shadow-xl">
				<div className="flex items-center justify-between border-b px-5 py-4">
					<h2 className="text-base font-semibold">
						{existing ? "Edit Grup Notifikasi" : "Tambah Grup Notifikasi"}
					</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600">
						✕
					</button>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4 p-5">
					{error && (
						<div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
					)}
					<div>
						<label className="mb-1 block text-sm font-medium text-gray-700">
							Nama Grup
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							placeholder="Contoh: Tim Finance"
							className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<div className="mb-2 flex items-center justify-between gap-3">
							<label className="block text-sm font-medium text-gray-700">
								Pilih Member Bisnis
							</label>
							<span className="text-xs text-gray-500">{memberIds.length} dipilih</span>
						</div>
						<div className="rounded-md border border-gray-200 bg-gray-50 p-3">
							{loadingMembers ? (
								<p className="text-sm text-gray-500">Memuat daftar member...</p>
							) : availableMembers.length === 0 ? (
								<p className="text-sm text-gray-500">
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
													checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
												}`}
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={() => toggleMember(member.user_id)}
													className="mt-0.5 rounded border-gray-300 text-blue-600"
												/>
												<div className="min-w-0">
													<p className="font-medium text-gray-900">{member.user?.full_name?.trim() || member.user?.email?.trim() || member.user_id}</p>
													<p className="text-xs text-gray-500">{member.user?.email?.trim() || member.user_id}</p>
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
									<span key={member.user_id} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
										{member.user?.full_name?.trim() || member.user?.email?.trim() || member.user_id}
									</span>
								))}
								{selectedMembers.length > 4 && (
									<span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
										+{selectedMembers.length - 4} lainnya
									</span>
								)}
							</div>
						)}
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-700">
							Jenis Notifikasi{" "}
							<span className="text-gray-400 font-normal">(kosong = semua)</span>
						</label>
						<div className="space-y-2">
							{ALL_EVENTS.map((ev) => (
								<label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="checkbox"
										checked={selectedEvents.includes(ev)}
										onChange={() => toggleEvent(ev)}
										className="rounded border-gray-300 text-blue-600"
									/>
									<span>{NOTIFICATION_EVENT_LABELS[ev]}</span>
								</label>
							))}
						</div>
					</div>
					{existing && (
						<div>
							<label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-gray-700">
								<input
									type="checkbox"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									className="rounded border-gray-300 text-blue-600"
								/>
								<span>Aktif</span>
							</label>
						</div>
					)}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={loading}
							className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
				<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
					Semua notifikasi
				</span>
			);
		}
		return (
			<div className="flex flex-wrap gap-1">
				{events.map((ev) => (
					<span
						key={ev}
						className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
					>
						{NOTIFICATION_EVENT_LABELS[ev] ?? ev}
					</span>
				))}
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Grup Notifikasi Bisnis</h2>
					<p className="mt-0.5 text-sm text-gray-500">
						Pilih member bisnis yang akan menerima notifikasi event tertentu.
					</p>
				</div>
				<button
					onClick={handleAdd}
					disabled={loadingMembers || availableMembers.length === 0}
					className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
				>
					+ Tambah
				</button>
			</div>

			{loading ? (
				<div className="py-8 text-center text-sm text-gray-400">Memuat...</div>
			) : groups.length === 0 ? (
				<div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
					<p className="text-sm text-gray-500">Belum ada grup notifikasi.</p>
					<button
						onClick={handleAdd}
						className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
					>
						Tambah sekarang
					</button>
				</div>
			) : (
				<div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
					{groups.map((g) => (
						<div key={g.id} className="flex items-start justify-between gap-4 px-4 py-3">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900 text-sm">{g.name}</span>
									{!g.is_active && (
										<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
											Nonaktif
										</span>
									)}
								</div>
								<div className="mt-0.5 text-sm text-gray-500">
									{g.members?.length ? `${g.members.length} member dipilih` : "Belum ada member dipilih"}
								</div>
								{g.members?.length ? (
									<div className="mt-1 flex flex-wrap gap-1.5">
										{g.members.slice(0, 3).map((member) => (
											<span key={member.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
												{memberLabel(member)}
											</span>
										))}
										{g.members.length > 3 && (
											<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
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
									className="text-xs font-medium text-blue-600 hover:text-blue-700"
								>
									Edit
								</button>
								<button
									onClick={() => handleDelete(g.id)}
									disabled={deletingID === g.id}
									className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
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
