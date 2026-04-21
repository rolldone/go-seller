import { useEffect, useMemo, useState } from "react";

import AdminModal from "../ui/AdminModal";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listProductTranslations, upsertProductTranslation } from "./api";
import type { Product, ProductTranslation } from "./types";
import RichTextEditor, { type RichTextValue } from "../ui/RichTextEditor";
import SeoSegment from "../SeoSegment.tsx";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/react";

type Props = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
};

type Locale = "id" | "en";

type TranslationForm = {
  name: string;
  slug: string;
  description: string;
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

const emptyForm: TranslationForm = {
  name: "",
  slug: "",
  description: "",
  short_description: "",
};

const localeLabels: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

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

export default function ProductTranslationsModal({ open, product, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState<Locale>("id");
  const [items, setItems] = useState<ProductTranslation[]>([]);
  const [form, setForm] = useState<TranslationForm>(emptyForm);
  const [descriptionValue, setDescriptionValue] = useState<RichTextValue>({ html: "", plain: "", blocks: { type: "doc", content: [] } });
  const [seoContent, setSeoContent] = useState<SeoContent | null>(null);

  const currentTranslation = useMemo(
    () => items.find((item) => item.locale === locale) || null,
    [items, locale],
  );

  const refresh = async (activeLocale = locale) => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const data = await listProductTranslations(product.id);
      setItems(data);
      const picked = data.find((item) => item.locale === activeLocale);
      if (picked) {
        setForm({
          name: picked.name || "",
          slug: picked.slug || "",
          description: picked.description || "",
          short_description: picked.short_description || "",
        });
        setSeoContent(parseSeoContent(picked.seo_content));
        setDescriptionValue({
          html: picked.description_html || picked.description || "",
          plain: picked.description_plain || picked.description || "",
          blocks: (picked as any).description_blocks || (picked.description ? { type: "doc", content: [] } : { type: "doc", content: [] }),
        });
      } else {
        setForm({
          name: activeLocale === "id" ? product.name || "" : "",
          slug: activeLocale === "id" ? product.slug || "" : "",
          description: activeLocale === "id" ? product.description || "" : "",
          short_description: activeLocale === "id" ? product.short_description || "" : "",
        });
        setSeoContent(activeLocale === "id" ? parseSeoContent(product.seo_content) : null);
        setDescriptionValue({
          html: activeLocale === "id" ? (product.description_html || product.description || "") : "",
          plain: activeLocale === "id" ? (product.description_plain || product.description || "") : "",
          blocks: (product as any).description_blocks || (product.description ? { type: "doc", content: [] } : { type: "doc", content: [] }),
        });
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to load product translations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !product?.id) return;
    setLocale("id");
    refresh("id");
  }, [open, product?.id]);

  useEffect(() => {
    if (!open || !product?.id) return;
    const picked = items.find((item) => item.locale === locale);
    if (picked) {
      setForm({
        name: picked.name || "",
        slug: picked.slug || "",
        description: picked.description || "",
        short_description: picked.short_description || "",
      });
      setSeoContent(parseSeoContent(picked.seo_content));
      setDescriptionValue({
        html: picked.description_html || picked.description || "",
        plain: picked.description_plain || picked.description || "",
        blocks: (picked as any).description_blocks || (picked.description ? { type: "doc", content: [] } : { type: "doc", content: [] }),
      });
      return;
    }
    setForm({
      name: locale === "id" ? product.name || "" : "",
      slug: locale === "id" ? product.slug || "" : "",
      description: locale === "id" ? product.description || "" : "",
      short_description: locale === "id" ? product.short_description || "" : "",
    });
    setSeoContent(locale === "id" ? parseSeoContent(product.seo_content) : null);
    setDescriptionValue({
      html: locale === "id" ? (product.description_html || product.description || "") : "",
      plain: locale === "id" ? (product.description_plain || product.description || "") : "",
      blocks: (product as any).description_blocks || (product.description ? { type: "doc", content: [] } : { type: "doc", content: [] }),
    });
  }, [locale, open, product, items]);

  const handleSave = async () => {
    if (!product?.id) return;
    if (!form.name.trim() || !form.slug.trim()) {
      notifyError("Name dan slug wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await upsertProductTranslation(product.id, locale, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: (descriptionValue.plain || form.description).trim() || undefined,
        description_html: (descriptionValue.html || "").trim() || undefined,
        description_plain: (descriptionValue.plain || "").trim() || undefined,
        description_blocks: (descriptionValue.blocks as unknown) || undefined,
        short_description: form.short_description.trim() || undefined,
        seo_content: seoContent || undefined,
      });
      notifySuccess(`Translation ${localeLabels[locale]} saved`);
      await refresh(locale);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save translation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={product ? `Product Translation: ${product.name}` : "Product Translation"}
      maxWidth="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
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
      {!product ? null : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Translation</p>
            <p className="text-sm text-slate-600">Edit localized content for this product. Ensure Indonesian translation exists before publish.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Locale</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                <option value="id">Indonesia (id)</option>
                <option value="en">English (en)</option>
              </select>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between">
              <p>
                Existing entries: <strong>{items.length}</strong>
              </p>
              <p>
                Current status: <strong>{currentTranslation ? "saved" : "new"}</strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  // import from product into form
                  if (!product) return;
                  setForm((prev) => ({
                    ...prev,
                    name: product.name || "",
                    slug: product.slug || "",
                    short_description: product.short_description || "",
                  }));
                  setSeoContent(parseSeoContent(product.seo_content));
                  // If product has blocks, use them. Otherwise convert HTML -> blocks synchronously
                  const html = product.description_html || product.description || "";
                  const plain = product.description_plain || product.description || "";
                  let blocks: JSONContent = (product as any).description_blocks || { type: "doc", content: [] };
                  if ((!blocks || (blocks as any).type !== "doc" || ((blocks as any).content || []).length === 0) && html) {
                    try {
                      const tmp = new Editor({
                        extensions: [StarterKit],
                        content: html,
                      });
                      blocks = tmp.getJSON() as JSONContent;
                      tmp.destroy();
                    } catch (err) {
                      // fallback to empty doc
                      blocks = { type: "doc", content: [] };
                    }
                  }
                  setDescriptionValue({ html, plain, blocks });
                }}
                className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Import from product
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Localized product name"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</span>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="localized-slug"
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Auto
                </button>
              </div>
            </label>
          </div>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Short Description</span>
            <textarea
              className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm"
              value={form.short_description}
              onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
              placeholder="Short summary"
            />
          </label>

          <div className="text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
            <RichTextEditor value={descriptionValue.html} placeholder="Full description" onChange={setDescriptionValue} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SEO Translation</p>
                <p className="text-sm text-slate-600">Locale-specific SEO metadata is saved only for the selected translation.</p>
              </div>
              <button
                type="button"
                onClick={() => setSeoContent(parseSeoContent(product.seo_content))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Import from product SEO
              </button>
            </div>
            <SeoSegment value={seoContent} onChange={setSeoContent} />
          </section>
        </div>
      )}
    </AdminModal>
  );
}
