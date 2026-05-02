import { useEffect, useMemo, useState } from "react";

import EntityCrudPage from "../../admin/entities/EntityCrudPage";
import type { EntityAdapter, EntityColumn, EntityField } from "../../admin/entities/types";
import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import { listMemberBusinesses } from "../products/api";
import type { BusinessOption } from "../products/types";

type AttributeGroup = {
	id: string;
	business_id?: string | null;
	name: string;
};

type Attribute = {
	id: string;
	attribute_group_id: string;
	name: string;
	slug: string;
	description?: string | null;
	display_order: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

const fields: EntityField[] = [
	{ key: "name", label: "Name", type: "text", required: true },
	{ key: "slug", label: "Slug", type: "text" },
	{ key: "description", label: "Description", type: "textarea" },
	{ key: "display_order", label: "Display Order", type: "number" },
	{ key: "is_active", label: "Active", type: "checkbox" },
];

const columns: EntityColumn<Attribute>[] = [
	{ key: "name", label: "Name" },
	{ key: "slug", label: "Slug" },
	{ key: "display_order", label: "Order" },
	{
		key: "is_active",
		label: "Status",
		render: (item) => (
			<span
				className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
					item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
				}`}
			>
				{item.is_active ? "Active" : "Inactive"}
			</span>
		),
	},
	{ key: "updated_at", label: "Updated", render: (item) => new Date(item.updated_at).toLocaleString() },
];

export default function MemberAttributesPage() {
	const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState<string>("");
	const [loadingBusinesses, setLoadingBusinesses] = useState<boolean>(true);
	const [groups, setGroups] = useState<AttributeGroup[]>([]);
	const [selectedGroupID, setSelectedGroupID] = useState<string>("");
	const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			setLoadingBusinesses(true);
			setError(null);
			try {
				const rows = await listMemberBusinesses();
				setBusinesses(rows);
				if (rows.length > 0) {
					setSelectedBusinessID((prev) => prev || rows[0].id);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Gagal memuat toko");
				setBusinesses([]);
			} finally {
				setLoadingBusinesses(false);
			}
		})();
	}, []);

	const selectedBusiness = useMemo(
		() => businesses.find((business) => business.id === selectedBusinessID) || null,
		[businesses, selectedBusinessID],
	);

	useEffect(() => {
		if (!selectedBusinessID) {
			setGroups([]);
			setSelectedGroupID("");
			return;
		}

		void (async () => {
			setLoadingGroups(true);
			setError(null);
			try {
				const data = await memberGet<AttributeGroup[]>(
					`/api/member/catalog/attribute-groups?include_inactive=true&business_id=${encodeURIComponent(selectedBusinessID)}`,
				);
				const rows = data || [];
				setGroups(rows);
				setSelectedGroupID((prev) => (prev && rows.some((group) => group.id === prev) ? prev : rows[0]?.id || ""));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch attribute groups");
				setGroups([]);
				setSelectedGroupID("");
			} finally {
				setLoadingGroups(false);
			}
		})();
	}, [selectedBusinessID]);

	const selectedGroup = useMemo(
		() => groups.find((group) => group.id === selectedGroupID) || null,
		[groups, selectedGroupID],
	);

	const adapter: EntityAdapter<Attribute> = useMemo(
		() => ({
			list: async () => {
				if (!selectedGroupID) return { data: [], total: 0 };
				const data = await memberGet<Attribute[]>(
					`/api/member/catalog/attribute-groups/${selectedGroupID}/attributes?include_inactive=true`,
				);
				return { data: data || [], total: (data || []).length };
			},
			create: (payload) => {
				if (!selectedGroupID) throw new Error("Pilih attribute group terlebih dahulu");
				return memberPost<Attribute>("/api/member/catalog/attributes", {
					...payload,
					attribute_group_id: selectedGroupID,
				});
			},
			update: (id, payload) => memberPut<Attribute>(`/api/member/catalog/attributes/${id}`, payload),
			remove: (id) => memberDelete(`/api/member/catalog/attributes/${id}`),
		}),
		[selectedGroupID],
	);

	if (loadingBusinesses) {
		return <div className="text-sm text-slate-500">Loading businesses...</div>;
	}

	if (error) {
		return <div className="text-sm text-red-600">Error: {error}</div>;
	}

	if (businesses.length === 0) {
		return (
			<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
				Belum ada toko yang terhubung ke member ini.
			</div>
		);
	}

	if (loadingGroups) {
		return <div className="text-sm text-slate-500">Loading attribute groups...</div>;
	}

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
				<label className="text-sm block">
					<span className="mb-1 block text-slate-700">Business</span>
					<select
						value={selectedBusinessID}
						onChange={(event) => setSelectedBusinessID(event.target.value)}
						className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-sm"
					>
						{businesses.map((business) => (
							<option key={business.id} value={business.id}>
								{business.name}
							</option>
						))}
					</select>
				</label>

				<label className="text-sm block">
					<span className="mb-1 block text-slate-700">Attribute Group</span>
					<select
						value={selectedGroupID}
						onChange={(event) => setSelectedGroupID(event.target.value)}
						className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-sm"
					>
						{groups.map((group) => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</select>
				</label>
				<p className="text-xs text-slate-500">Attribute dibuat untuk group milik toko yang dipilih.</p>
			</div>

			{!selectedGroupID ? (
				<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
					Belum ada attribute group untuk toko ini. Buat dulu di halaman Attribute Groups.
				</div>
			) : (
				<EntityCrudPage<Attribute>
					key={selectedGroupID}
					title="Attributes"
					description={`Kelola nilai atribut untuk grup: ${selectedGroup?.name || "-"}`}
					fields={fields}
					columns={columns}
					adapter={adapter}
					toPayload={(values) => ({
						name: String(values.name || "").trim(),
						slug: String(values.slug || "").trim(),
						description: String(values.description || "").trim() || undefined,
						display_order: Number(values.display_order || 0),
						is_active: Boolean(values.is_active),
					})}
					toInitialValues={(item) => ({
						name: item?.name || "",
						slug: item?.slug || "",
						description: item?.description || "",
						display_order: item?.display_order ?? 0,
						is_active: item?.is_active ?? true,
					})}
				/>
			)}
		</div>
	);
}