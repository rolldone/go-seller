import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";

type ParentOption = {
  value: string;
  label: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Record<string, unknown>;
  item?: Record<string, unknown> | null;
  parentOptions: ParentOption[];
  parentOptionsLoading?: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

const defaultForm = {
  name: "",
  slug: "",
  parent_id: "",
  icon_url: "",
  sort_priority: 0,
};

export default function CategoryFormModal({
  open,
  mode,
  initialValues = {},
  item,
  parentOptions,
  parentOptionsLoading = false,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<Record<string, any>>(defaultForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      name: String((initialValues as any).name ?? (item as any)?.name ?? ""),
      slug: String((initialValues as any).slug ?? (item as any)?.slug ?? ""),
      parent_id: String((initialValues as any).parent_id ?? (item as any)?.parent_id ?? ""),
      icon_url: String((initialValues as any).icon_url ?? (item as any)?.icon_url ?? ""),
      sort_priority: (initialValues as any).sort_priority ?? (item as any)?.sort_priority ?? 0,
    });
    setError("");
  }, [open, initialValues, item]);

  const toSlug = (input: string) => {
    if (!input) return "";
    return input
      .normalize("NFKD")
      .replace(/[^\u0000-\u007F]/g, "")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const setField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    if (!String(form.name || "").trim()) {
      setError("Name wajib diisi");
      return;
    }

    try {
      await onSubmit({
        name: String(form.name || "").trim(),
        slug: String(form.slug || "").trim(),
        parent_id: String(form.parent_id || "").trim() || undefined,
        icon_url: String(form.icon_url || "").trim() || undefined,
        sort_priority: Number(form.sort_priority || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan kategori");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <AdminModal
      open={open}
      title={mode === "create" ? "Create Category" : "Edit Category"}
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 grid-cols-1">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Category Profile</p>
          <p className="text-sm text-slate-600">Isi nama kategori dan metadata dasar.</p>
        </div>

        <label className="text-sm">
          <span className={labelClass}>Name</span>
          <input className={inputClass} value={form.name} onChange={(e) => setField("name", e.target.value)} />
        </label>

        <label className="text-sm">
          <span className={labelClass}>Slug</span>
          <div className="flex gap-2">
            <input className={`${inputClass} flex-1`} value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
            <button
              type="button"
              onClick={() => setField("slug", toSlug(String(form.name || "")))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Generate
            </button>
          </div>
        </label>

        <label className="text-sm">
          <span className={labelClass}>Parent Category</span>
          <select
            className={inputClass}
            value={String(form.parent_id ?? "")}
            onChange={(e) => setField("parent_id", e.target.value)}
            disabled={parentOptionsLoading}
          >
            <option value="">Root category</option>
            {parentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className={labelClass}>Icon URL</span>
          <input className={inputClass} value={form.icon_url} onChange={(e) => setField("icon_url", e.target.value)} />
        </label>

        <label className="text-sm">
          <span className={labelClass}>Sort Priority</span>
          <input type="number" min="0" step="1" className={inputClass} value={String(form.sort_priority ?? 0)} onChange={(e) => setField("sort_priority", e.target.value)} />
        </label>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div> : null}
      </div>
    </AdminModal>
  );
}
