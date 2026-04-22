import { useEffect, useMemo, useState } from "react";

import AdminModal from "../ui/AdminModal";
import RichTextEditor, { type RichTextValue } from "../ui/RichTextEditor";
import { notifyError, notifySuccess } from "../../../lib/notification";
import SeoSegment from "../SeoSegment.tsx";
import { listCategoryTranslations, upsertCategoryTranslation } from "./api";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  description_html?: string | null;
  description_plain?: string | null;
  description_blocks?: unknown;
  short_description?: string | null;
  seo_content?: unknown;
};

type Props = {
  open: boolean;
  category: Category | null;
  onClose: () => void;
};

type Locale = "id" | "en";

type FormState = {
  name: string;
  slug: string;
  short_description: string;
};

type SeoContent = {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  og?: { title?: string; description?: string; image?: string };
  twitter?: { card?: string; site?: string; title?: string; description?: string; image?: string };
  robots?: string;
  structured_data?: unknown;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  short_description: "",
};

const emptyDescriptionValue: RichTextValue = {
  html: "",
  plain: "",
  blocks: { type: "doc", content: [] },
};

function parseDescriptionValue(input: unknown): RichTextValue {
  if (!input) return emptyDescriptionValue;

  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const source = input as Record<string, unknown>;
    return {
      html: String(source.html || ""),
      plain: String(source.plain || ""),
      blocks: (source.blocks as RichTextValue["blocks"]) || emptyDescriptionValue.blocks,
    };
  }

  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return emptyDescriptionValue;
    return {
      html: raw,
      plain: raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      blocks: emptyDescriptionValue.blocks,
    };
  }

  return emptyDescriptionValue;
}

const localeLabels: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

