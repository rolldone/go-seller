import { useEffect, useMemo, useState } from "react";

import AdminModal from "../ui/AdminModal";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminGet, adminPut } from "../entities/adminApi";
import RichTextEditor, { type RichTextValue } from "../ui/RichTextEditor";
import type { Business } from "./types";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/react";

type Locale = "id" | "en";

type BusinessTranslation = {
	id: string;
	business_id: string;
	locale: Locale;
	short_description?: string | null;
	highlights?: string[] | null;
	story_html?: string | null;
	story_plain?: string | null;
	story_blocks?: unknown;
	created_at?: string;
	updated_at?: string;
};

type TranslationForm = {
	short_description: string;
	highlights: string;
};

type Props = {
	open: boolean;
	business: Business | null;
	onClose: () => void;
};

const emptyForm: TranslationForm = {
	short_description: "",
	highlights: "",
};

const localeLabels: Record<Locale, string> = {
	id: "Indonesia",
	en: "English",
};

export default function BusinessTranslationsModal({ open, business, onClose }: Props) {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [locale, setLocale] = useState<Locale>("id");
	const [items, setItems] = useState<BusinessTranslation[]>([]);
	const [form, setForm] = useState<TranslationForm>(emptyForm);
	const [storyValue, setStoryValue] = useState<RichTextValue>({ html: "", plain: "", blocks: { type: "doc", content: [] } });

	const currentTranslation = useMemo(() => items.find((item) => item.locale === locale) || null, [items, locale]);

	const importFromBusiness = (targetLocale: Locale) => {
		if (!business) return;
		setForm({
				short_description: business.short_description || "",
			highlights: Array.isArray(business.highlights) ? business.highlights.filter(Boolean).join("\n") : "",
		});
			const html = business.description_html || business.description || "";
			const plain = business.description_plain || business.description || "";
		let blocks: JSONContent = (business.description_blocks as JSONContent) || { type: "doc", content: [] };
		if ((!blocks || (blocks as any).type !== "doc" || ((blocks as any).content || []).length === 0) && html) {
			try {
				const editor = new Editor({ extensions: [StarterKit], content: html });
				blocks = editor.getJSON() as JSONContent;
				editor.destroy();
			} catch {
				blocks = { type: "doc", content: [] };
			}
		}
		setStoryValue({ html, plain, blocks });
	};

	const refresh = async (activeLocale = locale) => {
		if (!business?.id) return;
		setLoading(true);
		try {
			const res = await adminGet<{ data: BusinessTranslation[] }>(`/admin/catalog/businesses/${business.id}/translations`);
			const data = res.data || [];
			setItems(data);
			const picked = data.find((item) => item.locale === activeLocale);
			if (picked) {
				setForm({
					short_description: picked.short_description || "",
					highlights: Array.isArray(picked.highlights) ? picked.highlights.filter(Boolean).join("\n") : "",
				});
				setStoryValue({
					html: picked.story_html || picked.story_plain || "",
					plain: picked.story_plain || picked.story_html || "",
					blocks: (picked.story_blocks as JSONContent) || { type: "doc", content: [] },
				});
			} else {
				importFromBusiness(activeLocale);
			}
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Failed to load business translations");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open || !business?.id) return;
		setLocale("id");
		refresh("id");
	}, [open, business?.id]);

	useEffect(() => {
		if (!open || !business?.id) return;
		const picked = items.find((item) => item.locale === locale);
		if (picked) {
			setForm({
				short_description: picked.short_description || "",
				highlights: Array.isArray(picked.highlights) ? picked.highlights.filter(Boolean).join("\n") : "",
			});
			setStoryValue({
				html: picked.story_html || picked.story_plain || "",
				plain: picked.story_plain || picked.story_html || "",
				blocks: (picked.story_blocks as JSONContent) || { type: "doc", content: [] },
			});
			return;
		}
		importFromBusiness(locale);
	}, [locale, open, business, items]);

	const handleSave = async () => {
		if (!business?.id) return;
		setSaving(true);
		try {
			const highlights = form.highlights.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
			await adminPut(`/admin/catalog/businesses/${business.id}/translations/${locale}`, {
				short_description: form.short_description.trim() || undefined,
				highlights: highlights.length > 0 ? highlights : undefined,
				story_html: (storyValue.html || "").trim() || undefined,
				story_plain: (storyValue.plain || "").trim() || undefined,
				story_blocks: storyValue.blocks || undefined,
			});
			notifySuccess(`Translation ${localeLabels[locale]} saved`);
			await refresh(locale);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Failed to save business translation");
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminModal
			open={open}
			onClose={onClose}
			title={business ? `Business Translation: ${business.name}` : "Business Translation"}
			maxWidth="xl"
			footer={
				<>
					<button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
						Close
					</button>
					<button type="button" onClick={handleSave} disabled={saving || loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70">
						{saving ? "Saving..." : "Save Translation"}
					</button>
				</>
			}
		>
			{business ? (
				<div className="space-y-5">
					<div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Translation</p>
						<p className="text-sm text-slate-600">Fokus ke short description, highlights, dan story untuk locale yang dipilih.</p>
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
							<button
								type="button"
								onClick={() => importFromBusiness(locale)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
							>
								Import from business
							</button>
						</div>
					</div>

					<label className="text-sm block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span>
						<textarea className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.short_description} onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))} placeholder="Localized short description" />
					</label>

					<label className="text-sm block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Highlights</span>
						<textarea className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.highlights} onChange={(e) => setForm((prev) => ({ ...prev, highlights: e.target.value }))} placeholder="Satu highlight per baris" />
					</label>

					<RichTextEditor value={storyValue.html} placeholder="Tulis story bisnis" onChange={setStoryValue} />
				</div>
			) : null}
		</AdminModal>
	);
}