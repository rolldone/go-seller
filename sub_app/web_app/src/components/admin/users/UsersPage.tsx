import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import EntityTable from "../entities/EntityTable";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { EntityColumn } from "../entities/types";
import UserFormModal from "../users/UserFormModal";

type User = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  is_banned?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};



const columns: EntityColumn<User>[] = [
  { key: "full_name", label: "Full Name", render: (item) => item.deleted_at ? `⚠ ${item.full_name}` : item.full_name },
  { key: "email", label: "Email" },
  { key: "phone_number", label: "Phone" },
  { key: "is_active", label: "Active", render: (item) => (item.is_active ? "Yes" : "No") },
  { key: "is_banned", label: "Banned", render: (item) => (item.is_banned ? "Yes" : "No") },
  { key: "deleted_at", label: "Deleted", render: (item) => item.deleted_at ? new Date(item.deleted_at).toLocaleString() : "-" },
  { key: "updated_at", label: "Updated", render: (item) => new Date(item.updated_at).toLocaleString() },
];

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [isBanned, setIsBanned] = useState<"" | "true" | "false">("");
  const [withDeleted, setWithDeleted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreID, setRestoreID] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const buildListPath = () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (q.trim()) params.set("q", q.trim());
    if (isActive) params.set("is_active", isActive);
    if (isBanned) params.set("is_banned", isBanned);
    if (withDeleted) params.set("with_deleted", "true");
    return `/admin/users?${params.toString()}`;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGet<{ data: User[]; total: number }>(buildListPath());
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit, q, isActive, isBanned, withDeleted]);

  const initialValues = useMemo(
    () => ({
      full_name: selected?.full_name || "",
      email: selected?.email || "",
      phone_number: selected?.phone_number || "",
      is_active: selected?.is_active ?? true,
    }),
    [selected],
  );

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (item: User) => {
    setFormMode("edit");
    setSelected(item);
    setFormOpen(true);
  };

  const onSave = async (values: Record<string, unknown>) => {
    const payload = {
      full_name: String(values.full_name || "").trim(),
      email: String(values.email || "").trim(),
      phone_number: String(values.phone_number || "").trim(),
      is_active: Boolean(values.is_active),
    };

    setSubmitting(true);
    try {
      if (formMode === "create") {
        await adminPost<User>("/admin/users", payload);
        notifySuccess("Users created");
      } else if (selected) {
        await adminPut<User>(`/admin/users/${selected.id}`, payload);
        notifySuccess("Users updated");
      }
      setFormOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await adminDelete(`/admin/users/${selected.id}`);
      notifySuccess("Users deleted");
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setSubmitting(false);
    }
  };

  const onRestoreByID = async () => {
    const id = restoreID.trim();
    if (!id) {
      notifyError("Masukkan User ID terlebih dulu");
      return;
    }
    setSubmitting(true);
    try {
      await adminPost(`/admin/users/${id}/restore`);
      notifySuccess("Users restored");
      setRestoreID("");
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to restore user");
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleBan = async (item: User) => {
    setSubmitting(true);
    try {
      if (item.is_banned) {
        await adminPost(`/admin/users/${item.id}/unban`);
        notifySuccess("User unbanned");
      } else {
        const reason = window.prompt("Ban reason (optional):", "") || "";
        await adminPost(`/admin/users/${item.id}/ban`, {
          reason: reason.trim() || undefined,
        });
        notifySuccess("User banned");
      }
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to update ban status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
          <p className="text-sm text-slate-600">Kelola akun customer</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + New Users
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search name/email/phone"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={isActive}
          onChange={(e) => {
            setPage(1);
            setIsActive(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All active status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={isBanned}
          onChange={(e) => {
            setPage(1);
            setIsBanned(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All banned status</option>
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
            setIsActive("");
            setIsBanned("");
            setWithDeleted(false);
          }}
          className="rounded bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Reset
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={withDeleted}
            onChange={(e) => {
              setPage(1);
              setWithDeleted(e.target.checked);
            }}
          />
          Show deleted
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">Restore soft-deleted user by ID</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={restoreID}
            onChange={(e) => setRestoreID(e.target.value)}
            placeholder="User ID"
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

      <EntityTable
        items={items}
        columns={columns}
        loading={loading}
        error={error}
        onEdit={openEdit}
        onDelete={(item) => {
          setSelected(item);
          setDeleteOpen(true);
        }}
        renderExtraActions={(item) => (
          <>
            {item.deleted_at ? (
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await adminPost(`/admin/users/${item.id}/restore`);
                    notifySuccess("User restored");
                    await loadData();
                  } catch (err) {
                    notifyError(err instanceof Error ? err.message : "Failed to restore user");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200 disabled:opacity-70"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => onToggleBan(item)}
                className={item.is_banned ? "rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200" : "rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200"}
              >
                {item.is_banned ? "Unban" : "Ban"}
              </button>
            )}
          </>
        )}
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

      <UserFormModal
        open={formOpen}
        mode={formMode}
        initialValues={initialValues}
        submitting={submitting}
        onClose={() => {
          setFormOpen(false);
          setSelected(null);
        }}
        onSubmit={onSave}
      />

      <EntityDeleteModal
        open={deleteOpen}
        title="Users"
        itemName={selected?.full_name || selected?.email || selected?.id || ""}
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
