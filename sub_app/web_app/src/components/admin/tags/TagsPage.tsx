import EntityCrudPage from "../entities/EntityCrudPage";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { EntityAdapter, EntityColumn, EntityField } from "../entities/types";

type Tag = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

const fields: EntityField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text" },
];

const columns: EntityColumn<Tag>[] = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug" },
  { key: "updated_at", label: "Updated", render: (item) => new Date(item.updated_at).toLocaleString() },
];

const adapter: EntityAdapter<Tag> = {
  list: (page = 1, limit = 20) => adminGet<{ data: Tag[]; total: number }>(`/admin/catalog/tags?page=${page}&limit=${limit}`),
  create: (payload) => adminPost<Tag>("/admin/catalog/tags", payload),
  update: (id, payload) => adminPut<Tag>(`/admin/catalog/tags/${id}`, payload),
  remove: (id) => adminDelete(`/admin/catalog/tags/${id}`),
};

export default function TagsPage() {
  return (
    <EntityCrudPage<Tag>
      title="Tags"
      description="Kelola tag produk"
      fields={fields}
      columns={columns}
      adapter={adapter}
      toPayload={(values) => ({
        name: String(values.name || "").trim(),
        slug: String(values.slug || "").trim(),
      })}
      toInitialValues={(item) => ({
        name: item?.name || "",
        slug: item?.slug || "",
      })}
    />
  );
}
