import { useEffect, useState } from "react";
import type { EntityField } from "./types";
import AdminModal from "../ui/AdminModal";

type Props<T> = {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  fields: EntityField[];
  initialValues: Record<string, unknown>;
  item?: T | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export default function EntityFormModal<T>({
  open,
  mode,
  title,
  fields,
  initialValues,
  item,
  submitting,
  onClose,
  onSubmit,
}: Props<T>) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initialValues);
    setError("");
  }, [open, item, initialValues]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError("");

    for (const field of fields) {
      if (!field.required) continue;
      const value = form[field.key];
      if (field.type === "checkbox") continue;
      if (value === undefined || value === null || String(value).trim() === "") {
        setError(`${field.label} wajib diisi`);
        return;
      }
    }

    await onSubmit(form);
  };

  return (
    <AdminModal open={open} title={mode === "create" ? `Create ${title}` : `Edit ${title}`} onClose={onClose} maxWidth="xl">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.type === "checkbox") {
            return (
              <label key={field.key} className="flex items-center gap-2 pt-7 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[field.key])}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                />
                {field.label}
              </label>
            );
          }

          if (field.type === "textarea") {
            return (
              <label key={field.key} className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-700">{field.label}</span>
                <textarea
                  placeholder={field.placeholder}
                  value={String(form[field.key] ?? "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            );
          }

          if (field.type === "select") {
            return (
              <label key={field.key} className="text-sm">
                <span className="mb-1 block text-slate-700">{field.label}</span>
                <select
                  value={String(form[field.key] ?? "")}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="">-- Pilih --</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={field.key} className="text-sm">
              <span className="mb-1 block text-slate-700">{field.label}</span>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={String(form[field.key] ?? "")}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {/* footer */}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
        >
          {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </button>
      </div>
    </AdminModal>
  );
}
