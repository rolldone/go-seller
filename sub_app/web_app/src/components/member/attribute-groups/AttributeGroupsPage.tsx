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

const columns: EntityColumn<AttributeGroup>[] = [
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

export default function MemberAttributeGroupsPage() {
	const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState<string>("");
	const [loadingBusinesses, setLoadingBusinesses] = useState<boolean>(true);
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

	const adapter: EntityAdapter<AttributeGroup> = useMemo(
		() => ({
			list: async () => {
				if (!selectedBusinessID) return { data: [], total: 0 };
				const data = await memberGet<AttributeGroup[]>(
					`/api/member/catalog/attribute-groups?include_inactive=true&business_id=${encodeURIComponent(selectedBusinessID)}`,
				);
				return { data: data || [], total: (data || []).length };
			},
			create: (payload) => {
				if (!selectedBusinessID) throw new Error("Pilih toko terlebih dahulu");
				return memberPost<AttributeGroup>("/api/member/catalog/attribute-groups", {
					...payload,
					business_id: selectedBusinessID,
				});
			},
			update: (id, payload) => memberPut<AttributeGroup>(`/api/member/catalog/attribute-groups/${id}`, payload),
			remove: (id) => memberDelete(`/api/member/catalog/attribute-groups/${id}`),
		}),
		[selectedBusinessID],
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

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<label className="text-sm">
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
				<p className="mt-2 text-xs text-slate-500">Group atribut hanya tampil untuk toko yang dipilih.</p>
			</div>

			<EntityCrudPage<AttributeGroup>
				key={selectedBusinessID}
				title="Attribute Groups"
				description={`Kelola grup atribut untuk toko: ${selectedBusiness?.name || "-"}`}
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
		</div>
	);
}