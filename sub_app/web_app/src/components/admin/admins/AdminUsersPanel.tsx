import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import AdminDeleteModal from "./AdminDeleteModal";
import AdminFormModal from "./AdminFormModal";
import AdminPasswordModal from "./AdminPasswordModal";
import AdminsTable from "./AdminsTable";
import {
  changeAdminPassword,
  createAdmin,
  deleteAdmin,
  listAdmins,
  restoreAdmin,
  updateAdmin,
} from "./api";
import type { Admin } from "./types";

export default function AdminUsersPanel() {
  const [items, setItems] = useState<Admin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [isBanned, setIsBanned] = useState<"" | "true" | "false">("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selected, setSelected] = useState<Admin | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [restoreID, setRestoreID] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdmins({ q, is_banned: isBanned, page, limit });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [q, isBanned, page, limit]);

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (item: Admin) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  const onSave = async (payload: {
    username: string;
    email: string;
    password?: string;
    activated?: boolean;
  }) => {
    setSubmitting(true);
    try {
      if (formMode === "create") {
        await createAdmin({
          username: payload.username,
          email: payload.email,
          password: payload.password || "",
          activated: payload.activated ?? true,
        });
        notifySuccess("Admin created");
      } else if (selected) {
        await updateAdmin(selected.id, { username: payload.username, email: payload.email });
        notifySuccess("Admin updated");
      }
      setFormOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save admin");
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteAdmin(selected.id);
      notifySuccess("Admin deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete admin");
    } finally {
      setSubmitting(false);
    }
  };

  const onChangePassword = async (password: string) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await changeAdminPassword(selected.id, password);
      notifySuccess("Password updated");
      setPasswordOpen(false);
      setSelected(null);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  const onRestoreByID = async () => {
    const id = restoreID.trim();
    if (!id) {
      notifyError("Masukkan Admin ID terlebih dulu");
      return;
    }
    setSubmitting(true);
    try {
      await restoreAdmin(id);
      notifySuccess("Admin restored");
      setRestoreID("");
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to restore admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Admin Users</h3>
          <p className="text-sm text-slate-600">Kelola akun admin project ini.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Admin
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search username/email"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={isBanned}
          onChange={(e) => {
            setPage(1);
            setIsBanned(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All</option>
          <option value="true">Banned</option>
          <option value="false">Not banned</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setQ("");
            setIsBanned("");
          }}
          className="rounded bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Reset
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">Restore soft-deleted admin by ID</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={restoreID}
            onChange={(e) => setRestoreID(e.target.value)}
            placeholder="Admin ID"
            className="min-w-[280px] rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={onRestoreByID}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            Restore
          </button>
        </div>
      </div>

      <AdminsTable
        items={items}
        loading={loading}
        error={error}
        onEdit={openEdit}
        onDelete={(item) => {
          setSelected(item);
          setDeleteOpen(true);
        }}
        onChangePassword={(item) => {
          setSelected(item);
          setPasswordOpen(true);
        }}
      />

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
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <AdminFormModal
        open={formOpen}
        mode={formMode}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={onSave}
      />

      <AdminPasswordModal
        open={passwordOpen}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setPasswordOpen(false);
          setSelected(null);
        }}
        onSubmit={onChangePassword}
      />

      <AdminDeleteModal
        open={deleteOpen}
        item={selected}
        submitting={submitting}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={onDeleteConfirm}
      />
    </div>
  );
}