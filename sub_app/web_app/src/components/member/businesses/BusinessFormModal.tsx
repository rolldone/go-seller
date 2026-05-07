/** @jsxRuntime classic */
import React, { useEffect, useRef, useState } from "react";

import MemberModal from "../ui/MemberModal";
import type { Business, BusinessPayload } from "./types";
import { memberGet } from "./api";

const defaultForm = {
	name: "",
	slug: "",
	description: "",
	highlights: "",
	operational_hours: "",
	short_description: "",
	owner_name: "",
	owner_role: "",
	founded_year: "",
	address: "",
	email: "",
	phone: "",
	whatsapp: "",
	facebook: "",
	instagram: "",
	x_twitter: "",
	tiktok: "",
	chat_response_time: "",
	show_contact_email: true,
	show_phone: true,
};

type FormState = typeof defaultForm;

type Props = {
	open: boolean;
	mode: "create" | "edit";
	initialData?: Business | null;
	submitting: boolean;
	onClose: () => void;
	onSubmit: (payload: BusinessPayload, businessID?: string) => Promise<Business>;
};

export default function BusinessFormModal({ open, mode, initialData, submitting, onClose, onSubmit }: Props) {
	const [form, setForm] = useState<FormState>(defaultForm);
	const [error, setError] = useState("");

	const [slugChecking, setSlugChecking] = useState(false);
	const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
	const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
	const [slugError, setSlugError] = useState<string | null>(null);
	const [generating, setGenerating] = useState(false);
	const slugCheckTimer = useRef<number | null>(null);

	useEffect(() => {
		if (!open) return;
		setError("");
		setForm({
			...defaultForm,
			name: initialData?.name || "",
			slug: initialData?.slug || "",
			description: initialData?.description || "",
			highlights: Array.isArray(initialData?.highlights) ? initialData.highlights.filter(Boolean).join("\n") : "",
			operational_hours: initialData?.operational_hours ? JSON.stringify(initialData.operational_hours, null, 2) : "",
			short_description: initialData?.short_description || "",
			owner_name: initialData?.owner_name || "",
			owner_role: initialData?.owner_role || "",
			founded_year: initialData?.founded_year ? String(initialData.founded_year) : "",
			address: initialData?.address || "",
			email: initialData?.email || "",
			phone: initialData?.phone || "",
			whatsapp: initialData?.whatsapp || "",
			facebook: initialData?.facebook || "",
			instagram: initialData?.instagram || "",
			x_twitter: initialData?.x_twitter || "",
			tiktok: initialData?.tiktok || "",
			chat_response_time: initialData?.chat_response_time || "",
			show_contact_email: typeof initialData?.show_contact_email === "boolean" ? initialData.show_contact_email : true,
			show_phone: typeof initialData?.show_phone === "boolean" ? initialData.show_phone : true,
		});
	}, [open, initialData, mode]);

	const setField = (key: keyof FormState, value: string | boolean) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleSubmit = async () => {
		setError("");
		if (!form.name.trim()) {
			setError("Name wajib diisi");
			return;
		}
		if (!form.slug.trim()) {
			setError("Slug wajib diisi");
			return;
		}

		let operationalHours: unknown = undefined;
		if (form.operational_hours.trim()) {
			try {
				operationalHours = JSON.parse(form.operational_hours);
			} catch {
				setError("Operational hours harus JSON valid");
				return;
			}
		}

		const highlights = form.highlights
			.split(/\r?\n/)
			.map((item) => item.trim())
			.filter(Boolean);

		const foundedYear = form.founded_year.trim() ? Number(form.founded_year) : undefined;
		if (form.founded_year.trim() && Number.isNaN(foundedYear)) {
			setError("Founded year harus angka");
			return;
		}

		const payload: BusinessPayload = {
			name: form.name.trim(),
			slug: form.slug.trim(),
			description: form.description.trim() || undefined,
			highlights: highlights.length > 0 ? highlights : undefined,
			operational_hours: operationalHours,
			short_description: form.short_description.trim() || undefined,
			owner_name: form.owner_name.trim() || undefined,
			owner_role: form.owner_role.trim() || undefined,
			founded_year: foundedYear,
			address: form.address.trim() || undefined,
			email: form.email.trim() || undefined,
			phone: form.phone.trim() || undefined,
			whatsapp: form.whatsapp.trim() || undefined,
			facebook: form.facebook.trim() || undefined,
			instagram: form.instagram.trim() || undefined,
			x_twitter: form.x_twitter.trim() || undefined,
			tiktok: form.tiktok.trim() || undefined,
			chat_response_time: form.chat_response_time.trim() || undefined,
			show_contact_email: form.show_contact_email,
			show_phone: form.show_phone,
		};

		try {
			await onSubmit(payload, mode === "edit" ? initialData?.id : undefined);
		} catch (e) {
			const errAny: any = e;
			// if conflict (409) or message hints slug conflict, fetch suggestions
			if (errAny && (errAny.status === 409 || (errAny instanceof Error && String(errAny.message).toLowerCase().includes("slug")))) {
				setError(errAny.message || "Conflict");
				try {
					const slugQuery = form.slug.trim() || form.name.trim();
					if (slugQuery) {
						const param = form.slug.trim() ? `slug=${encodeURIComponent(form.slug)}` : `name=${encodeURIComponent(form.name)}`;
						const res = await memberGet<any>(`/api/catalog/businesses/slug/suggest?${param}&limit=5`);
						if (res.slug) setForm((prev) => ({ ...prev, slug: res.slug }));
						setSlugAvailable(Boolean(res.available));
						setSlugSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
					}
				} catch (e2) {
					// ignore suggestion errors
				}
			}
			return;
		}
	};

	// debounce check when user edits slug manually
	useEffect(() => {
		setSlugError(null);
		setSlugSuggestions([]);
		setSlugAvailable(null);
		if (slugCheckTimer.current) {
			window.clearTimeout(slugCheckTimer.current);
			slugCheckTimer.current = null;
		}
		const s = form.slug.trim();
		if (!s) return;
		slugCheckTimer.current = window.setTimeout(async () => {
			setSlugChecking(true);
			try {
				const res = await memberGet<any>(`/api/catalog/businesses/slug/check?slug=${encodeURIComponent(s)}`);
				setSlugAvailable(Boolean(res.available));
				if (!res.available) {
					try {
						const suggestRes = await memberGet<any>(`/api/catalog/businesses/slug/suggest?slug=${encodeURIComponent(s)}&limit=5`);
						setSlugSuggestions(Array.isArray(suggestRes.suggestions) ? suggestRes.suggestions : []);
					} catch (e) {
						// ignore
					}
				}
			} catch (e) {
				setSlugError(e instanceof Error ? e.message : String(e));
			} finally {
				setSlugChecking(false);
			}
		}, 450);

		return () => {
			if (slugCheckTimer.current) {
				window.clearTimeout(slugCheckTimer.current);
				slugCheckTimer.current = null;
			}
		};
	}, [form.slug]);

	const handleGenerate = async () => {
		setSlugError(null);
		setSlugSuggestions([]);
		if (!form.name.trim()) {
			setSlugError("Nama Toko harus diisi untuk generate slug");
			return;
		}
		setGenerating(true);
		try {
			const res = await memberGet<any>(`/api/catalog/businesses/slug/suggest?name=${encodeURIComponent(form.name)}&limit=5`);
			if (res.slug) setForm((prev) => ({ ...prev, slug: res.slug }));
			setSlugAvailable(Boolean(res.available));
			setSlugSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
		} catch (e) {
			setSlugError(e instanceof Error ? e.message : String(e));
		} finally {
			setGenerating(false);
		}
	};

	if (!open) return null;

	const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
	const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

	return (
		<MemberModal
			open={open}
			title={mode === "create" ? "Buat Toko" : "Edit Toko"}
			onClose={onClose}
			maxWidth="xl"
			footer={
				<>
					<button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
						Cancel
					</button>
					<button type="button" disabled={submitting} onClick={handleSubmit} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70">
						{submitting ? "Saving..." : "Save"}
					</button>
				</>
			}
		>
			<div className="space-y-4">
				{error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

				<div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Business Profile</p>
					<p className="text-sm text-slate-600">Lengkapi identitas dan data toko milik member ini.</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>Nama Toko *</label>
						<input value={form.name} onChange={(e) => setField("name", e.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>Slug *</label>
						<div className="flex items-center gap-2">
							<input value={form.slug} onChange={(e) => setField("slug", e.target.value)} className={`${inputClass} flex-1`} placeholder="nama-toko" />
							<button type="button" onClick={handleGenerate} disabled={generating} className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-60">
								{generating ? "Memproses..." : "Generate"}
							</button>
						</div>
						<div className="mt-2 text-sm">
							{slugChecking ? (
								<span className="text-slate-500">Memeriksa ketersediaan...</span>
							) : slugAvailable === true ? (
								<span className="text-green-600">Slug tersedia</span>
							) : slugAvailable === false ? (
								<span className="text-red-600">Slug sudah dipakai</span>
							) : null}
							{slugError ? <div className="text-red-600 mt-1">{slugError}</div> : null}
							{slugSuggestions && slugSuggestions.length > 0 ? (
								<div className="mt-2">
									<div className="text-slate-600 text-sm">Saran:</div>
									<div className="mt-1 flex flex-wrap gap-2">
										{slugSuggestions.map((s) => (
											<button key={s} type="button" onClick={() => setField("slug", s)} className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm">
												{s}
											</button>
										))}
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>

				<div>
					<label className={labelClass}>Deskripsi</label>
					<textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={4} className={inputClass} />
				</div>

				<div>
					<label className={labelClass}>Highlights</label>
					<textarea
						value={form.highlights}
						onChange={(e) => setField("highlights", e.target.value)}
						rows={4}
						className={inputClass}
						placeholder="Satu highlight per baris"
					/>
				</div>

				<div>
					<label className={labelClass}>Short Description</label>
					<textarea value={form.short_description} onChange={(e) => setField("short_description", e.target.value)} rows={3} className={inputClass} />
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>Owner Name</label>
						<input value={form.owner_name} onChange={(e) => setField("owner_name", e.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>Owner Role</label>
						<input value={form.owner_role} onChange={(e) => setField("owner_role", e.target.value)} className={inputClass} />
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>Founded Year</label>
						<input value={form.founded_year} onChange={(e) => setField("founded_year", e.target.value)} inputMode="numeric" className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>Chat Response Time</label>
						<input value={form.chat_response_time} onChange={(e) => setField("chat_response_time", e.target.value)} className={inputClass} />
					</div>
				</div>

				<div>
					<label className={labelClass}>Address</label>
					<textarea value={form.address} onChange={(e) => setField("address", e.target.value)} rows={3} className={inputClass} />
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>Email</label>
						<input value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>Phone</label>
						<input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={inputClass} />
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>WhatsApp</label>
						<input value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>Facebook</label>
						<input value={form.facebook} onChange={(e) => setField("facebook", e.target.value)} className={inputClass} />
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className={labelClass}>Instagram</label>
						<input value={form.instagram} onChange={(e) => setField("instagram", e.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass}>X / Twitter</label>
						<input value={form.x_twitter} onChange={(e) => setField("x_twitter", e.target.value)} className={inputClass} />
					</div>
				</div>

				<div>
					<label className={labelClass}>Tiktok</label>
					<input value={form.tiktok} onChange={(e) => setField("tiktok", e.target.value)} className={inputClass} />
				</div>

				<div>
					<label className={labelClass}>Operational Hours (JSON)</label>
					<textarea
						value={form.operational_hours}
						onChange={(e) => setField("operational_hours", e.target.value)}
						rows={3}
						className={`${inputClass} font-mono`}
						placeholder='{"mon":"09:00-22:00"}'
					/>
				</div>

				<div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={form.show_contact_email} onChange={(e) => setField("show_contact_email", e.target.checked)} />
						Show contact email
					</label>
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={form.show_phone} onChange={(e) => setField("show_phone", e.target.checked)} />
						Show phone
					</label>
				</div>
			</div>
		</MemberModal>
	);
}