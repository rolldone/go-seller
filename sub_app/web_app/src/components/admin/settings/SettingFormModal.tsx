import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { SettingItem } from "./types";

type FormPayload = {
  key: string;
  scope: string;
  value: unknown;
  description?: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  item: SettingItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: FormPayload) => Promise<void>;
};

export default function SettingFormModal({ open, mode, item, submitting, onClose, onSubmit }: Props) {
  const [key, setKey] = useState("");
  const [scope, setScope] = useState("global");
  const [description, setDescription] = useState("");
  const [valueText, setValueText] = useState("{}");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && item) {
      setKey(item.key || "");
      setScope(item.scope || "global");
      setDescription(item.description || "");
      setValueText(JSON.stringify(item.value ?? null, null, 2));
    } else {
      setKey("");
      setScope("global");
      setDescription("");
      setValueText("{}");
    }
    setError("");
  }, [open, mode, item]);

  const handleSave = async () => {
    setError("");
    if (!key.trim()) {
      setError("Key wajib diisi");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(valueText);
    } catch {
      setError("Value harus JSON valid");
      return;
    }

    await onSubmit({
      key: key.trim(),
      scope: scope.trim() || "global",
      value: parsed,
      description: description.trim() || undefined,
    });
  };

  return (
    <AdminModal
      open={open}
      title={mode === "create" ? "New Setting" : "Edit Setting"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Key</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={mode === "edit"}
              placeholder="contoh: tax.default"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Scope</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="global"
            />
          </label>
        </div>

        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Description</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="optional"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Value (JSON)</span>
          <textarea
            className="min-h-[240px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </AdminModal>
  );
}
