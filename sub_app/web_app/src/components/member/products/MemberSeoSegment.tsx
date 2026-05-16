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
	sourceTitle?: string;
	sourceDescription?: string;
};

function normalizeIncoming(value?: SeoContent | null): SeoContent | null {
	if (!value) return null;
	return {
		title: value.title,
		description: value.description,
		canonical: value.canonical,
		image: value.image,
		robots: value.robots,
		og: value.og,
		twitter: value.twitter,
		structured_data: value.structured_data,
	};
}

export default function MemberSeoSegment({ value, onChange, sourceTitle, sourceDescription }: Props) {
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
	const canApplyFromProduct = Boolean(String(sourceTitle || "").trim() || String(sourceDescription || "").trim());

	const applyFromProduct = () => {
		if (String(sourceTitle || "").trim()) {
			setTitle(String(sourceTitle || "").trim());
		}
		if (String(sourceDescription || "").trim()) {
			setDescription(String(sourceDescription || "").trim());
		}
	};

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

	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
			<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h4 className="text-sm font-semibold text-slate-900">SEO Metadata</h4>
					<p className="mt-1 text-xs text-slate-500">Tombol di sini mengisi Title dan Description dari data produk.</p>
				</div>
				<button
					type="button"
					onClick={applyFromProduct}
					disabled={!canApplyFromProduct}
					className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Ambil dari produk
				</button>
			</div>

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
								<input className={inputClass} value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} disabled={autoSocial} />
							</label>
							<label className="text-sm md:col-span-2">
								<span className={labelClass}>OG Description</span>
								<input className={inputClass} value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} disabled={autoSocial} />
							</label>
							<label className="text-sm md:col-span-3">
								<span className={labelClass}>OG Image</span>
								<input className={inputClass} value={ogImage} onChange={(e) => setOgImage(e.target.value)} disabled={autoSocial} />
							</label>
						</div>
					) : null}
				</section>

				<section className="rounded-2xl border border-slate-200 bg-white p-4">
					<button type="button" onClick={() => setTwitterOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Twitter Cards</p>
							<p className="text-sm text-slate-600">Custom Twitter metadata when auto-generation is off.</p>
						</div>
						<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{twitterOpen ? "Collapse" : "Expand"}</span>
					</button>
					{twitterOpen ? (
						<div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2">
							<label className="text-sm">
								<span className={labelClass}>Twitter Card</span>
								<input className={inputClass} value={twitterCard} onChange={(e) => setTwitterCard(e.target.value)} disabled={autoSocial} placeholder="summary_large_image" />
							</label>
							<label className="text-sm">
								<span className={labelClass}>Twitter Site</span>
								<input className={inputClass} value={twitterSite} onChange={(e) => setTwitterSite(e.target.value)} disabled={autoSocial} />
							</label>
							<label className="text-sm">
								<span className={labelClass}>Twitter Title</span>
								<input className={inputClass} value={twitterTitle} onChange={(e) => setTwitterTitle(e.target.value)} disabled={autoSocial} />
							</label>
							<label className="text-sm">
								<span className={labelClass}>Twitter Description</span>
								<input className={inputClass} value={twitterDescription} onChange={(e) => setTwitterDescription(e.target.value)} disabled={autoSocial} />
							</label>
							<label className="text-sm md:col-span-2">
								<span className={labelClass}>Twitter Image</span>
								<input className={inputClass} value={twitterImage} onChange={(e) => setTwitterImage(e.target.value)} disabled={autoSocial} />
							</label>
						</div>
					) : null}
				</section>

				<section className="rounded-2xl border border-slate-200 bg-white p-4">
					<button type="button" onClick={() => setStructuredDataOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 text-left">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Structured Data</p>
							<p className="text-sm text-slate-600">JSON-LD schema for search engines.</p>
						</div>
						<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{structuredDataOpen ? "Collapse" : "Expand"}</span>
					</button>
					{structuredDataOpen ? (
						<div className="mt-4 space-y-2">
							<label className="text-sm">
								<span className={labelClass}>Structured Data JSON</span>
								<textarea className={textareaClass} rows={8} value={structuredDataString} onChange={(e) => setStructuredDataString(e.target.value)} placeholder='{"@context":"https://schema.org"}' />
							</label>
							{structuredDataError ? <div className="text-xs text-rose-600">{structuredDataError}</div> : null}
						</div>
					) : null}
				</section>
			</div>
		</div>
	);
}