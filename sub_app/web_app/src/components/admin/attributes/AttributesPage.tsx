import { useEffect, useMemo, useState } from "react";
import EntityCrudPage from "../entities/EntityCrudPage";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { EntityAdapter, EntityColumn, EntityField } from "../entities/types";

type AttributeGroup = {
  id: string;
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

export default function AttributesPage() {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [selectedGroupID, setSelectedGroupID] = useState<string>("");
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGroups = async () => {
      setLoadingGroups(true);
      setError(null);
      try {
        const data = await adminGet<AttributeGroup[]>("/admin/catalog/attribute-groups?include_inactive=true");
        const groupsData = data || [];
        setGroups(groupsData);
        if (groupsData.length > 0) {
          setSelectedGroupID((prev) => prev || groupsData[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch attribute groups";
        setError(message);
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupID) || null,
    [groups, selectedGroupID],
  );

  const adapter: EntityAdapter<Attribute> = useMemo(
    () => ({
      list: async () => {
        if (!selectedGroupID) return { data: [], total: 0 };
        const data = await adminGet<Attribute[]>(
          `/admin/catalog/attribute-groups/${selectedGroupID}/attributes?include_inactive=true`,
        );
        return { data: data || [], total: (data || []).length };
      },
      create: (payload) => {
        if (!selectedGroupID) throw new Error("Pilih attribute group terlebih dahulu");
        return adminPost<Attribute>("/admin/catalog/attributes", {
          ...payload,
          attribute_group_id: selectedGroupID,
        });
      },
      update: (id, payload) => adminPut<Attribute>(`/admin/catalog/attributes/${id}`, payload),
      remove: (id) => adminDelete(`/admin/catalog/attributes/${id}`),
    }),
    [selectedGroupID],
  );

  if (loadingGroups) {
    return <div className="text-sm text-slate-500">Loading attribute groups...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Belum ada attribute group. Buat dulu di halaman Attribute Groups.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Attribute Group</span>
          <select
            value={selectedGroupID}
            onChange={(event) => setSelectedGroupID(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 bg-white sm:max-w-sm"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>

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
    </div>
  );
}
