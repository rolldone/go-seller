import EntityCrudPage from "../entities/EntityCrudPage";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { EntityAdapter, EntityColumn, EntityField } from "../entities/types";

type AttributeGroup = {
  id: string;
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

const adapter: EntityAdapter<AttributeGroup> = {
  list: async () => {
    const data = await adminGet<AttributeGroup[]>("/admin/catalog/attribute-groups?include_inactive=true");
    return { data: data || [], total: (data || []).length };
  },
  create: (payload) => adminPost<AttributeGroup>("/admin/catalog/attribute-groups", payload),
  update: (id, payload) => adminPut<AttributeGroup>(`/admin/catalog/attribute-groups/${id}`, payload),
  remove: (id) => adminDelete(`/admin/catalog/attribute-groups/${id}`),
};

export default function AttributeGroupsPage() {
  return (
    <EntityCrudPage<AttributeGroup>
      title="Attribute Groups"
      description="Kelola grup atribut seperti Warna, Ukuran, dan Material"
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
  );
}
