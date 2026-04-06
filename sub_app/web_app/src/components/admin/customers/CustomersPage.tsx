import { useCallback, useEffect, useState } from "react";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import CustomerFormModal from "./CustomerFormModal";
import type { EntityField } from "../entities/types";
import { notifyError, notifySuccess } from "../../../lib/notification";
import CustomersTable from "./CustomersTable";
import {
  banCustomer,
  createCustomer,
  deleteCustomer,
  listCustomers,
  restoreCustomer,
  unbanCustomer,
  updateCustomer,
} from "./api";
import type { Customer, CustomerPayload } from "./types";

const customerFormFields: EntityField[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Nama customer" },
  { key: "email", label: "Email", type: "text", required: true, placeholder: "email@domain.com" },
  {
    key: "locale",
    label: "Locale",
    type: "select",
    required: true,
    options: [
      { label: "Indonesia (id)", value: "id" },
      { label: "English (en)", value: "en" },
    ],
  },
  { key: "phone", label: "Phone", type: "text", placeholder: "+62" },
  { key: "notes", label: "Notes", type: "textarea", placeholder: "Optional context" },
  { key: "is_active", label: "Active", type: "checkbox" },
];

const emptyFormValues = {
  name: "",
  email: "",
  locale: "id",
  phone: "",
  notes: "",
  is_active: true,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [bannedFilter, setBannedFilter] = useState<"" | "true" | "false">("");
  const [withDeleted, setWithDeleted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCustomers({
        q,
        email,
        is_active: activeFilter,
        is_banned: bannedFilter,
        with_deleted: withDeleted,
        page,
        limit,
      });
      setCustomers(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch customers";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, bannedFilter, email, limit, page, q, withDeleted]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setFormMode("edit");
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const sanitizeFormPayload = (payload: Record<string, unknown>): CustomerPayload => {
    const name = String(payload.name ?? "").trim();
    const emailValue = String(payload.email ?? "").trim();
    const phoneValue = String(payload.phone ?? "").trim();
    const localeValue = String(payload.locale ?? "id").trim().toLowerCase();
    const notesValue = String(payload.notes ?? "").trim();
    const isActive = Boolean(payload.is_active ?? true);

    const result: CustomerPayload = {
      name,
      email: emailValue,
      locale: localeValue === "en" ? "en" : "id",
      is_active: isActive,
    };

    if (phoneValue) {
      result.phone = phoneValue;
    }
    if (notesValue) {
      result.notes = notesValue;
    }

    return result;
  };

  const handleFormSubmit = async (payload: Record<string, unknown>) => {
    setFormSubmitting(true);
    try {
      const body = sanitizeFormPayload(payload);
      if (formMode === "create") {
        await createCustomer(body);
        notifySuccess("Customer created");
      } else if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, body);
        notifySuccess("Customer updated");
      } else {
        throw new Error("No customer selected for update");
      }
      setFormOpen(false);
      setSelectedCustomer(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save customer";
      notifyError(message);
      throw err;
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCustomer) return;
    setDeleteSubmitting(true);
    try {
      await deleteCustomer(selectedCustomer.id);
      notifySuccess("Customer deleted");
      setDeleteOpen(false);
      setSelectedCustomer(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete customer";
      notifyError(message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleBan = async (customer: Customer) => {
    const reason = window.prompt("Reason for banning customer", "Policy violation");
    if (reason === null) return;

    setBusyCustomerId(customer.id);
    try {
      const trimmed = reason.trim() || "Manual ban";
      await banCustomer(customer.id, { reason: trimmed });
      notifySuccess("Customer banned");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to ban customer";
      notifyError(message);
    } finally {
      setBusyCustomerId(null);
    }
  };

  const handleUnban = async (customer: Customer) => {
    setBusyCustomerId(customer.id);
    try {
      await unbanCustomer(customer.id);
      notifySuccess("Customer unbanned");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unban customer";
      notifyError(message);
    } finally {
      setBusyCustomerId(null);
    }
  };

  const handleRestore = async (customer: Customer) => {
    setBusyCustomerId(customer.id);
    try {
      await restoreCustomer(customer.id);
      notifySuccess("Customer restored");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore customer";
      notifyError(message);
    } finally {
      setBusyCustomerId(null);
    }
  };

  const formValues = selectedCustomer
    ? {
        name: selectedCustomer.name,
        email: selectedCustomer.email,
        locale: selectedCustomer.locale || "id",
        phone: selectedCustomer.phone || "",
        notes: selectedCustomer.notes || "",
        is_active: selectedCustomer.is_active,
      }
    : emptyFormValues;

  const paginationLabel = `Page ${page} of ${totalPages}`;

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Customers</h3>
          <p className="text-sm text-slate-600">Kelola data customer dengan aktif, banned, dan restore.</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New Customer
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search q"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Filter by email"
          value={email}
          onChange={(e) => {
            setPage(1);
            setEmail(e.target.value);
          }}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={activeFilter}
          onChange={(e) => {
            setPage(1);
            setActiveFilter(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All active</option>
          <option value="true">Only active</option>
          <option value="false">Only inactive</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={bannedFilter}
          onChange={(e) => {
            setPage(1);
            setBannedFilter(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All banned</option>
          <option value="true">Banned only</option>
          <option value="false">Not banned</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
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
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
        >
          <option value={10}>Limit 10</option>
          <option value={25}>Limit 25</option>
          <option value={50}>Limit 50</option>
        </select>
      </div>

      <CustomersTable
        customers={customers}
        loading={loading}
        error={error}
        busyCustomerId={busyCustomerId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBan={handleBan}
        onUnban={handleUnban}
        onRestore={handleRestore}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <div className="text-slate-500">{paginationLabel}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>

      <CustomerFormModal
        open={formOpen}
        mode={formMode}
        initialValues={formValues}
        submitting={formSubmitting}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <EntityDeleteModal
        open={deleteOpen}
        title="Customer"
        itemName={selectedCustomer?.name || ""}
        submitting={deleteSubmitting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}