import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import { notifyError } from "../../../lib/notification";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: Record<string, unknown>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default function UserFormModal({ open, mode, initialValues, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>(initialValues || {});

  useEffect(() => {
    if (!open) return;
    setForm(initialValues || {});
  }, [open, initialValues]);

  const handleSubmit = async () => {
    try {
      if (!form.full_name || String(form.full_name).trim() === "") {
        notifyError("Full name wajib diisi");
        return;
      }
      if (!form.email || String(form.email).trim() === "") {
        notifyError("Email wajib diisi");
        return;
      }
      await onSubmit(form);
    } catch (err) {
      throw err;
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create User" : "Edit User"}
      maxWidth="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Full Name</span>
            <input
              className={inputClass}
              value={String(form.full_name ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Full name"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Email</span>
            <input
              className={inputClass}
              value={String(form.email ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@domain.com"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Phone</span>
            <input
              className={inputClass}
              value={String(form.phone_number ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, phone_number: e.target.value }))}
              placeholder="Optional phone"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Active</span>
            <select
              className={inputClass}
              value={String(form.is_active ?? true)}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === "true" }))}
            >
              <option value={true}>Active</option>
              <option value={false}>Inactive</option>
            </select>
          </label>
        </div>
      </div>
    </AdminModal>
  );
}
