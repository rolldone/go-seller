/** @jsxRuntime classic */
import React, { useEffect, useMemo, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import EntityTable from "../entities/EntityTable";
import type { Business, BusinessListResponse, BusinessPayload } from "./types";
import BusinessFormModal from "./BusinessFormModal";
import BusinessTranslationsModal from "./BusinessTranslationsModal";
import BusinessDisclaimersManager from "./BusinessDisclaimersManager";
import MemberModal from "../ui/MemberModal";
import { memberDelete, memberGet, memberPost, memberPut } from "./api";
import { notifyError, notifySuccess } from "../../../lib/notification";

const perPageOptions = [10, 20, 50];

const shortID = (value: string) => value.slice(0, 8);

const copyID = async (value: string) => {
	try {
		await navigator.clipboard.writeText(value);
		notifySuccess("ID copied");
	} catch (err) {
		notifyError(err instanceof Error ? err.message : "Gagal copy ID");
	}
};

export default function MemberBusinessesPage() {
	const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/en/") ? "en" : typeof window !== "undefined" && window.location.pathname.startsWith("/id/") ? "id" : undefined;
	const [items, setItems] = useState<Business[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "edit">("create");
	const [selected, setSelected] = useState<Business | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [translationOpen, setTranslationOpen] = useState(false);
	const [translationBusiness, setTranslationBusiness] = useState<Business | null>(null);
	const [disclaimerOpen, setDisclaimerOpen] = useState(false);
	const [disclaimerBusiness, setDisclaimerBusiness] = useState<Business | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await memberGet<BusinessListResponse>(`/api/member/businesses?page=${page}&limit=${limit}`);
			const nextItems = res.data || [];
			setItems(nextItems);
			setTotal(res.total || 0);
			setSelected((current) => current || nextItems[0] || null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat toko");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, [page, limit]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	const handleCreate = () => {
		setFormMode("create");
		setSelected(null);
		setFormOpen(true);
	};

	const handleEdit = (item: Business) => {
		setFormMode("edit");
		setSelected(item);
		setFormOpen(true);
	};

	const handleDelete = (item: Business) => {
		setSelected(item);
		setDeleteOpen(true);
	};

	const handleOpenTranslations = (item: Business) => {
		setTranslationBusiness(item);
		setTranslationOpen(true);
	};

	const handleOpenDisclaimers = (item: Business) => {
		setDisclaimerBusiness(item);
		setDisclaimerOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!selected) return;
		setSubmitting(true);
		try {
			await memberDelete(`/api/member/businesses/${selected.id}`);
			notifySuccess("Business deleted");
			setDeleteOpen(false);
			setSelected(null);
			await loadData();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus toko");
		} finally {
			setSubmitting(false);
		}
	};

	const handleSubmit = async (payload: BusinessPayload, businessID?: string) => {
		setSubmitting(true);
		try {
			let business: Business;
			if (businessID) {
				business = await memberPut<Business>(`/api/member/businesses/${businessID}`, payload);
				notifySuccess("Business updated");
			} else if (formMode === "create") {
				business = await memberPost<Business>("/api/member/businesses", payload);
				notifySuccess("Business created");
			} else if (selected) {
				business = await memberPut<Business>(`/api/member/businesses/${selected.id}`, payload);
				notifySuccess("Business updated");
			} else {
				throw new Error("No business selected");
			}
			await loadData();
			return business;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Gagal menyimpan toko";
			notifyError(message);
			throw err;
		} finally {
			setSubmitting(false);
		}
	};

	const columns = useMemo(
		() => [
			{
				key: "id",
				label: "ID",
				render: (item: Business) => (
					<div className="flex items-center gap-2">
						<span className="font-mono text-xs text-slate-500">{shortID(item.id)}</span>
						<button type="button" onClick={() => copyID(item.id)} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
							Copy
						</button>
					</div>
				),
			},
			{
				key: "name",
				label: "Name",
				render: (item: Business) => (
					<div>
						<div className="font-semibold text-slate-900">{item.name}</div>
						<div className="text-xs text-slate-500">/{item.slug}</div>
					</div>
				),
			},
			{
				key: "owner",
				label: "Owner",
				render: (item: Business) => <div className="text-xs text-slate-500">{item.owner_name ? `${item.owner_name}${item.owner_role ? ` • ${item.owner_role}` : ""}` : "-"}</div>,
			},
			{
				key: "contact",
				label: "Contact",
				render: (item: Business) => <div className="text-xs text-slate-500">{item.email || item.phone || "-"}</div>,
			},
			{
				key: "visibility",
				label: "Visibility",
				render: (item: Business) => <div className="text-xs text-slate-500">{item.show_contact_email ? "Email" : "Hide email"} · {item.show_phone ? "Phone" : "Hide phone"}</div>,
			},
			{
				key: "updated_at",
				label: "Updated",
				render: (item: Business) => new Date(item.updated_at).toLocaleString(),
			},
		],
		[]
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Toko Saya</h3>
					<p className="text-sm text-slate-600">Kelola toko yang dimiliki member ini</p>
				</div>
				<button type="button" onClick={handleCreate} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
					+ New Business
				</button>
			</div>

			<EntityTable
				items={items}
				columns={columns}
				loading={loading}
				error={error}
				onEdit={handleEdit}
				onDelete={handleDelete}
				renderExtraActions={(item) => (
					<div className="flex gap-2">
						<button type="button" onClick={() => handleOpenTranslations(item)} className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-200">
							Translation
						</button>
						<a
							href={buildLocalizedPath(`/member/business-assets?business_id=${encodeURIComponent(item.id)}`, locale)}
							className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
						>
							Assets
						</a>
						<button type="button" onClick={() => handleOpenDisclaimers(item)} className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">
							Disclaimer
						</button>
					</div>
				)}
			/>

			{selected ? (
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Business</p>
							<h4 className="mt-1 text-lg font-semibold text-slate-900">{selected.name}</h4>
							<p className="text-sm text-slate-600">/{selected.slug}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<a href={buildLocalizedPath(`/member/business-assets?business_id=${encodeURIComponent(selected.id)}`, locale)} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
								Kelola Aset
							</a>
							<button type="button" onClick={() => handleOpenDisclaimers(selected)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
								Kelola Disclaimer
							</button>
						</div>
					</div>
				</div>
			) : null}

			<div className="flex items-center justify-between text-sm text-slate-600">
				<div>
					Total: <span className="font-medium text-slate-900">{total}</span>
				</div>
				<div className="flex items-center gap-2">
					<button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50">
						Prev
					</button>
					<span>
						Page {page} / {totalPages}
					</span>
					<button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50">
						Next
					</button>
					<select
						className="rounded border border-slate-300 px-2 py-1 text-sm"
						value={limit}
						onChange={(e) => {
							setPage(1);
							setLimit(Number(e.target.value));
						}}
					>
						{perPageOptions.map((opt) => (
							<option key={opt} value={opt}>
								{opt} / page
							</option>
						))}
					</select>
				</div>
			</div>

			<BusinessFormModal
				open={formOpen}
				mode={formMode}
				initialData={selected}
				submitting={submitting}
				onClose={() => {
					setFormOpen(false);
					setSelected(null);
				}}
				onSubmit={handleSubmit}
			/>

			<EntityDeleteModal
				open={deleteOpen}
				title="Business"
				itemName={selected?.name || ""}
				submitting={submitting}
				onClose={() => {
					setDeleteOpen(false);
					setSelected(null);
				}}
				onConfirm={handleConfirmDelete}
			/>

			<BusinessTranslationsModal
				open={translationOpen}
				business={translationBusiness}
				onClose={() => setTranslationOpen(false)}
			/>

			<MemberModal
				open={disclaimerOpen}
				onClose={() => setDisclaimerOpen(false)}
				title={disclaimerBusiness ? `Disclaimer: ${disclaimerBusiness.name}` : "Business Disclaimers"}
				maxWidth="2xl"
			>
				{disclaimerBusiness ? <BusinessDisclaimersManager businessID={disclaimerBusiness.id} /> : null}
			</MemberModal>
		</div>
	);
}