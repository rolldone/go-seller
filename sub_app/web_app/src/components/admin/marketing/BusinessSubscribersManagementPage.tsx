import { useEffect, useMemo, useState } from "react";
import { adminDelete, adminGet, adminPost } from "../entities/adminApi";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { Business, BusinessListResponse } from "../businesses/types";

type SubscriptionStatusFilter = "" | "active" | "inactive" | "confirmed" | "unconfirmed";

type SubscriptionMetadata = Record<string, unknown> | string | null | undefined;

type BusinessSubscriptionRecord = {
  id: string;
  businessId: string;
  productId?: string | null;
  customerId?: string | null;
  email: string;
  consent: boolean;
  subscribedAt?: string;
  unsubscribedAt?: string | null;
  metadata?: SubscriptionMetadata;
  isConfirmed: boolean;
  confirmedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type SubscriptionListResponse = {
  data: BusinessSubscriptionRecord[];
  total: number;
  page: number;
  limit: number;
};

const DEFAULT_LIMIT = 20;

const statusOptions: Array<{ value: SubscriptionStatusFilter; label: string }> = [
  { value: "", label: "Semua status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "confirmed", label: "Terkonfirmasi" },
  { value: "unconfirmed", label: "Menunggu konfirmasi" },
];

function parseMetadata(value: SubscriptionMetadata): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function createInitialState() {
  return {
    businessId: "",
    email: "",
    status: "" as SubscriptionStatusFilter,
    page: 1,
    limit: DEFAULT_LIMIT,
  };
}

export default function BusinessSubscribersManagementPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessNameByID, setBusinessNameByID] = useState<Record<string, string>>({});
  const [businessId, setBusinessId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscriptionStatusFilter>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [items, setItems] = useState<BusinessSubscriptionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialState = createInitialState();

    setBusinessId(params.get("business_id") || initialState.businessId);
    setEmail(params.get("email") || initialState.email);
    setStatus((params.get("status") as SubscriptionStatusFilter) || initialState.status);

    const parsedPage = Number(params.get("page") || String(initialState.page));
    const parsedLimit = Number(params.get("limit") || String(initialState.limit));
    if (Number.isFinite(parsedPage) && parsedPage > 0) {
      setPage(parsedPage);
    }
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      setLimit(parsedLimit);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    if (businessId) {
      params.set("business_id", businessId);
    }
    if (email) {
      params.set("email", email);
    }
    if (status) {
      params.set("status", status);
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    if (limit !== DEFAULT_LIMIT) {
      params.set("limit", String(limit));
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [businessId, email, status, page, limit]);

  useEffect(() => {
    const loadBusinesses = async () => {
      setLoadingBusinesses(true);
      try {
        const res = await adminGet<BusinessListResponse>("/admin/catalog/businesses?page=1&limit=500");
        const list = res.data || [];
        const nameByID: Record<string, string> = {};
        for (const business of list) {
          nameByID[business.id] = business.name;
        }
        setBusinesses(list);
        setBusinessNameByID(nameByID);
      } catch (err) {
        setBusinesses([]);
        setBusinessNameByID({});
        notifyError(err instanceof Error ? err.message : "Gagal memuat daftar business");
      } finally {
        setLoadingBusinesses(false);
      }
    };

    void loadBusinesses();
  }, []);

  const loadItems = async () => {
    setLoadingItems(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (businessId) {
        query.set("business_id", businessId);
      }
      if (email.trim()) {
        query.set("email", email.trim());
      }
      if (status) {
        query.set("status", status);
      }
      query.set("page", String(page));
      query.set("limit", String(limit));

      const res = await adminGet<SubscriptionListResponse>(`/admin/marketing/subscriptions?${query.toString()}`);
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat subscriber";
      setError(message);
      notifyError(message);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [businessId, email, status, page, limit]);

  const resetFilters = () => {
    setBusinessId("");
    setEmail("");
    setStatus("");
    setPage(1);
    setLimit(DEFAULT_LIMIT);
  };

  const handleResend = async (subscription: BusinessSubscriptionRecord) => {
    setActionLoadingId(subscription.id);
    try {
      await adminPost(`/admin/marketing/subscriptions/${subscription.id}/resend`);
      notifySuccess("Confirmation email sent");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal mengirim ulang email konfirmasi");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (subscription: BusinessSubscriptionRecord) => {
    if (typeof window !== "undefined" && !window.confirm(`Hapus subscriber ${subscription.email}?`)) {
      return;
    }

    setActionLoadingId(subscription.id);
    try {
      await adminDelete(`/admin/marketing/subscriptions/${subscription.id}`);
      notifySuccess("Subscriber deleted");
      await loadItems();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus subscriber");
    } finally {
      setActionLoadingId(null);
    }
  };

  const selectedBusinessLabel = businessId ? businessNameByID[businessId] || businessId : "Semua business";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Business Subscribers</h3>
          <p className="text-sm text-slate-600">Lihat daftar subscriber berdasarkan business dan status konfirmasi.</p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          Target: <span className="font-semibold text-slate-900">{selectedBusinessLabel}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Business</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={businessId}
                onChange={(event) => {
                  setBusinessId(event.target.value);
                  setPage(1);
                }}
                disabled={loadingBusinesses}
              >
                <option value="">Semua business</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name} / {business.slug}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari email subscriber"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as SubscriptionStatusFilter);
                  setPage(1);
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Per halaman</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Reset Filters
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Subscriber list</h4>
            <p className="text-xs text-slate-500">Total {total} subscriber untuk filter aktif saat ini.</p>
          </div>
          {loadingItems ? <span className="text-xs text-slate-500">Loading...</span> : null}
        </div>

        {!loadingItems && items.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Belum ada subscriber untuk filter ini.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2">Business</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Locale</th>
                  <th className="px-3 py-2">Confirmed</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Subscribed</th>
                  <th className="px-3 py-2">Confirmed At</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((subscription) => {
                  const metadata = parseMetadata(subscription.metadata);
                  const locale = typeof metadata?.customer_locale === "string" ? metadata.customer_locale : "-";
                  const businessLabel = subscription.businessId ? businessNameByID[subscription.businessId] || subscription.businessId : "-";
                  const statusLabel = subscription.unsubscribedAt ? "Inactive" : "Active";

                  return (
                    <tr key={subscription.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-900">{businessLabel}</div>
                        <div className="text-xs text-slate-500">{subscription.businessId}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-900">{subscription.email}</div>
                        {subscription.customerId ? <div className="text-xs text-slate-500">Customer: {subscription.customerId}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{subscription.productId || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{locale}</td>
                      <td className="px-3 py-2 text-slate-600">{subscription.isConfirmed ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-slate-600">{statusLabel}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(subscription.subscribedAt)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(subscription.confirmedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleResend(subscription)}
                            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                            disabled={actionLoadingId === subscription.id}
                          >
                            {actionLoadingId === subscription.id ? "Sending..." : "Resend"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(subscription)}
                            className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            disabled={actionLoadingId === subscription.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Halaman {page} dari {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}