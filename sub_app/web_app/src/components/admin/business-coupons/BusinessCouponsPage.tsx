import { useCallback, useEffect, useState } from "react";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import { notifyError, notifySuccess } from "../../../lib/notification";
import CouponsTable from "../coupons/CouponsTable";
import ProductPickerModal from "../coupons/ProductPickerModal";
import CouponFormModal, {
  couponToForm,
  emptyForm,
  formToPayload,
  parseProductIDs,
} from "../coupons/CouponFormModal";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "../coupons/api";
import type { Coupon } from "../coupons/types";
import type { FormState } from "../coupons/CouponFormModal";
import { adminGet } from "../entities/adminApi";

type BusinessOption = {
  id: string;
  name: string;
  slug: string;
};

export default function BusinessCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bid = params.get("business_id") || "";
    if (bid) setSelectedBusinessId(bid);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selectedBusinessId) params.set("business_id", selectedBusinessId);
    else params.delete("business_id");
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [selectedBusinessId]);

  const loadBusinesses = useCallback(async () => {
    try {
      const res = await adminGet<{ data: BusinessOption[] }>("/admin/catalog/businesses?page=1&limit=500");
      const items = res.data || [];
      setBusinesses(items);
      setSelectedBusinessId((current) => current || items[0]?.id || "");
    } catch {
      setBusinesses([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBusinessId) {
      setCoupons([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await listCoupons({ q, is_active: activeFilter, business_id: selectedBusinessId, page, limit });
      setCoupons(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch coupons");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, limit, page, q, selectedBusinessId]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) || null;

  const handleCreate = () => {
    if (!selectedBusinessId) {
      notifyError("Pilih business terlebih dulu");
      return;
    }
    setFormMode("create");
    setSelectedCoupon(null);
    setFormState(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setFormMode("edit");
    setSelectedCoupon(coupon);
    setFormState(couponToForm(coupon));
    setFormOpen(true);
  };

  const handleFormChange = (patch: Partial<FormState>) => {
    setFormState((prev) => {
      const next = { ...prev, ...patch };
      if ("product_ids_text" in patch) {
        next.selectedProductIDs = parseProductIDs(next.product_ids_text);
      }
      return next;
    });
  };

  const applySelectedProductIDs = (ids: string[]) => {
    const normalized = parseProductIDs(ids.join("\n"));
    setFormState((prev) => ({
      ...prev,
      selectedProductIDs: normalized,
      product_ids_text: normalized.join("\n"),
    }));
  };

  const handleRemoveSelectedProduct = (id: string) => {
    applySelectedProductIDs(formState.selectedProductIDs.filter((value) => value !== id));
  };

  const handleFormSubmit = async () => {
    if (!selectedBusinessId) {
      notifyError("Pilih business terlebih dulu");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = { ...formToPayload(formState), business_id: selectedBusinessId };
      if (!payload.code || !payload.name) {
        notifyError("Code dan name wajib diisi");
        return;
      }
      if (formMode === "create") {
        await createCoupon(payload);
        notifySuccess("Coupon created");
      } else if (selectedCoupon) {
        await updateCoupon(selectedCoupon.id, payload);
        notifySuccess("Coupon updated");
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCoupon) return;
    setDeleteSubmitting(true);
    try {
      await deleteCoupon(selectedCoupon.id);
      notifySuccess("Coupon deleted");
      setDeleteOpen(false);
      setSelectedCoupon(null);
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete coupon");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Business Coupons</h3>
          <p className="text-sm text-slate-600">Kelola coupon yang terikat ke business tertentu.</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          disabled={!selectedBusinessId}
        >
          + New Business Coupon
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business target</p>
            <p className="text-sm text-slate-600">Semua coupon di sini akan disimpan dengan business_id yang dipilih.</p>
          </div>
          <div className="min-w-[280px]">
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedBusinessId}
              onChange={(event) => {
                setPage(1);
                setSelectedBusinessId(event.target.value);
              }}
            >
              <option value="">Pilih business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} / {business.slug}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Target aktif: <span className="font-medium text-slate-900">{selectedBusiness ? `${selectedBusiness.name} / ${selectedBusiness.slug}` : selectedBusinessId || "-"}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search code / name"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
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
          <option value="">All status</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 50].map((value) => (
            <option key={value} value={value}>
              {value} per page
            </option>
          ))}
        </select>
      </div>

      <CouponsTable coupons={coupons} loading={loading} error={error} onEdit={handleEdit} onDelete={handleDelete} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded bg-slate-100 px-3 py-1 hover:bg-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded bg-slate-100 px-3 py-1 hover:bg-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <CouponFormModal
        open={formOpen}
        mode={formMode}
        form={formState}
        submitting={formSubmitting}
        onChange={handleFormChange}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        selectedProductIDs={formState.selectedProductIDs}
        onOpenProductPicker={() => setProductPickerOpen(true)}
        onRemoveProduct={handleRemoveSelectedProduct}
      />
      <ProductPickerModal
        open={productPickerOpen}
        selectedIds={formState.selectedProductIDs}
        businessID={selectedBusinessId}
        onChange={applySelectedProductIDs}
        onClose={() => setProductPickerOpen(false)}
      />

      <EntityDeleteModal
        open={deleteOpen}
        title="Delete Coupon"
        itemName={selectedCoupon?.name ?? selectedCoupon?.code ?? ""}
        description={`Hapus coupon "${selectedCoupon?.name}" (${selectedCoupon?.code})?`}
        submitting={deleteSubmitting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}