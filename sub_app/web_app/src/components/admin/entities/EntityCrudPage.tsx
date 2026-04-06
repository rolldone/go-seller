import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import EntityDeleteModal from "./EntityDeleteModal";
import EntityFormModal from "./EntityFormModal";
import EntityTable from "./EntityTable";
import type { EntityAdapter, EntityColumn, EntityField, EntityRecordBase } from "./types";

type Props<T extends EntityRecordBase> = {
  title: string;
  description: string;
  fields: EntityField[];
  columns: EntityColumn<T>[];
  adapter: EntityAdapter<T>;
  toPayload?: (values: Record<string, unknown>) => Record<string, unknown>;
  toInitialValues?: (item: T | null) => Record<string, unknown>;
  getDeleteName?: (item: T) => string;
};

export default function EntityCrudPage<T extends EntityRecordBase>({
  title,
  description,
  fields,
  columns,
  adapter,
  toPayload,
  toInitialValues,
  getDeleteName,
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<T | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adapter.list(page, limit);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to fetch ${title}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit]);

  const initialValues = useMemo(() => {
    if (toInitialValues) return toInitialValues(selected);

    const base: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "checkbox") base[field.key] = false;
      else base[field.key] = "";
    }

    if (selected) {
      for (const field of fields) {
        base[field.key] = (selected as Record<string, unknown>)[field.key] ?? base[field.key];
      }
    }

    return base;
  }, [selected, toInitialValues, fields]);

  const handleCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const handleEdit = (item: T) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload = toPayload ? toPayload(values) : values;
      if (formMode === "create") {
        await adapter.create(payload);
        notifySuccess(`${title} created`);
      } else if (selected) {
        await adapter.update(selected.id, payload);
        notifySuccess(`${title} updated`);
      }
      setFormOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to save ${title}`;
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: T) => {
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await adapter.remove(selected.id);
      notifySuccess(`${title} deleted`);
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete ${title}`;
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteName = selected
    ? getDeleteName
      ? getDeleteName(selected)
      : (selected as Record<string, unknown>).name || selected.id
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <button type="button" onClick={handleCreate} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + New {title}
        </button>
      </div>

      <EntityTable items={items} columns={columns} loading={loading} error={error} onEdit={handleEdit} onDelete={handleDelete} />

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Total: <span className="font-medium text-slate-900">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {page} / {Math.max(1, Math.ceil(total / limit))}
          </span>
          <button
            type="button"
            disabled={page >= Math.max(1, Math.ceil(total / limit))}
            onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / limit)), p + 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Next
          </button>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      <EntityFormModal
        open={formOpen}
        mode={formMode}
        title={title}
        fields={fields}
        initialValues={initialValues}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={handleSave}
      />

      <EntityDeleteModal
        open={deleteOpen}
        title={title}
        itemName={String(deleteName)}
        submitting={submitting}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
