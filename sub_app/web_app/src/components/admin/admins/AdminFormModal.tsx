import { useEffect, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { Admin } from "./types";

type FormPayload = {
  username: string;
  email: string;
  password?: string;
  activated?: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  item: Admin | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: FormPayload) => Promise<void>;
};

export default function AdminFormModal({ open, mode, item, submitting, onClose, onSubmit }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activated, setActivated] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && item) {
      setUsername(item.username || "");
      setEmail(item.email || "");
      setPassword("");
      setActivated(Boolean(item.is_activated_at));
    } else {
      setUsername("");
      setEmail("");
      setPassword("");
      setActivated(true);
    }
    setError("");
  }, [open, mode, item]);

  const handleSave = async () => {
    setError("");

    if (!username.trim() || !email.trim()) {
      setError("Username dan email wajib diisi");
      return;
    }

    if (mode === "create") {
      if (password.trim().length < 8) {
        setError("Password minimal 8 karakter");
        return;
      }
      await onSubmit({
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
        activated,
      });
      return;
    }

    await onSubmit({
      username: username.trim(),
      email: email.trim(),
    });
  };

  return (
    <AdminModal
      open={open}
      title={mode === "create" ? "Create Admin" : "Edit Admin"}
      onClose={onClose}
      maxWidth="lg"
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
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Username</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Email</span>
            <input type="email" className="w-full rounded border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          {mode === "create" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Password</span>
                <input
                  type="password"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={activated} onChange={(e) => setActivated(e.target.checked)} />
                Activated
              </label>
            </>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </AdminModal>
  );
}
