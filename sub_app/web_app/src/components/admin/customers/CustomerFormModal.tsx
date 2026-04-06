import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { Customer } from "./types";
import { notifyError } from "../../../lib/notification";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const textareaClass =
  "min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: Record<string, unknown>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export default function CustomerFormModal({ open, mode, initialValues, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>(initialValues || {});

  useEffect(() => {
    if (!open) return;
    setForm(initialValues || {});
  }, [open, initialValues]);

  const handleSubmit = async () => {
    try {
      if (!form.name || String(form.name).trim() === "") {
        notifyError("Name wajib diisi");
        return;
      }
      if (!form.email || String(form.email).trim() === "") {
        notifyError("Email wajib diisi");
        return;
      }
      await onSubmit(form);
    } catch (err) {
      // onSubmit will surface errors
      throw err;
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Customer" : "Edit Customer"}
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
            <span className="text-xs uppercase text-slate-500">Name</span>
            <input
              className={inputClass}
              value={String(form.name ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Email</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={String(form.email ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@domain.com"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Locale</span>
            <select
              className={inputClass}
              value={String(form.locale ?? "id")}
              onChange={(e) => setForm((prev) => ({ ...prev, locale: e.target.value }))}
            >
              <option value="id">Indonesia (id)</option>
              <option value="en">English (en)</option>
            </select>
          </label>

          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Status: <strong>{String((form as Customer).is_active ?? true) === "true" ? "active" : "inactive"}</strong>
            </p>
          </div>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase text-slate-500">Phone</span>
          <input
            className={inputClass}
            value={String(form.phone ?? "")}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Optional phone"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase text-slate-500">Notes</span>
          <textarea
            className={textareaClass}
            value={String(form.notes ?? "")}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </label>
      </div>
    </AdminModal>
  );
}
