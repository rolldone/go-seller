import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { Admin } from "./types";

type Props = {
  open: boolean;
  item: Admin | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
};

export default function AdminPasswordModal({ open, item, submitting, onClose, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setError("");
  }, [open, item]);

  if (!item) return null;

  const handleSave = async () => {
    setError("");
    if (password.trim().length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    await onSubmit(password.trim());
  };

  return (
    <AdminModal
      open={open}
      title="Change Password"
      onClose={onClose}
      maxWidth="md"
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
            {submitting ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
        <p className="mb-3 text-sm text-slate-600">Admin: {item.username}</p>

        <label className="text-sm">
          <span className="mb-1 block text-slate-700">New Password</span>
          <input
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </AdminModal>
  );
}
