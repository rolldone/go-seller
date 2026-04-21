import { useEffect, useRef, useState } from "react";

type SeoContent = {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  og?: { title?: string; description?: string; image?: string };
  twitter?: { card?: string; site?: string; title?: string; description?: string; image?: string };
  robots?: string;
  structured_data?: any;
};

type Props = {
  value?: SeoContent | null;
  onChange?: (value: SeoContent | null) => void;
};

export default function SeoSegment({ value, onChange }: Props) {
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const textareaClass = `${inputClass} font-mono`;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canonical, setCanonical] = useState("");
  const [image, setImage] = useState("");
  const [robots, setRobots] = useState("");

  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImage, setOgImage] = useState("");

  const [twitterCard, setTwitterCard] = useState("");
  const [twitterSite, setTwitterSite] = useState("");
  const [twitterTitle, setTwitterTitle] = useState("");
  const [twitterDescription, setTwitterDescription] = useState("");
  const [twitterImage, setTwitterImage] = useState("");

  const [structuredDataString, setStructuredDataString] = useState("");
  const [structuredDataError, setStructuredDataError] = useState<string | null>(null);

  const [autoSocial, setAutoSocial] = useState(true);
  const [coreOpen, setCoreOpen] = useState(true);
  const [openGraphOpen, setOpenGraphOpen] = useState(false);
  const [twitterOpen, setTwitterOpen] = useState(false);
  const [structuredDataOpen, setStructuredDataOpen] = useState(false);

  const lastEmittedRef = useRef<string>("");
  const skipEmitRef = useRef(false);

  useEffect(() => {
    const v = value ?? null;
    const normalized = normalizeIncoming(v);
    const incomingSignature = JSON.stringify(normalized);

    skipEmitRef.current = true;
    queueMicrotask(() => {
      skipEmitRef.current = false;
    });

    if (!v) {
      setTitle("");
      setDescription("");
      setCanonical("");
      setImage("");
      setRobots("");
      setOgTitle("");
      setOgDescription("");
      setOgImage("");
      setTwitterCard("");
      setTwitterSite("");
      setTwitterTitle("");
      setTwitterDescription("");
      setTwitterImage("");
      setStructuredDataString("");
      setStructuredDataError(null);
      setAutoSocial(true);
      lastEmittedRef.current = incomingSignature;
      return;
    }

    setTitle(String((v as any).title ?? ""));
    setDescription(String((v as any).description ?? ""));
    setCanonical(String((v as any).canonical ?? ""));
    setImage(String((v as any).image ?? ""));
    setRobots(String((v as any).robots ?? ""));

    setOgTitle(String((v as any).og?.title ?? ""));
    setOgDescription(String((v as any).og?.description ?? ""));
    setOgImage(String((v as any).og?.image ?? ""));

    setTwitterCard(String((v as any).twitter?.card ?? ""));
    setTwitterSite(String((v as any).twitter?.site ?? ""));
    setTwitterTitle(String((v as any).twitter?.title ?? ""));
    setTwitterDescription(String((v as any).twitter?.description ?? ""));
    setTwitterImage(String((v as any).twitter?.image ?? ""));

    const structuredData = (v as any).structured_data;
    try {
      if (structuredData !== undefined && structuredData !== null && structuredData !== "") {
        setStructuredDataString(JSON.stringify(structuredData, null, 2));
      } else {
        setStructuredDataString("");
      }
      setStructuredDataError(null);
    } catch {
      setStructuredDataString("");
      setStructuredDataError(null);
    }

    setAutoSocial(!((v as any).og || (v as any).twitter));
    lastEmittedRef.current = incomingSignature;
  }, [value]);

  useEffect(() => {
    if (structuredDataString.trim()) {
      try {
        JSON.parse(structuredDataString);
        setStructuredDataError(null);
      } catch {
        setStructuredDataError("Invalid JSON");
        return;
      }
    }

    const out: SeoContent = {};
    if (title.trim()) out.title = title.trim();
    if (description.trim()) out.description = description.trim();
    if (canonical.trim()) out.canonical = canonical.trim();
    if (image.trim()) out.image = image.trim();
    if (robots.trim()) out.robots = robots.trim();

    if (autoSocial) {
      const og: any = {};
      if (title.trim()) og.title = title.trim();
      if (description.trim()) og.description = description.trim();
      if (image.trim()) og.image = image.trim();
      if (Object.keys(og).length > 0) out.og = og;

      const tw: any = { card: "summary_large_image" };
      if (title.trim()) tw.title = title.trim();
      if (description.trim()) tw.description = description.trim();
      if (image.trim()) tw.image = image.trim();
      if (Object.keys(tw).length > 1) out.twitter = tw;
    } else {
      const og: any = {};
      if (ogTitle.trim()) og.title = ogTitle.trim();
      if (ogDescription.trim()) og.description = ogDescription.trim();
      if (ogImage.trim()) og.image = ogImage.trim();
      if (Object.keys(og).length > 0) out.og = og;

      const tw: any = {};
      if (twitterCard.trim()) tw.card = twitterCard.trim();
      if (twitterSite.trim()) tw.site = twitterSite.trim();
      if (twitterTitle.trim()) tw.title = twitterTitle.trim();
      if (twitterDescription.trim()) tw.description = twitterDescription.trim();
      if (twitterImage.trim()) tw.image = twitterImage.trim();
      if (Object.keys(tw).length > 0) out.twitter = tw;
    }

    if (structuredDataString.trim()) {
      try {
        out.structured_data = JSON.parse(structuredDataString);
      } catch {
        return;
      }
    }

    const serialized = JSON.stringify(out);
    if (skipEmitRef.current || serialized === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = serialized;
    onChange?.(Object.keys(out).length === 0 ? null : out);
  }, [
    title,
    description,
    canonical,
    image,
    robots,
    autoSocial,
    ogTitle,
    ogDescription,
    ogImage,
    twitterCard,
    twitterSite,
    twitterTitle,
    twitterDescription,
    twitterImage,
    structuredDataString,
    onChange,
  ]);

  const previewOgTitle = autoSocial ? title.trim() : ogTitle.trim();
  const previewOgDescription = autoSocial ? description.trim() : ogDescription.trim();
  const previewOgImage = autoSocial ? image.trim() : ogImage.trim();
  const previewTwitterCard = autoSocial ? "summary_large_image" : twitterCard.trim();
  const previewTwitterSite = autoSocial ? "" : twitterSite.trim();
  const previewTwitterTitle = autoSocial ? title.trim() : twitterTitle.trim();
  const previewTwitterDescription = autoSocial ? description.trim() : twitterDescription.trim();
  const previewTwitterImage = autoSocial ? image.trim() : twitterImage.trim();

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-900">SEO Metadata</h4>

      <div className="mb-3 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoSocial} onChange={(e) => setAutoSocial(e.target.checked)} />
          <span>Auto-generate Open Graph & Twitter from Title/Description/Image</span>
        </label>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <button type="button" onClick={() => setCoreOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Core SEO</p>
              <p className="text-sm text-slate-600">Title, description, canonical, image, and robots.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{coreOpen ? "Collapse" : "Expand"}</span>
          </button>
          {coreOpen ? (
            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2">
              <label className="text-sm">
                <span className={labelClass}>Title</span>
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="text-sm md:col-span-2">
                <span className={labelClass}>Description</span>
                <textarea className={textareaClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className={labelClass}>Canonical URL</span>
                <input className={inputClass} value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="https://example.com/path" />
              </label>
              <label className="text-sm">
                <span className={labelClass}>Image URL</span>
                <input className={inputClass} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://cdn.example.com/image.jpg" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className={labelClass}>Robots</span>
                <input className={inputClass} value={robots} onChange={(e) => setRobots(e.target.value)} placeholder="index,follow" />
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <button type="button" onClick={() => setOpenGraphOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Graph</p>
              <p className="text-sm text-slate-600">Social preview metadata for Facebook/WhatsApp/etc.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{openGraphOpen ? "Collapse" : "Expand"}</span>
          </button>
          {openGraphOpen ? (
            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-3">
              <label className="text-sm">
                <span className={labelClass}>OG Title</span>
                <input disabled={autoSocial} className={inputClass} placeholder="OG title" value={previewOgTitle} onChange={(e) => setOgTitle(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className={labelClass}>OG Description</span>
                <input disabled={autoSocial} className={inputClass} placeholder="OG description" value={previewOgDescription} onChange={(e) => setOgDescription(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className={labelClass}>OG Image URL</span>
                <input disabled={autoSocial} className={inputClass} placeholder="OG image URL" value={previewOgImage} onChange={(e) => setOgImage(e.target.value)} />
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <button type="button" onClick={() => setTwitterOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Twitter</p>
              <p className="text-sm text-slate-600">Twitter card fields. Usually summary_large_image is enough.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{twitterOpen ? "Collapse" : "Expand"}</span>
          </button>
          {twitterOpen ? (
            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-3">
              <label className="text-sm">
                <span className={labelClass}>Card</span>
                <input disabled={autoSocial} className={inputClass} placeholder="summary_large_image" value={previewTwitterCard} onChange={(e) => setTwitterCard(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className={labelClass}>Site</span>
                <input disabled={autoSocial} className={inputClass} placeholder="@handle" value={previewTwitterSite} onChange={(e) => setTwitterSite(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className={labelClass}>Title</span>
                <input disabled={autoSocial} className={inputClass} placeholder="Twitter title" value={previewTwitterTitle} onChange={(e) => setTwitterTitle(e.target.value)} />
              </label>
              <label className="text-sm md:col-span-2">
                <span className={labelClass}>Description</span>
                <input disabled={autoSocial} className={inputClass} placeholder="Twitter description" value={previewTwitterDescription} onChange={(e) => setTwitterDescription(e.target.value)} />
              </label>
              <label className="text-sm md:col-span-1">
                <span className={labelClass}>Image URL</span>
                <input disabled={autoSocial} className={inputClass} placeholder="Twitter image URL" value={previewTwitterImage} onChange={(e) => setTwitterImage(e.target.value)} />
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <button type="button" onClick={() => setStructuredDataOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Structured Data</p>
              <p className="text-sm text-slate-600">JSON-LD for rich snippets and search engines.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{structuredDataOpen ? "Collapse" : "Expand"}</span>
          </button>
          {structuredDataOpen ? (
            <>
              <div className="mt-4">
                <label className="text-sm block">
                  <span className={labelClass}>JSON-LD</span>
                  <textarea className={`${textareaClass} h-36`} value={structuredDataString} onChange={(e) => setStructuredDataString(e.target.value)} placeholder='{"@context":"https://schema.org","@type":"Product"}' />
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(structuredDataString || "{}");
                      setStructuredDataString(JSON.stringify(parsed, null, 2));
                      setStructuredDataError(null);
                    } catch {
                      setStructuredDataError("Invalid JSON");
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Format
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStructuredDataString("");
                    setStructuredDataError(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
              </div>
              {structuredDataError ? <div className="mt-2 text-xs text-rose-700">{structuredDataError}</div> : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function normalizeIncoming(input: SeoContent | null | undefined): SeoContent | null {
  if (!input) return null;
  const out: SeoContent = {};
  if (String((input as any).title ?? "").trim()) out.title = String((input as any).title ?? "").trim();
  if (String((input as any).description ?? "").trim()) out.description = String((input as any).description ?? "").trim();
  if (String((input as any).canonical ?? "").trim()) out.canonical = String((input as any).canonical ?? "").trim();
  if (String((input as any).image ?? "").trim()) out.image = String((input as any).image ?? "").trim();
  if (String((input as any).robots ?? "").trim()) out.robots = String((input as any).robots ?? "").trim();

  const og = (input as any).og;
  if (og && typeof og === "object") {
    const ogOut: any = {};
    if (String(og.title ?? "").trim()) ogOut.title = String(og.title ?? "").trim();
    if (String(og.description ?? "").trim()) ogOut.description = String(og.description ?? "").trim();
    if (String(og.image ?? "").trim()) ogOut.image = String(og.image ?? "").trim();
    if (Object.keys(ogOut).length > 0) out.og = ogOut;
  }

  const twitter = (input as any).twitter;
  if (twitter && typeof twitter === "object") {
    const twitterOut: any = {};
    if (String(twitter.card ?? "").trim()) twitterOut.card = String(twitter.card ?? "").trim();
    if (String(twitter.site ?? "").trim()) twitterOut.site = String(twitter.site ?? "").trim();
    if (String(twitter.title ?? "").trim()) twitterOut.title = String(twitter.title ?? "").trim();
    if (String(twitter.description ?? "").trim()) twitterOut.description = String(twitter.description ?? "").trim();
    if (String(twitter.image ?? "").trim()) twitterOut.image = String(twitter.image ?? "").trim();
    if (Object.keys(twitterOut).length > 0) out.twitter = twitterOut;
  }

  const structuredData = (input as any).structured_data;
  if (structuredData !== undefined && structuredData !== null && structuredData !== "") {
    out.structured_data = structuredData;
  }

  return out;
}
