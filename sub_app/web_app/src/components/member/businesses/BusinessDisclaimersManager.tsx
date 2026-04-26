import { useEffect, useState } from "react";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import type { BusinessDisclaimer, BusinessDisclaimerPayload } from "./types";
import BusinessDisclaimerTranslationsModal from "./BusinessDisclaimerTranslationsModal";
import { memberDelete, memberGet, memberPost, memberPut } from "./api";
import { notifyError, notifySuccess } from "../../../lib/notification";

type DisclaimerFormState = {
  description: RichTextValue;
  title: string;
  iconKey: string;
  sortOrder: string;
  isActive: boolean;
};

type Props = {
  businessID?: string;
};

const defaultDisclaimerForm = (): DisclaimerFormState => ({
  description: {
    html: "",
    plain: "",
    blocks: { type: "doc", content: [] },
  },
  title: "",
  iconKey: "shield",
  sortOrder: "0",
  isActive: true,
});

export default function BusinessDisclaimersManager({ businessID }: Props) {
  const [disclaimers, setDisclaimers] = useState<BusinessDisclaimer[]>([]);
  const [loadingDisclaimers, setLoadingDisclaimers] = useState(false);
  const [savingDisclaimer, setSavingDisclaimer] = useState(false);
  const [disclaimerModalOpen, setDisclaimerModalOpen] = useState(false);
  const [editingDisclaimerID, setEditingDisclaimerID] = useState<string | null>(null);
  const [translationDisclaimer, setTranslationDisclaimer] = useState<BusinessDisclaimer | null>(null);
  const [translationModalOpen, setTranslationModalOpen] = useState(false);
  const [disclaimerError, setDisclaimerError] = useState("");
  const [disclaimerForm, setDisclaimerForm] = useState<DisclaimerFormState>(() => defaultDisclaimerForm());

  const resetDisclaimerForm = () => {
    setDisclaimerError("");
    setEditingDisclaimerID(null);
    setDisclaimerForm(defaultDisclaimerForm());
  };

  const closeDisclaimerModal = () => {
    setDisclaimerModalOpen(false);
    setDisclaimerError("");
  };

  const openTranslationModal = (disclaimer: BusinessDisclaimer) => {
    setTranslationDisclaimer(disclaimer);
    setTranslationModalOpen(true);
  };

  const closeTranslationModal = () => {
    setTranslationModalOpen(false);
    setTranslationDisclaimer(null);
  };

  const loadDisclaimers = async (currentBusinessID: string) => {
    setLoadingDisclaimers(true);
    try {
      const res = await memberGet<{ data: BusinessDisclaimer[] }>(`/api/member/businesses/${currentBusinessID}/disclaimers?limit=100`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setDisclaimers([...rows].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
    } catch (err) {
      console.error("Failed to load business disclaimers", err);
      setDisclaimers([]);
    } finally {
      setLoadingDisclaimers(false);
    }
  };

  const openNewDisclaimerModal = () => {
    resetDisclaimerForm();
    setDisclaimerModalOpen(true);
  };

  const openEditDisclaimerModal = (disclaimer: BusinessDisclaimer) => {
    setDisclaimerError("");
    setEditingDisclaimerID(disclaimer.id);
    setDisclaimerForm({
      description: {
        html: disclaimer.content_html || disclaimer.content_plain || "",
        plain: disclaimer.content_plain || "",
        blocks: { type: "doc", content: [] },
      },
      title: disclaimer.title || "",
      iconKey: disclaimer.icon_key || "shield",
      sortOrder: String(disclaimer.sort_order ?? 0),
      isActive: disclaimer.is_active !== false,
    });
    setDisclaimerModalOpen(true);
  };

  const saveDisclaimer = async () => {
    if (!businessID) {
      setDisclaimerError("Simpan business terlebih dahulu sebelum menambahkan disclaimer.");
      return;
    }

    const title = disclaimerForm.title.trim();
    const html = disclaimerForm.description.html.trim();
    const plain = disclaimerForm.description.plain.trim();
    if (!title) {
      setDisclaimerError("Title wajib diisi.");
      return;
    }
    if (!html && !plain) {
      setDisclaimerError("Deskripsi disclaimer wajib diisi.");
      return;
    }

    const payload: BusinessDisclaimerPayload = {
      title: title || undefined,
      content_html: html || undefined,
      content_plain: plain || undefined,
      icon_key: disclaimerForm.iconKey.trim() || undefined,
      sort_order: Number.parseInt(disclaimerForm.sortOrder || "0", 10) || 0,
      is_active: disclaimerForm.isActive,
    };

    setDisclaimerError("");
    setSavingDisclaimer(true);
    try {
      if (editingDisclaimerID) {
        await memberPut(`/api/member/businesses/${businessID}/disclaimers/${editingDisclaimerID}`, payload);
        notifySuccess("Disclaimer updated");
      } else {
        await memberPost(`/api/member/businesses/${businessID}/disclaimers`, payload);
        notifySuccess("Disclaimer created");
      }
      await loadDisclaimers(businessID);
      closeDisclaimerModal();
      resetDisclaimerForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan disclaimer";
      setDisclaimerError(message);
      notifyError(message);
    } finally {
      setSavingDisclaimer(false);
    }
  };

  const removeDisclaimer = async (disclaimerID: string) => {
    if (!businessID) return;
    if (!window.confirm("Hapus disclaimer ini?")) return;

    try {
      await memberDelete(`/api/member/businesses/${businessID}/disclaimers/${disclaimerID}`);
      notifySuccess("Disclaimer deleted");
      await loadDisclaimers(businessID);
      if (editingDisclaimerID === disclaimerID) {
        resetDisclaimerForm();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus disclaimer";
      notifyError(message);
    }
  };

  useEffect(() => {
    if (!businessID) {
      setDisclaimers([]);
      closeDisclaimerModal();
      closeTranslationModal();
      resetDisclaimerForm();
      return;
    }

    void loadDisclaimers(businessID);
  }, [businessID]);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Business Disclaimers</h4>
            <p className="mt-1 text-xs text-slate-500">Kelola pesan yang tampil di halaman produk publik sebelum tombol beli.</p>
          </div>
          {businessID ? (
            <button
              type="button"
              onClick={openNewDisclaimerModal}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              New Disclaimer
            </button>
          ) : null}
        </div>

        {businessID ? (
          <div className="mt-4 space-y-3">
            {loadingDisclaimers ? (
              <p className="text-sm text-slate-500">Loading disclaimers...</p>
            ) : disclaimers.length > 0 ? (
              disclaimers.map((disclaimer) => (
                <div key={disclaimer.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{disclaimer.title || "(Tanpa judul)"}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Order {disclaimer.sort_order || 0} · {disclaimer.is_active ? "Active" : "Inactive"}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700 line-clamp-2 whitespace-pre-line">{disclaimer.content_plain || "-"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" onClick={() => openEditDisclaimerModal(disclaimer)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                        Edit
                      </button>
                      <button type="button" onClick={() => openTranslationModal(disclaimer)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100">
                        Translate
                      </button>
                      <button type="button" onClick={() => void removeDisclaimer(disclaimer.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">Belum ada disclaimer untuk business ini.</div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">Simpan business terlebih dahulu untuk mengelola disclaimer.</div>
        )}
      </section>

      <MemberModal
        open={disclaimerModalOpen}
        title={editingDisclaimerID ? "Edit Disclaimer" : "New Disclaimer"}
        onClose={closeDisclaimerModal}
        maxWidth="lg"
        footer={
          <>
            <button type="button" onClick={closeDisclaimerModal} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100" disabled={savingDisclaimer}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveDisclaimer()} disabled={savingDisclaimer} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">
              {savingDisclaimer ? "Saving..." : editingDisclaimerID ? "Update Disclaimer" : "Add Disclaimer"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Isi title terlebih dahulu, lalu tambahkan deskripsi disclaimer di bawahnya.</div>

          <label className="text-sm block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
            <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" value={disclaimerForm.title} onChange={(e) => setDisclaimerForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Tulis title disclaimer" />
          </label>

          <label className="text-sm block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Icon</span>
            <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" value={disclaimerForm.iconKey} onChange={(e) => setDisclaimerForm((prev) => ({ ...prev, iconKey: e.target.value }))}>
              <option value="shield">Shield</option>
              <option value="truck">Truck</option>
              <option value="store">Store</option>
              <option value="info">Info</option>
            </select>
          </label>

          <label className="text-sm block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort Order</span>
            <input type="number" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100" value={disclaimerForm.sortOrder} onChange={(e) => setDisclaimerForm((prev) => ({ ...prev, sortOrder: e.target.value }))} />
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={disclaimerForm.isActive} onChange={(e) => setDisclaimerForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Active
          </label>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <MemberRichTextEditor value={disclaimerForm.description.html} title="Deskripsi" helperText="Tulis deskripsi disclaimer yang tampil di popup detail." placeholder="Tulis isi deskripsi disclaimer" onChange={(value) => setDisclaimerForm((prev) => ({ ...prev, description: value }))} />
          </div>

          <p className="text-xs text-slate-500">Editor ini menyimpan HTML dan plain text agar dapat dirender di halaman publik.</p>

          {disclaimerError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{disclaimerError}</div> : null}
        </div>
      </MemberModal>

      <BusinessDisclaimerTranslationsModal open={translationModalOpen} businessID={businessID} disclaimer={translationDisclaimer} onClose={closeTranslationModal} />
    </>
  );
}