function parseSeoContent(input: unknown): SeoContent | null {
  if (!input) return null;

  let raw: unknown = input;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const source = raw as Record<string, any>;
  const out: SeoContent = {};

  if (String(source.title ?? "").trim()) out.title = String(source.title ?? "").trim();
  if (String(source.description ?? "").trim()) out.description = String(source.description ?? "").trim();
  if (String(source.canonical ?? "").trim()) out.canonical = String(source.canonical ?? "").trim();
  if (String(source.image ?? "").trim()) out.image = String(source.image ?? "").trim();
  if (String(source.robots ?? "").trim()) out.robots = String(source.robots ?? "").trim();

  if (source.og && typeof source.og === "object" && !Array.isArray(source.og)) {
    const og: SeoContent["og"] = {};
    if (String(source.og.title ?? "").trim()) og.title = String(source.og.title ?? "").trim();
    if (String(source.og.description ?? "").trim()) og.description = String(source.og.description ?? "").trim();
    if (String(source.og.image ?? "").trim()) og.image = String(source.og.image ?? "").trim();
    if (Object.keys(og).length > 0) out.og = og;
  }

  if (source.twitter && typeof source.twitter === "object" && !Array.isArray(source.twitter)) {
    const twitter: SeoContent["twitter"] = {};
    if (String(source.twitter.card ?? "").trim()) twitter.card = String(source.twitter.card ?? "").trim();
    if (String(source.twitter.site ?? "").trim()) twitter.site = String(source.twitter.site ?? "").trim();
    if (String(source.twitter.title ?? "").trim()) twitter.title = String(source.twitter.title ?? "").trim();
    if (String(source.twitter.description ?? "").trim()) twitter.description = String(source.twitter.description ?? "").trim();
    if (String(source.twitter.image ?? "").trim()) twitter.image = String(source.twitter.image ?? "").trim();
    if (Object.keys(twitter).length > 0) out.twitter = twitter;
  }

  if (source.structured_data !== undefined && source.structured_data !== null && source.structured_data !== "") {
    out.structured_data = source.structured_data;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\u0000-\u007F]/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoryTranslationsModal({ open, category, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState<Locale>("id");
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCategoryTranslations>>>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [seoContent, setSeoContent] = useState<SeoContent | null>(null);
  const [descriptionValue, setDescriptionValue] = useState<RichTextValue>(emptyDescriptionValue);

  const currentTranslation = useMemo(() => items.find((item) => item.locale === locale) || null, [items, locale]);

  const refresh = async (activeLocale = locale) => {
    if (!category?.id) return;
    setLoading(true);
    try {
      const data = await listCategoryTranslations(category.id);
      setItems(data);
      const picked = data.find((item) => item.locale === activeLocale);
      if (picked) {
        setForm({ name: picked.name || "", slug: picked.slug || "", short_description: picked.short_description || "" });
        setSeoContent(parseSeoContent(picked.seo_content));
        setDescriptionValue(
          parseDescriptionValue(
            picked.description_html ?? picked.description_plain ?? picked.description ?? picked.description_blocks,
          ),
        );
      } else {
        setForm({
          name: activeLocale === "id" ? category.name || "" : "",
          slug: activeLocale === "id" ? category.slug || "" : "",
          short_description: activeLocale === "id" ? category.short_description || "" : "",
        });
        setSeoContent(activeLocale === "id" ? parseSeoContent(category.seo_content) : null);
        setDescriptionValue(
          activeLocale === "id"
            ? parseDescriptionValue(
                category.description_html ?? category.description_plain ?? category.description ?? category.description_blocks,
              )
            : emptyDescriptionValue,
        );
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to load category translations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !category?.id) return;
    setLocale("id");
    refresh("id");
  }, [open, category?.id]);

  useEffect(() => {
    if (!open || !category?.id) return;
    const picked = items.find((item) => item.locale === locale);
    if (picked) {
      setForm({ name: picked.name || "", slug: picked.slug || "", short_description: picked.short_description || "" });
      setSeoContent(parseSeoContent(picked.seo_content));
      setDescriptionValue(
        parseDescriptionValue(picked.description_html ?? picked.description_plain ?? picked.description ?? picked.description_blocks),
      );
      return;
    }
    setForm({
      name: locale === "id" ? category.name || "" : "",
      slug: locale === "id" ? category.slug || "" : "",
      short_description: locale === "id" ? category.short_description || "" : "",
    });
    setSeoContent(locale === "id" ? parseSeoContent(category.seo_content) : null);
    setDescriptionValue(
      locale === "id"
        ? parseDescriptionValue(category.description_html ?? category.description_plain ?? category.description ?? category.description_blocks)
        : emptyDescriptionValue,
    );
  }, [locale, open, category, items]);

  const handleSave = async () => {
    if (!category?.id) return;
    if (!form.name.trim() || !form.slug.trim()) {
      notifyError("Name dan slug wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await upsertCategoryTranslation(category.id, locale, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: descriptionValue.plain || undefined,
        description_html: descriptionValue.html || undefined,
        description_plain: descriptionValue.plain || undefined,
        description_blocks: descriptionValue.blocks,
        short_description: String(form.short_description || "").trim() || undefined,
        seo_content: seoContent || undefined,
      });
      notifySuccess(`Category translation ${localeLabels[locale]} saved`);
      await refresh(locale);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save category translation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={category ? `Category Translation: ${category.name}` : "Category Translation"}
      maxWidth="xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Translation"}
          </button>
        </>
      }
    >
      {!category ? null : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Translation</p>
            <p className="text-sm text-slate-600">Locale-specific category name, slug, and SEO metadata.</p>
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
              <p>
                Existing entries: <strong>{items.length}</strong>
              </p>
              <p>
                Current status: <strong>{currentTranslation ? "saved" : "new"}</strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  setForm({
                    name: category.name || "",
                    slug: category.slug || "",
                    short_description: category.short_description || "",
                  });
                  setSeoContent(parseSeoContent(category.seo_content));
                  setDescriptionValue(
                    parseDescriptionValue(
                      category.description_html ?? category.description_plain ?? category.description ?? category.description_blocks,
                    ),
                  );
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Import from category
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Localized category name" />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
              <div className="flex gap-2">
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="localized-category-slug" />
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100">
                  Auto
                </button>
              </div>
            </label>
          </div>

          <label className="text-sm block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
              value={form.short_description}
              onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
              placeholder="Localized short description"
            />
          </label>

          <RichTextEditor
            value={descriptionValue.html}
            title="Description"
            helperText="Localized category description for this locale."
            onChange={setDescriptionValue}
          />

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SEO Translation</p>
                <p className="text-sm text-slate-600">Locale-specific SEO metadata is saved for this category translation.</p>
              </div>
              <button
                type="button"
                onClick={() => setSeoContent(parseSeoContent(category.seo_content))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Import from category SEO
              </button>
            </div>
            <SeoSegment value={seoContent} onChange={setSeoContent} />
          </section>
        </div>
      )}
    </AdminModal>
  );
}