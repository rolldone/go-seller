import { useEffect, useMemo, useState } from "react";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import { memberGet, memberPut } from "./api";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { BusinessDisclaimer, BusinessDisclaimerTranslation, BusinessDisclaimerTranslationPayload } from "./types";

type Locale = "id" | "en";

type Props = {
  open: boolean;
  businessID?: string;
  disclaimer: BusinessDisclaimer | null;
  onClose: () => void;
};

const localeLabels: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

const emptyRichTextValue = (): RichTextValue => ({
  html: "",
  plain: "",
  blocks: { type: "doc", content: [] },
});

export default function BusinessDisclaimerTranslationsModal({ open, businessID, disclaimer, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState<Locale>("id");
  const [items, setItems] = useState<BusinessDisclaimerTranslation[]>([]);
  const [title, setTitle] = useState("");
  const [bodyValue, setBodyValue] = useState<RichTextValue>(() => emptyRichTextValue());

  const currentTranslation = useMemo(() => items.find((item) => item.locale === locale) || null, [items, locale]);

  const importFromDisclaimer = (targetDisclaimer: BusinessDisclaimer | null) => {
    if (!targetDisclaimer) return;
    setTitle(targetDisclaimer.title || "");
    const html = targetDisclaimer.content_html || targetDisclaimer.content_plain || "";
    setBodyValue({
      html,
      plain: targetDisclaimer.content_plain || targetDisclaimer.content_html || "",
      blocks: { type: "doc", content: [] },
    });
  };

  const applyTranslation = (translation: BusinessDisclaimerTranslation | null) => {
    if (!translation) {
      importFromDisclaimer(disclaimer);
      return;
    }

    setTitle(translation.title || "");
    setBodyValue({
      html: translation.content_html || translation.content_plain || "",
      plain: translation.content_plain || translation.content_html || "",
      blocks: { type: "doc", content: [] },
    });
  };

  const refresh = async (activeLocale = locale) => {
    if (!businessID || !disclaimer?.id) return;
    setLoading(true);
    try {
      const res = await memberGet<{ data: BusinessDisclaimerTranslation[] }>(`/api/member/businesses/${businessID}/disclaimers/${disclaimer.id}/translations`);
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      const picked = data.find((item) => item.locale === activeLocale) || null;
      applyTranslation(picked);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to load disclaimer translations");
      setItems([]);
      importFromDisclaimer(disclaimer);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !disclaimer?.id) return;
    setLocale("id");
    void refresh("id");
  }, [open, disclaimer?.id]);

  useEffect(() => {
    if (!open || !disclaimer?.id) return;
    const picked = currentTranslation;
    if (picked) {
      applyTranslation(picked);
      return;
    }
    importFromDisclaimer(disclaimer);
  }, [locale, open, disclaimer, currentTranslation]);

  const handleSave = async () => {
    if (!businessID || !disclaimer?.id) return;

    const trimmedTitle = title.trim();
    const trimmedHtml = bodyValue.html.trim();
    const trimmedPlain = bodyValue.plain.trim();

    if (!trimmedTitle) {
      notifyError("Title translation wajib diisi.");
      return;
    }
    if (!trimmedHtml && !trimmedPlain) {
      notifyError("Isi disclaimer translation wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const payload: BusinessDisclaimerTranslationPayload = {
        title: trimmedTitle || undefined,
        content_html: trimmedHtml || undefined,
        content_plain: trimmedPlain || undefined,
      };
      await memberPut(`/api/member/businesses/${businessID}/disclaimers/${disclaimer.id}/translations/${locale}`, payload);
      notifySuccess(`Translation ${localeLabels[locale]} saved`);
      await refresh(locale);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save disclaimer translation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MemberModal
      open={open}
      onClose={onClose}
      title={disclaimer ? `Disclaimer Translation: ${disclaimer.title || "(Tanpa judul)"}` : "Disclaimer Translation"}
      maxWidth="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            Close
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving || loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">
            {saving ? "Saving..." : "Save Translation"}
          </button>
        </>
      }
    >
      {disclaimer ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Disclaimer Translation</p>
            <p className="text-sm text-slate-600">Terjemahkan title dan isi disclaimer untuk locale yang dipilih.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Locale</span>
              <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                <option value="id">Indonesia (id)</option>
                <option value="en">English (en)</option>
              </select>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between gap-3">
              <p>Existing entries: <strong>{items.length}</strong></p>
              <p>Current status: <strong>{currentTranslation ? "saved" : "new"}</strong></p>
              <button type="button" onClick={() => importFromDisclaimer(disclaimer)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100">
                Import from base
              </button>
            </div>
          </div>

          <label className="text-sm block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
            <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Localized disclaimer title" />
          </label>

          <MemberRichTextEditor value={bodyValue.html} title="Deskripsi" helperText="Terjemahkan isi disclaimer yang tampil di popup detail." placeholder="Localized disclaimer content" onChange={setBodyValue} />
        </div>
      ) : null}
    </MemberModal>
  );
}