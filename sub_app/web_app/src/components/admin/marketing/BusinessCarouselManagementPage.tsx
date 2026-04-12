import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { Business, BusinessListResponse } from "../businesses/types";

type CarouselItemDraft = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
};

type BusinessCarouselRecord = {
  id: string;
  businessId: string;
  slot: string;
  title: string;
  subtitle?: string | null;
  layoutType: "large" | "medium" | "banner";
  isActive: boolean;
  sortOrder: number;
  items: CarouselItemDraft[];
  createdAt?: string;
  updatedAt?: string;
};

type CarouselFormState = {
  slot: string;
  title: string;
  subtitle: string;
  layoutType: "large" | "medium" | "banner";
  isActive: boolean;
  sortOrder: number;
  itemsJson: string;
};

type CarouselListResponse = { data: BusinessCarouselRecord[] };

const defaultItems = [
  {
    id: "item-1",
    title: "Hero Section",
    subtitle: "Teks pendukung carousel",
    image: "",
    href: "",
  },
];

const createEmptyDraft = (): CarouselFormState => ({
  slot: "hero",
  title: "",
  subtitle: "",
  layoutType: "large",
  isActive: true,
  sortOrder: 0,
  itemsJson: JSON.stringify(defaultItems, null, 2),
});

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export default function BusinessCarouselManagementPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [items, setItems] = useState<BusinessCarouselRecord[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CarouselFormState>(createEmptyDraft());

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId) || null,
    [businesses, selectedBusinessId],
  );

  const loadBusinesses = async () => {
    setLoadingBusinesses(true);
    try {
      const response = await adminGet<BusinessListResponse>("/admin/catalog/businesses?page=1&limit=200");
      const list = response.data || [];
      setBusinesses(list);
      if (!selectedBusinessId && list[0]?.id) {
        setSelectedBusinessId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar business");
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const loadItems = async (businessId: string) => {
    if (!businessId) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    setError(null);
    try {
      const response = await adminGet<CarouselListResponse>(`/admin/marketing/business-carousels?business_id=${encodeURIComponent(businessId)}`);
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat carousel");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    void loadBusinesses();
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) {
      setItems([]);
      return;
    }

    setEditingId(null);
    setDraft(createEmptyDraft());
    void loadItems(selectedBusinessId);
  }, [selectedBusinessId]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(createEmptyDraft());
  };

  const handleEdit = (record: BusinessCarouselRecord) => {
    setEditingId(record.id);
    setDraft({
      slot: record.slot,
      title: record.title,
      subtitle: record.subtitle || "",
      layoutType: record.layoutType,
      isActive: Boolean(record.isActive),
      sortOrder: Number(record.sortOrder || 0),
      itemsJson: JSON.stringify(record.items || [], null, 2),
    });
  };

  const handleDelete = async (record: BusinessCarouselRecord) => {
    if (typeof window !== "undefined" && !window.confirm(`Hapus carousel "${record.title}"?`)) {
      return;
    }

    setSubmitting(true);
    try {
      await adminDelete(`/admin/marketing/business-carousels/${record.id}`);
      notifySuccess("Carousel deleted");
      if (editingId === record.id) {
        resetDraft();
      }
      await loadItems(selectedBusinessId);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus carousel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedBusinessId) {
      notifyError("Pilih business terlebih dulu");
      return;
    }

    let parsedItems: CarouselItemDraft[];
    try {
      const payload = JSON.parse(draft.itemsJson || "[]");
      parsedItems = Array.isArray(payload) ? payload : [];
    } catch {
      notifyError("Items harus berupa JSON array yang valid");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        businessId: selectedBusinessId,
        slot: draft.slot.trim(),
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        layoutType: draft.layoutType,
        isActive: draft.isActive,
        sortOrder: Number(draft.sortOrder || 0),
        items: parsedItems,
      };

      if (editingId) {
        await adminPut(`/admin/marketing/business-carousels/${editingId}`, body);
      } else {
        await adminPost("/admin/marketing/business-carousels", body);
      }

      notifySuccess(editingId ? "Carousel updated" : "Carousel created");
      resetDraft();
      await loadItems(selectedBusinessId);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan carousel");
    } finally {
      setSubmitting(false);
    }
  };

  const businessLabel = selectedBusiness ? `${selectedBusiness.name} / ${selectedBusiness.slug}` : selectedBusinessId || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Business Carousel</h3>
          <p className="text-sm text-slate-600">Kelola carousel storefront per business_id.</p>
        </div>
        <button type="button" onClick={resetDraft} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + New Carousel
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business target</p>
            <p className="text-sm text-slate-600">Semua carousel di bawah ini akan tersimpan dengan business_id yang dipilih.</p>
          </div>

          <div className="min-w-[280px]">
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedBusinessId}
              onChange={(event) => setSelectedBusinessId(event.target.value)}
              disabled={loadingBusinesses}
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
          Target aktif: <span className="font-medium text-slate-900">{businessLabel}</span>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div> : null}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{editingId ? "Edit Carousel" : "Create Carousel"}</h4>
            <p className="text-xs text-slate-500">Items disimpan sebagai JSON array agar fleksibel untuk layout carousel.</p>
          </div>
          {editingId ? (
            <button type="button" onClick={resetDraft} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Slot</span>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.slot} onChange={(event) => setDraft((current) => ({ ...current, slot: event.target.value }))}>
              <option value="hero">hero</option>
              <option value="featured">featured</option>
              <option value="promo">promo</option>
              <option value="banner">banner</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Layout Type</span>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.layoutType} onChange={(event) => setDraft((current) => ({ ...current, layoutType: event.target.value as CarouselFormState["layoutType"] }))}>
              <option value="large">large</option>
              <option value="medium">medium</option>
              <option value="banner">banner</option>
            </select>
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Title</span>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Judul carousel" />
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Subtitle</span>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.subtitle} onChange={(event) => setDraft((current) => ({ ...current, subtitle: event.target.value }))} placeholder="Subjudul carousel" />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Sort Order</span>
            <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
            <span className="font-medium text-slate-700">Active</span>
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Items JSON</span>
            <textarea
              className="min-h-[220px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              value={draft.itemsJson}
              onChange={(event) => setDraft((current) => ({ ...current, itemsJson: event.target.value }))}
              placeholder='[{"id":"item-1","title":"Promo","subtitle":"...","image":"","href":""}]'
            />
            <p className="text-xs text-slate-500">Format item: id, title, subtitle, image, href.</p>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={submitting || !selectedBusinessId} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? "Saving..." : editingId ? "Update Carousel" : "Create Carousel"}
          </button>
          <button type="button" onClick={resetDraft} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Reset
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Carousel list</h4>
            <p className="text-xs text-slate-500">Data yang tersimpan untuk business target saat ini.</p>
          </div>
          {loadingItems ? <span className="text-xs text-slate-500">Loading...</span> : null}
        </div>

        {!loadingItems && items.length === 0 ? <div className="mt-4 text-sm text-slate-500">Belum ada carousel untuk business ini.</div> : null}

        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2">Slot</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Layout</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{record.slot}</td>
                    <td className="px-3 py-2 text-slate-700">
                      <div className="font-medium text-slate-900">{record.title}</div>
                      {record.subtitle ? <div className="text-xs text-slate-500">{record.subtitle}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{record.layoutType}</td>
                    <td className="px-3 py-2 text-slate-600">{record.items.length}</td>
                    <td className="px-3 py-2 text-slate-600">{record.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(record.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleEdit(record)} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDelete(record)} className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100" disabled={submitting}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}