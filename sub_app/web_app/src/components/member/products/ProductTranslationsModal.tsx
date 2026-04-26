import { useEffect, useMemo, useState } from "react";

import MemberModal from "../ui/MemberModal";
import MemberRichTextEditor, { type RichTextValue } from "../ui/MemberRichTextEditor";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listMemberProductTranslations, upsertMemberProductTranslation } from "./api";
import type { Product, ProductTranslation } from "./types";

type Props = {
	open: boolean;
	product: Product | null;
	onClose: () => void;
};

type Locale = "id" | "en";

type FormState = {
	name: string;
	slug: string;
	short_description: string;
};

const emptyForm: FormState = {
	name: "",
	slug: "",
	short_description: "",
};

const localeLabels: Record<Locale, string> = {
	id: "Indonesia",
	en: "English",
};

export default function ProductTranslationsModal({ open, product, onClose }: Props) {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [locale, setLocale] = useState<Locale>("id");
	const [items, setItems] = useState<ProductTranslation[]>([]);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({ html: "", plain: "", blocks: { type: "doc", content: [] } });

	const currentTranslation = useMemo(() => items.find((item) => item.locale === locale) || null, [items, locale]);

	const applyFallback = () => {
		if (!product) return;
		setForm({
			name: product.name || "",
			slug: product.slug || "",
			short_description: product.short_description || "",
		});
		setDescriptionValue({
			html: product.description_html || product.description || "",
			plain: product.description_plain || product.description || "",
			blocks: (product.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
		});
	};

	const applyTranslation = (translation: ProductTranslation | null) => {
		if (!translation) {
			applyFallback();
			return;
		}
		setForm({
			name: translation.name || "",
			slug: translation.slug || "",
			short_description: translation.short_description || "",
		});
		setDescriptionValue({
			html: translation.description_html || translation.description || "",
			plain: translation.description_plain || translation.description || "",
			blocks: (translation.description_blocks as RichTextValue["blocks"]) || { type: "doc", content: [] },
		});
	};

	const refresh = async (activeLocale = locale) => {
		if (!product?.id) return;
		setLoading(true);
		try {
			const data = await listMemberProductTranslations(product.id);
			setItems(data);
			applyTranslation(data.find((item) => item.locale === activeLocale) || null);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Failed to load product translations");
			setItems([]);
			applyFallback();
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open || !product?.id) return;
		setLocale("id");
		void refresh("id");
	}, [open, product?.id]);

	useEffect(() => {
		if (!open || !product?.id) return;
		const picked = currentTranslation;
		if (picked) {
			applyTranslation(picked);
			return;
		}
		applyFallback();
	}, [locale, open, product, currentTranslation]);

	const handleSave = async () => {
		if (!product?.id) return;
		if (!form.name.trim() || !form.slug.trim()) {
			notifyError("Name dan slug wajib diisi");
			return;
		}
		setSaving(true);
		try {
			await upsertMemberProductTranslation(product.id, locale, {
				name: form.name.trim(),
				slug: form.slug.trim(),
				short_description: form.short_description.trim() || undefined,
				description_html: descriptionValue.html.trim() || undefined,
				description_plain: descriptionValue.plain.trim() || undefined,
				description_blocks: descriptionValue.blocks || undefined,
			});
			notifySuccess(`Translation ${localeLabels[locale]} saved`);
			await refresh(locale);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Failed to save product translation");
		} finally {
			setSaving(false);
		}
	};

	return (
		<MemberModal
			open={open}
			onClose={onClose}
			title={product ? `Product Translation: ${product.name}` : "Product Translation"}
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
			{product ? (
				<div className="space-y-5">
					<div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Translation</p>
						<p className="text-sm text-slate-600">Kelola nama, slug, dan ringkasan product untuk locale yang dipilih.</p>
					</div>

					<div className="grid gap-2 sm:grid-cols-2">
						<label className="space-y-1 text-sm">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Locale</span>
							<select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
								<option value="id">Indonesia (id)</option>
								<option value="en">English (en)</option>
							</select>
						</label>
						<div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
							<p>Existing entries: <strong>{items.length}</strong></p>
							<p>Status: <strong>{currentTranslation ? "saved" : "new"}</strong></p>
						</div>
					</div>

					<label className="block text-sm">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
						<input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
					</label>

					<label className="block text-sm">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
						<input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
					</label>

					<label className="block text-sm">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span>
						<textarea className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.short_description} onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))} />
					</label>

					<MemberRichTextEditor value={descriptionValue.html} placeholder="Tulis deskripsi product" onChange={setDescriptionValue} />
				</div>
			) : null}
		</MemberModal>
	);
}