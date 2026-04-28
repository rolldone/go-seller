import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { formatAmount } from "../../../lib/amountFormat";
import { notifyError, notifySuccess } from "../../../lib/notification";
import ProductDeleteModal from "./ProductDeleteModal";
import ProductTranslationsModal from "./ProductTranslationsModal";
import ProductFormModal from "./ProductFormModal.tsx";
import ProductDiscountsModal from "../discounts/ProductDiscountsModal";
import { createMemberProduct, deleteMemberProduct, listMemberBusinesses, listMemberCategories, listMemberProducts, listMemberTags, publishMemberProduct, unpublishMemberProduct, updateMemberProduct } from "./api";
import type { BusinessOption, CategoryOption, Product, ProductPayload, TagOption } from "./types";

const perPageOptions = [10, 20, 50];

export default function MemberProductsPage() {
	const [items, setItems] = useState<Product[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [q, setQ] = useState("");
	const [status, setStatus] = useState("");
	const [stockStatus, setStockStatus] = useState("");
	const [businessID, setBusinessID] = useState("");
	const [categoryID, setCategoryID] = useState("");
	const [tagID, setTagID] = useState("");
	const [productType, setProductType] = useState("");
	const [visible, setVisible] = useState<"" | "true" | "false">("");
	const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
	const [businessNameByID, setBusinessNameByID] = useState<Record<string, string>>({});
	const [categories, setCategories] = useState<CategoryOption[]>([]);
	const [categoryNameByID, setCategoryNameByID] = useState<Record<string, string>>({});
	const [tags, setTags] = useState<TagOption[]>([]);
	const [tagNameByID, setTagNameByID] = useState<Record<string, string>>({});
	const [selected, setSelected] = useState<Product | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"create" | "edit">("create");
	const [submitting, setSubmitting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [translationOpen, setTranslationOpen] = useState(false);
	const [translationProduct, setTranslationProduct] = useState<Product | null>(null);
	const [discountsOpen, setDiscountsOpen] = useState(false);
	const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
	const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
	const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	useEffect(() => {
		const onDocClick = () => setOpenMenuFor(null);
		document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	}, []);

	useEffect(() => {
		if (!openMenuFor) return;
		const update = () => {
			const btn = document.querySelector(`[data-menu-button="${openMenuFor}"]`) as HTMLElement | null;
			if (!btn) {
				setOpenMenuFor(null);
				setMenuCoords(null);
				return;
			}
			const rect = btn.getBoundingClientRect();
			const MENU_WIDTH = 160;
			const top = rect.bottom + window.scrollY + 8;
			const left = rect.right + window.scrollX - MENU_WIDTH;
			setMenuCoords({ top, left });
		};

		update();

		const onScroll = () => update();
		const onResize = () => update();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpenMenuFor(null);
				setMenuCoords(null);
			}
		};

		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onResize);
		document.addEventListener("keydown", onKey);

		return () => {
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onResize);
			document.removeEventListener("keydown", onKey);
		};
	}, [openMenuFor]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const bid = params.get("business_id") || "";
		const st = params.get("status") || "";
		const stock = params.get("stock_status") || "";
		const cid = params.get("category_id") || "";
		const tid = params.get("tag_id") || "";
		const pt = params.get("product_type") || "";
		const vis = params.get("is_visible") || "";
		if (bid) setBusinessID(bid);
		if (st) setStatus(st);
		if (stock) setStockStatus(stock);
		if (cid) setCategoryID(cid);
		if (tid) setTagID(tid);
		if (pt) setProductType(pt);
		if (vis === "true" || vis === "false") setVisible(vis);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (businessID) params.set("business_id", businessID); else params.delete("business_id");
		if (status) params.set("status", status); else params.delete("status");
		if (stockStatus) params.set("stock_status", stockStatus); else params.delete("stock_status");
		if (categoryID) params.set("category_id", categoryID); else params.delete("category_id");
		if (tagID) params.set("tag_id", tagID); else params.delete("tag_id");
		if (productType) params.set("product_type", productType); else params.delete("product_type");
		if (visible) params.set("is_visible", visible); else params.delete("is_visible");
		const query = params.toString();
		const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		window.history.replaceState(null, "", nextUrl);
	}, [businessID, status, stockStatus, categoryID, tagID, productType, visible]);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await listMemberProducts({
				q,
				status,
				stock_status: stockStatus,
				business_id: businessID,
				category_id: categoryID,
				tag_id: tagID,
				product_type: productType,
				is_visible: visible,
				page,
				limit,
			});
			setItems(res.data || []);
			setTotal(res.total || 0);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat product");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, [page, limit, q, status, stockStatus, businessID, categoryID, tagID, productType, visible]);

	useEffect(() => {
		void (async () => {
			try {
				const rows = await listMemberBusinesses();
				const map: Record<string, string> = {};
				for (const business of rows) map[business.id] = business.name;
				setBusinesses(rows);
				setBusinessNameByID(map);
				if (!businessID && rows.length === 1) {
					setBusinessID(rows[0].id);
				}
			} catch {
				setBusinesses([]);
				setBusinessNameByID({});
			}
		})();
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				const rows = await listMemberCategories();
				const map: Record<string, string> = {};
				for (const category of rows) map[category.id] = category.name;
				setCategories(rows);
				setCategoryNameByID(map);
			} catch {
				setCategories([]);
				setCategoryNameByID({});
			}
		})();
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				const rows = await listMemberTags();
				const map: Record<string, string> = {};
				for (const tag of rows) map[tag.id] = tag.name;
				setTags(rows);
				setTagNameByID(map);
			} catch {
				setTags([]);
				setTagNameByID({});
			}
		})();
	}, []);

	const selectedBusinessLabel = businessID ? businessNameByID[businessID] || businessID : "All businesses";

	const handleCreate = () => {
		setFormMode("create");
		setSelected(null);
		setFormOpen(true);
	};

	const handleEdit = (item: Product) => {
		setFormMode("edit");
		setSelected(item);
		setFormOpen(true);
	};

	const handleDelete = (item: Product) => {
		setSelected(item);
		setDeleteOpen(true);
	};

	const handleTranslations = (item: Product) => {
		setTranslationProduct(item);
		setTranslationOpen(true);
	};

	const handleDiscounts = (item: Product) => {
		setDiscountProduct(item);
		setDiscountsOpen(true);
	};

	const handleSubmit = async (payload: ProductPayload, productID?: string): Promise<Product> => {
		setSubmitting(true);
		try {
			let product: Product;
			if (productID) {
				product = await updateMemberProduct(productID, payload);
				notifySuccess("Product updated");
			} else if (formMode === "create") {
				product = await createMemberProduct(payload);
				notifySuccess("Product created");
			} else if (selected) {
				product = await updateMemberProduct(selected.id, payload);
				notifySuccess("Product updated");
			} else {
				throw new Error("No product selected");
			}
			await loadData();
			return product;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Gagal menyimpan product";
			notifyError(message);
			throw err;
		} finally {
			setSubmitting(false);
		}
	};

	const handleConfirmDelete = async () => {
		if (!selected) return;
		setSubmitting(true);
		try {
			await deleteMemberProduct(selected.id);
			notifySuccess("Product deleted");
			setDeleteOpen(false);
			setSelected(null);
			await loadData();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus product");
		} finally {
			setSubmitting(false);
		}
	};

	const handleTogglePublish = async (item: Product) => {
		setSubmitting(true);
		try {
			if (item.status === "published") {
				await unpublishMemberProduct(item.id);
				notifySuccess("Product unpublished");
			} else {
				await publishMemberProduct(item.id);
				notifySuccess("Product published");
			}
			await loadData();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal update publish state");
		} finally {
			setSubmitting(false);
		}
	};

	const rows = useMemo(() => items, [items]);

	const clearFilters = () => {
		setPage(1);
		setQ("");
		setStatus("");
		setStockStatus("");
		setBusinessID("");
		setCategoryID("");
		setTagID("");
		setProductType("");
		setVisible("");
	};

	const renderLabels = (ids: string[] | undefined, map: Record<string, string>, fallback = "-") => {
		if (!ids || ids.length === 0) return fallback;
		const names = ids.map((id) => map[id] || id);
		const visibleNames = names.slice(0, 3);
		return (
			<div className="flex flex-wrap gap-1">
				{visibleNames.map((name) => (
					<span key={name} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{name}</span>
				))}
				{names.length > visibleNames.length ? <span className="text-xs text-slate-400">+{names.length - visibleNames.length}</span> : null}
			</div>
		);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Products</h3>
					<p className="text-sm text-slate-600">Kelola product milik member ini.</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
						Target: <span className="font-semibold text-slate-900">{selectedBusinessLabel}</span>
					</div>
					<button type="button" onClick={handleCreate} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
						+ New Product
					</button>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-5">
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Search</span>
						<input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search products" />
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Status</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
							<option value="">All status</option>
							<option value="draft">draft</option>
							<option value="published">published</option>
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Stock</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={stockStatus} onChange={(e) => { setPage(1); setStockStatus(e.target.value); }}>
							<option value="">All stock</option>
							<option value="instock">instock</option>
							<option value="outofstock">outofstock</option>
							<option value="backorder">backorder</option>
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Business</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={businessID} onChange={(e) => { setPage(1); setBusinessID(e.target.value); }}>
							<option value="">All businesses</option>
							{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Category</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryID} onChange={(e) => { setPage(1); setCategoryID(e.target.value); }}>
							<option value="">All categories</option>
							{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Tag</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={tagID} onChange={(e) => { setPage(1); setTagID(e.target.value); }}>
							<option value="">All tags</option>
							{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Type</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productType} onChange={(e) => { setPage(1); setProductType(e.target.value); }}>
							<option value="">All types</option>
							<option value="product">product</option>
							<option value="service">service</option>
							<option value="digital">digital</option>
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Visibility</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={visible} onChange={(e) => { setPage(1); setVisible(e.target.value as "" | "true" | "false"); }}>
							<option value="">All visibility</option>
							<option value="true">Visible</option>
							<option value="false">Hidden</option>
						</select>
					</label>
					<label className="space-y-2 text-sm">
						<span className="font-medium text-slate-700">Per halaman</span>
						<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}>
							{perPageOptions.map((value) => <option key={value} value={value}>{value} / page</option>)}
						</select>
					</label>
				</div>
				<div className="mt-4 flex justify-end">
						<button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
						Reset Filters
					</button>
				</div>
			</div>

			<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
				{loading ? (
					<div className="p-5 text-sm text-slate-500">Loading products...</div>
				) : error ? (
					<div className="p-5 text-sm text-rose-700">Error: {error}</div>
				) : rows.length === 0 ? (
					<div className="p-5 text-sm text-slate-500">Belum ada product untuk filter ini.</div>
				) : (
					<table className="min-w-full text-sm">
						<thead className="bg-slate-50 text-left text-slate-700">
							<tr>
								<th className="px-3 py-2">SKU</th>
								<th className="px-3 py-2">Name</th>
								<th className="px-3 py-2">Price</th>
								<th className="px-3 py-2">Type</th>
								<th className="px-3 py-2">Business</th>
								<th className="px-3 py-2">Categories</th>
								<th className="px-3 py-2">Tags</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">Visible</th>
								<th className="px-3 py-2">Updated</th>
								<th className="px-3 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((item) => (
								<tr key={item.id} className="border-t border-slate-100">
									<td className="px-3 py-2 font-medium text-slate-900">{item.sku}</td>
									<td className="px-3 py-2 text-slate-800">
										<div className="font-medium">{item.name}</div>
										<div className="text-xs text-slate-500">/{item.slug}</div>
									</td>
									<td className="px-3 py-2 text-slate-800">{formatAmount(item.price, { fractionDigits: 0 })}</td>
									<td className="px-3 py-2 text-slate-700"><span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-800 capitalize">{item.product_type || "product"}</span></td>
									<td className="px-3 py-2 text-slate-700">{item.business_id ? <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{businessNameByID[item.business_id] || item.business_id}</span> : <span className="text-xs text-slate-400">-</span>}</td>
									<td className="px-3 py-2 text-slate-700">{renderLabels(item.category_ids, categoryNameByID)}</td>
									<td className="px-3 py-2 text-slate-700">{renderLabels(item.tag_ids, tagNameByID)}</td>
									<td className="px-3 py-2 text-slate-700">{item.status}</td>
									<td className="px-3 py-2 text-slate-700">{item.is_visible ? "Yes" : "No"}</td>
									<td className="px-3 py-2 text-slate-700">{new Date(item.updated_at).toLocaleString()}</td>
									<td className="px-3 py-2">
										<div className="relative inline-block">
											<button
												data-menu-button={item.id}
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													const btn = e.currentTarget as HTMLElement;
													if (openMenuFor === item.id) {
														setOpenMenuFor(null);
														setMenuCoords(null);
														return;
													}
													const rect = btn.getBoundingClientRect();
													const MENU_WIDTH = 160;
													const top = rect.bottom + window.scrollY + 8;
													const left = rect.right + window.scrollX - MENU_WIDTH;
													setMenuCoords({ top, left });
													setOpenMenuFor(item.id);
												}}
												className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
												aria-haspopup="true"
												aria-expanded={openMenuFor === item.id}
											>
												⋯
											</button>

											{openMenuFor === item.id && menuCoords && typeof document !== "undefined"
												? createPortal(
													<div
														onClick={(e) => e.stopPropagation()}
														style={{ position: "absolute", top: menuCoords.top, left: menuCoords.left, width: 160 }}
														className="z-50 rounded-lg border border-slate-200 bg-white shadow-sm"
													>
														<button type="button" onClick={() => { handleEdit(item); setOpenMenuFor(null); setMenuCoords(null); }} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Edit</button>
														<button type="button" onClick={() => { void handleTogglePublish(item); setOpenMenuFor(null); setMenuCoords(null); }} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{item.status === "published" ? "Unpublish" : "Publish"}</button>
														<button type="button" onClick={() => { handleDelete(item); setOpenMenuFor(null); setMenuCoords(null); }} className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">Delete</button>
														<button type="button" onClick={() => { handleDiscounts(item); setOpenMenuFor(null); setMenuCoords(null); }} className="w-full px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">Discounts</button>
														<button type="button" onClick={() => { handleTranslations(item); setOpenMenuFor(null); setMenuCoords(null); }} className="w-full rounded-b px-3 py-2 text-left text-sm text-sky-700 hover:bg-sky-50">Translation</button>
													</div>,
													document.body,
												)
												: null}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)
				}
			</div>

			<div className="flex items-center justify-between text-sm text-slate-600">
				<div>Total: <span className="font-medium text-slate-900">{total}</span></div>
				<div className="flex items-center gap-2">
					<button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50">Prev</button>
					<span>Page {page} / {totalPages}</span>
					<button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50">Next</button>
				</div>
			</div>

			<ProductFormModal open={formOpen} mode={formMode} initialData={selected} businesses={businesses} categories={categories} tags={tags} submitting={submitting} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
			<ProductDeleteModal open={deleteOpen} product={selected} submitting={submitting} onClose={() => setDeleteOpen(false)} onConfirm={handleConfirmDelete} />
			<ProductTranslationsModal open={translationOpen} product={translationProduct} onClose={() => setTranslationOpen(false)} />
			<ProductDiscountsModal open={discountsOpen} product={discountProduct} onClose={() => setDiscountsOpen(false)} />
		</div>
	);
}