import { useEffect, useMemo, useState } from "react";

import { formatAmount } from "../../../lib/amountFormat";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import type { Business } from "../businesses/types";
import type { Discount } from "../discounts/types";
import type { Product } from "../products/types";
import { listMemberBusinesses } from "./api";
import {
	addMemberPosOrderItem,
	applyMemberPosCoupon,
	applyMemberPosItemDiscount,
	createMemberPosDraftOrder,
	finalizeMemberPosOrder,
	getMemberPosOrder,
	listMemberPosCustomers,
	removeMemberPosCoupon,
	removeMemberPosItemDiscount,
	removeMemberPosOrderItem,
	replaceMemberPosExtraCharges,
	updateMemberPosOrder,
	type MemberPosCustomerHistoryItem,
} from "./api";
import CustomerSelectorModal from "./CustomerSelectorModal";
import ProductSelectorModal from "./ProductSelectorModal";
import DiscountSelector from "./DiscountSelector";
import CouponSelectorModal from "./CouponSelectorModal";
import type { Order, OrderExtraCharge } from "../orders/types";

type PosBusiness = Business;

function getLocaleFromPathname(pathname: string): "id" | "en" {
	if (pathname.startsWith("/en/")) return "en";
	return "id";
}

function getOrdersPath() {
	if (typeof window === "undefined") return "/member/orders";
	if (window.location.pathname.startsWith("/en/")) return "/en/member/orders";
	if (window.location.pathname.startsWith("/id/")) return "/id/member/orders";
	return "/member/orders";
}

export default function PosPage() {
	const [businesses, setBusinesses] = useState<PosBusiness[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [businessError, setBusinessError] = useState<string | null>(null);
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);
	const [selectedOrderID, setSelectedOrderID] = useState("");
	const [draftOrder, setDraftOrder] = useState<Order | null>(null);
	const [loadingOrder, setLoadingOrder] = useState(false);
	const [saving, setSaving] = useState(false);
	const [customerID, setCustomerID] = useState("");
	const [selectedCustomer, setSelectedCustomer] = useState<MemberPosCustomerHistoryItem | null>(null);
	const [customerSelectorOpen, setCustomerSelectorOpen] = useState(false);
	const [fulfillmentType, setFulfillmentType] = useState("delivery");
	const [currency, setCurrency] = useState("IDR");
	const [selectorOpen, setSelectorOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [qty, setQty] = useState(1);
	const [unitPrice, setUnitPrice] = useState(0);
	const [discountSelectorOpen, setDiscountSelectorOpen] = useState(false);
	const [discountTargetItemID, setDiscountTargetItemID] = useState("");
	const [discountTargetProductID, setDiscountTargetProductID] = useState("");
	const [couponSelectorOpen, setCouponSelectorOpen] = useState(false);
	const [couponCode, setCouponCode] = useState("");
	const [savingCoupon, setSavingCoupon] = useState(false);
	const [customChargeName, setCustomChargeName] = useState("");
	const [customChargeAmount, setCustomChargeAmount] = useState("");
	const [customChargeNotes, setCustomChargeNotes] = useState("");
	const [savingExtraCharges, setSavingExtraCharges] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const subtotal = useMemo(() => draftOrder?.subtotal || 0, [draftOrder]);
	const discountAmount = useMemo(() => draftOrder?.discount_amount || 0, [draftOrder]);
	const taxAmount = useMemo(() => draftOrder?.tax_amount || 0, [draftOrder]);
	const shippingAmount = useMemo(() => draftOrder?.shipping_amount || 0, [draftOrder]);
	const extraCharges = useMemo(() => (draftOrder?.extra_charges || []) as OrderExtraCharge[], [draftOrder?.extra_charges]);
	const extraChargeTotal = useMemo(() => extraCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0), [extraCharges]);
	const grandTotal = useMemo(() => draftOrder?.grand_total || 0, [draftOrder]);
	const businessNameByID = useMemo(() => Object.fromEntries(businesses.map((item) => [item.id, item.name])), [businesses]);
	const locale = typeof window === "undefined" ? "id" : getLocaleFromPathname(window.location.pathname);
	const ordersPath = buildLocalizedPath("/member/orders", locale);

	const formatOrderDate = (value?: string | null) => {
		if (!value) return "-";
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "-";
		return date.toLocaleString("id-ID", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	};

	const syncQuery = (businessID: string, orderID: string) => {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		if (businessID) url.searchParams.set("business_id", businessID);
		else url.searchParams.delete("business_id");
		if (orderID) url.searchParams.set("order_id", orderID);
		else url.searchParams.delete("order_id");
		window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
	};

	const refreshDraftOrder = async (businessID: string, orderID: string) => {
		if (!businessID || !orderID) return;
		setLoadingOrder(true);
		setError(null);
		try {
			const res = await getMemberPosOrder(businessID, orderID);
			const order = res.data.order;
			setDraftOrder(order);
			setSelectedOrderID(order.id);
			setSelectedBusinessID(res.data.business?.id || order.business_id || businessID);
			setCustomerID(order.customer_id || "");
			setFulfillmentType(order.fulfillment_type || "delivery");
			setCurrency(order.currency || "IDR");
			syncQuery(res.data.business?.id || order.business_id || businessID, order.id);
			return order;
		} catch (err) {
			setDraftOrder(null);
			setSelectedOrderID("");
			setError(err instanceof Error ? err.message : "Gagal memuat draft order");
			return null;
		} finally {
			setLoadingOrder(false);
		}
	};

	const loadBusinesses = async () => {
		setLoadingBusinesses(true);
		setBusinessError(null);
		try {
			const rows = await listMemberBusinesses();
			setBusinesses(rows as PosBusiness[]);
			if (typeof window !== "undefined") {
				const params = new URLSearchParams(window.location.search);
				const queryBusinessID = params.get("business_id")?.trim() || "";
				const queryOrderID = params.get("order_id")?.trim() || "";
				if (queryBusinessID) {
					setSelectedBusinessID(queryBusinessID);
				} else if (!selectedBusinessID && rows[0]?.id) {
					setSelectedBusinessID(rows[0].id);
				}
				if (queryOrderID) {
					setSelectedOrderID(queryOrderID);
				}
				syncQuery(queryBusinessID || rows[0]?.id || "", queryOrderID);
			}
		} catch (err) {
			setBusinessError(err instanceof Error ? err.message : "Gagal memuat daftar toko");
			setBusinesses([]);
		} finally {
			setLoadingBusinesses(false);
		}
	};

	useEffect(() => {
		void loadBusinesses();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!selectedBusinessID || !selectedOrderID || loadingBusinesses) return;
		if (draftOrder?.id === selectedOrderID && draftOrder.business_id === selectedBusinessID) return;
		void refreshDraftOrder(selectedBusinessID, selectedOrderID);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedBusinessID, selectedOrderID, loadingBusinesses]);

	useEffect(() => {
		if (!selectedBusinessID || !customerID.trim()) {
			setSelectedCustomer(null);
			return;
		}
		let cancelled = false;
		const run = async () => {
			try {
				const res = await listMemberPosCustomers(selectedBusinessID, { q: customerID.trim(), page: 1, limit: 10 });
				const exact = res.data.find((item) => item.id === customerID.trim()) || null;
				if (!cancelled) {
					setSelectedCustomer(exact);
				}
			} catch {
				if (!cancelled) {
					setSelectedCustomer(null);
				}
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [selectedBusinessID, customerID]);

	const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessID) || null, [businesses, selectedBusinessID]);

	const ensureDraftOrder = async () => {
		if (!selectedBusinessID) throw new Error("Business wajib dipilih");
		if (draftOrder?.id && draftOrder.business_id === selectedBusinessID) return draftOrder;
		if (selectedOrderID) {
			const refreshed = await refreshDraftOrder(selectedBusinessID, selectedOrderID);
			if (refreshed?.id && refreshed.business_id === selectedBusinessID) return refreshed;
		}
		const created = await createMemberPosDraftOrder(selectedBusinessID, {
			customer_id: customerID.trim() || undefined,
			fulfillment_type: fulfillmentType || "delivery",
			currency: currency || "IDR",
		});
		setDraftOrder(created);
		setSelectedOrderID(created.id);
		syncQuery(selectedBusinessID, created.id);
		return created;
	};

	const createDraft = async () => {
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const order = await createMemberPosDraftOrder(selectedBusinessID, {
				customer_id: customerID.trim() || undefined,
				fulfillment_type: fulfillmentType || "delivery",
				currency: currency || "IDR",
			});
			setDraftOrder(order);
			setSelectedOrderID(order.id);
			syncQuery(selectedBusinessID, order.id);
			notifySuccess("Draft order dibuat");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal membuat draft order");
		} finally {
			setSaving(false);
		}
	};

	const reloadCurrentOrder = async () => {
		if (!selectedBusinessID || !selectedOrderID) return;
		await refreshDraftOrder(selectedBusinessID, selectedOrderID);
	};

	const handleAddLine = async () => {
		if (!selectedProduct) {
			notifyError("Pilih product dulu");
			return;
		}
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setSaving(true);
		try {
			const order = await ensureDraftOrder();
			await addMemberPosOrderItem(selectedBusinessID, order.id, {
				product_id: selectedProduct.id,
				product_name: selectedProduct.name,
				sku: selectedProduct.sku || undefined,
				qty,
				unit_price: unitPrice,
			});
			await reloadCurrentOrder();
			notifySuccess("Item ditambahkan");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menambahkan item");
		} finally {
			setSaving(false);
		}
	};

	const handleRemoveLine = async (itemID: string) => {
		if (!selectedBusinessID || !selectedOrderID) return;
		setSaving(true);
		try {
			await removeMemberPosOrderItem(selectedBusinessID, selectedOrderID, itemID);
			await reloadCurrentOrder();
			notifySuccess("Item dihapus");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus item");
		} finally {
			setSaving(false);
		}
	};

	const openDiscountSelector = (itemID: string, productID?: string | null) => {
		if (!productID) {
			notifyError("Product tidak tersedia untuk discount");
			return;
		}
		setDiscountTargetItemID(itemID);
		setDiscountTargetProductID(productID);
		setDiscountSelectorOpen(true);
	};

	const applyCouponCode = async (code: string) => {
		const normalizedCode = code.trim();
		if (!normalizedCode) {
			notifyError("Coupon wajib diisi");
			return;
		}
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setSavingCoupon(true);
		try {
			const order = await ensureDraftOrder();
			await applyMemberPosCoupon(selectedBusinessID, order.id, normalizedCode);
			await reloadCurrentOrder();
			setCouponCode("");
			notifySuccess("Coupon diterapkan");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menerapkan coupon");
		} finally {
			setSavingCoupon(false);
		}
	};

	const applyItemDiscount = async (discount: Discount) => {
		if (!selectedBusinessID || !selectedOrderID || !discountTargetItemID) return;
		setSaving(true);
		try {
			await applyMemberPosItemDiscount(selectedBusinessID, selectedOrderID, discountTargetItemID, discount.id);
			await reloadCurrentOrder();
			setDiscountSelectorOpen(false);
			notifySuccess("Discount diterapkan");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menerapkan discount");
		} finally {
			setSaving(false);
		}
	};

	const handleRemoveItemDiscount = async (itemID: string) => {
		if (!selectedBusinessID || !selectedOrderID) return;
		setSaving(true);
		try {
			await removeMemberPosItemDiscount(selectedBusinessID, selectedOrderID, itemID);
			await reloadCurrentOrder();
			notifySuccess("Discount dihapus");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus discount");
		} finally {
			setSaving(false);
		}
	};

	const handleRemoveCoupon = async (code: string) => {
		if (!selectedBusinessID || !selectedOrderID) return;
		setSavingCoupon(true);
		try {
			await removeMemberPosCoupon(selectedBusinessID, selectedOrderID, code);
			await reloadCurrentOrder();
			notifySuccess("Coupon dihapus");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus coupon");
		} finally {
			setSavingCoupon(false);
		}
	};

	const handleAddCustomCharge = async () => {
		const name = customChargeName.trim();
		if (!name) {
			notifyError("Nama biaya tambahan wajib diisi");
			return;
		}
		const amount = Number(customChargeAmount || "0");
		if (!Number.isFinite(amount) || amount < 0) {
			notifyError("Nominal biaya tambahan harus angka >= 0");
			return;
		}
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setSavingExtraCharges(true);
		try {
			const order = await ensureDraftOrder();
			const next = [
				...extraCharges.map((charge, index) => ({
					name: String(charge.name || "").trim(),
					amount: Number(charge.amount || 0),
					notes: String(charge.notes || "").trim(),
					sort_order: Number(charge.sort_order || index + 1),
				})),
				{ name, amount, notes: customChargeNotes.trim(), sort_order: extraCharges.length + 1 },
			];
			const updated = await replaceMemberPosExtraCharges(selectedBusinessID, order.id, { charges: next });
			setDraftOrder(updated);
			setCustomChargeName("");
			setCustomChargeAmount("");
			setCustomChargeNotes("");
			notifySuccess("Biaya tambahan disimpan");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menyimpan biaya tambahan");
		} finally {
			setSavingExtraCharges(false);
		}
	};

	const handleRemoveCustomCharge = async (indexToRemove: number) => {
		if (!selectedBusinessID || !selectedOrderID) return;
		setSavingExtraCharges(true);
		try {
			const next = extraCharges
				.filter((_, index) => index !== indexToRemove)
				.map((charge, index) => ({
					name: String(charge.name || "").trim(),
					amount: Number(charge.amount || 0),
					notes: String(charge.notes || "").trim(),
					sort_order: index + 1,
				}));
			const updated = await replaceMemberPosExtraCharges(selectedBusinessID, selectedOrderID, { charges: next });
			setDraftOrder(updated);
			notifySuccess("Biaya tambahan dihapus");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus biaya tambahan");
		} finally {
			setSavingExtraCharges(false);
		}
	};

	const handleFinalize = async () => {
		if (!selectedBusinessID) {
			notifyError("Pilih business dulu");
			return;
		}
		setSaving(true);
		try {
			const order = await ensureDraftOrder();
			const finalized = await finalizeMemberPosOrder(selectedBusinessID, order.id);
			setDraftOrder(finalized);
			syncQuery(selectedBusinessID, finalized.id);
			notifySuccess("Order disiapkan dan difinalize");
			window.location.href = `${ordersPath}?business_id=${encodeURIComponent(selectedBusinessID)}&order_id=${encodeURIComponent(finalized.id)}`;
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal finalize order");
		} finally {
			setSaving(false);
		}
	};

	const handleClearItems = async () => {
		if (!selectedBusinessID || !selectedOrderID || !draftOrder?.order_items?.length) return;
		setSaving(true);
		try {
			for (const item of draftOrder.order_items) {
				await removeMemberPosOrderItem(selectedBusinessID, selectedOrderID, item.id);
			}
			await reloadCurrentOrder();
			notifySuccess("Semua item dihapus");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus item");
		} finally {
			setSaving(false);
		}
	};

	const handleBusinessChange = (nextBusinessID: string) => {
		setSelectedBusinessID(nextBusinessID);
		setSelectedOrderID("");
		setDraftOrder(null);
		setCustomerID("");
		setSelectedCustomer(null);
		setCustomerSelectorOpen(false);
		syncQuery(nextBusinessID, "");
	};

	const handleSelectCustomer = async (customer: MemberPosCustomerHistoryItem) => {
		setCustomerID(customer.id);
		setSelectedCustomer(customer);
		setCustomerSelectorOpen(false);
		if (!selectedBusinessID || !draftOrder?.id || draftOrder.business_id !== selectedBusinessID) {
			return;
		}
		setSaving(true);
		try {
			await updateMemberPosOrder(selectedBusinessID, draftOrder.id, {
				customer_id: customer.id,
				fulfillment_type: fulfillmentType || "delivery",
			});
			await reloadCurrentOrder();
			notifySuccess("Customer disimpan ke draft");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menyimpan customer");
		} finally {
			setSaving(false);
		}
	};

	const handleClearCustomer = async () => {
		setCustomerID("");
		setSelectedCustomer(null);
		setCustomerSelectorOpen(false);
		if (!selectedBusinessID || !draftOrder?.id || draftOrder.business_id !== selectedBusinessID) {
			return;
		}
		setSaving(true);
		try {
			await updateMemberPosOrder(selectedBusinessID, draftOrder.id, {
				customer_id: null,
				fulfillment_type: fulfillmentType || "delivery",
			});
			await reloadCurrentOrder();
			notifySuccess("Customer dihapus dari draft");
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal menghapus customer");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-5">
			<div className="rounded-2xl border border-[#e8e0d6] bg-gradient-to-r from-[#fef7ef] via-white to-[#f7fbf8] p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Member POS</p>
						<h3 className="mt-1 text-2xl font-semibold text-slate-900">Draft order builder</h3>
						<p className="mt-1 text-sm text-slate-600">Buat order dari sisi member dengan flow draft, item, diskon, coupon, dan finalize.</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<a href={ordersPath} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
							Open Orders
						</a>
						<button type="button" onClick={createDraft} disabled={saving || loadingBusinesses || !selectedBusinessID} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
							{saving ? "Saving..." : draftOrder ? "Refresh Draft" : "Create Draft"}
						</button>
					</div>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Business *</label>
						<select
							value={selectedBusinessID}
							onChange={(e) => handleBusinessChange(e.target.value)}
							className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
							disabled={loadingBusinesses}
						>
							<option value="">Select business</option>
							{businesses.map((business) => (
								<option key={business.id} value={business.id}>
									{business.name}
								</option>
							))}
						</select>
						{businessError ? <p className="mt-1 text-xs text-rose-600">{businessError}</p> : null}
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
						<div className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
							{selectedCustomer ? (
								<div className="space-y-1">
									<div className="font-medium text-slate-900">{selectedCustomer.name || "-"}</div>
									<div className="text-xs text-slate-500">ID: {selectedCustomer.id}</div>
									<div className="text-xs text-slate-500">{selectedCustomer.email || "-"}</div>
									<div className="text-xs text-slate-500">{selectedCustomer.phone || "-"}</div>
									<div className="text-xs text-slate-500">
										Riwayat: {selectedCustomer.order_count} order · terakhir {formatOrderDate(selectedCustomer.last_order_at)}
									</div>
								</div>
							) : customerID ? (
								<div className="space-y-1">
									<div className="font-medium text-slate-900">Customer selected</div>
									<div className="text-xs text-slate-500">ID: {customerID}</div>
								</div>
							) : (
								<div className="text-slate-500">Belum pilih customer.</div>
							)}
						</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setCustomerSelectorOpen(true)}
								disabled={!selectedBusinessID}
								className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
							>
								{selectedCustomer ? "Change Customer" : "Select Customer"}
							</button>
							{customerID ? (
								<button
									type="button"
									onClick={() => void handleClearCustomer()}
									disabled={saving}
									className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
								>
									Clear Customer
								</button>
							) : null}
						</div>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Fulfillment</label>
						<select value={fulfillmentType} onChange={(e) => setFulfillmentType(e.target.value === "pickup" ? "pickup" : "delivery")} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
							<option value="delivery">Delivery</option>
							<option value="pickup">Pickup</option>
						</select>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
						<input value={currency} readOnly className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
					</div>
				</div>
				{selectedBusiness ? <p className="mt-3 text-xs text-slate-500">Selected business: {selectedBusiness.name}</p> : null}
			</div>

			<section className="rounded-2xl border border-[#e8e0d6] bg-white p-5 shadow-sm">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h4 className="text-base font-semibold text-slate-900">Add Item</h4>
						<p className="text-sm text-slate-600">Pilih product dari katalog member lalu masukkan ke draft order.</p>
					</div>
					<button type="button" onClick={() => setSelectorOpen(true)} disabled={!selectedBusinessID} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
						{selectedProduct ? "Change Product" : "Select Product"}
					</button>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-[2fr,120px,180px]">
					<div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
						{selectedProduct ? (
							<div>
								<div className="font-medium text-slate-900">{selectedProduct.name}</div>
								<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
									<span>ID: {selectedProduct.id}</span>
									<span>SKU: {selectedProduct.sku || "-"}</span>
									<span>Business: {selectedProduct.business_id ? businessNameByID[selectedProduct.business_id] || selectedProduct.business_id : "-"}</span>
								</div>
							</div>
						) : (
							<span className="text-slate-500">No product selected yet.</span>
						)}
					</div>
					<input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Qty" />
					<div>
						<label className="mb-1 block text-xs text-slate-500">Unit Price</label>
						<input
							type="number"
							min={0}
							step="0.01"
							value={unitPrice}
							onChange={(e) => setUnitPrice(Number(e.target.value))}
							className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
							placeholder="Unit price"
							disabled={selectedProduct ? !selectedProduct.price_override_enabled : false}
						/>
					</div>
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					{selectedProduct ? (
						<button type="button" onClick={() => { setSelectedProduct(null); setUnitPrice(0); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
							Clear Product
						</button>
					) : null}
					<button type="button" onClick={handleAddLine} disabled={saving || !selectedBusinessID} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
						+ Add Item to Order
					</button>
				</div>
			</section>

			<section className="rounded-2xl border border-[#e8e0d6] bg-white p-5 shadow-sm">
				<h4 className="text-base font-semibold text-slate-900">Order Items</h4>
				{!draftOrder || !draftOrder.order_items || draftOrder.order_items.length === 0 ? (
					<p className="mt-3 text-sm text-slate-600">No items yet.</p>
				) : (
					<div className="mt-3 overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Product</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Qty</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Unit Price</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Disc</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Tax</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Line Total</th>
									<th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{draftOrder.order_items.map((line) => (
									<tr key={line.id}>
										<td className="px-3 py-2 text-slate-800">
											<div>{line.product_name || line.product_id || "-"}</div>
											{line.sku && <div className="text-xs text-slate-400">SKU: {line.sku}</div>}
											{line.discount_name ? <div className="mt-1 text-xs text-amber-700">Discount: {line.discount_name}</div> : null}
										</td>
										<td className="px-3 py-2 text-right text-slate-700">{line.qty}</td>
										<td className="px-3 py-2 text-right text-slate-700">{formatAmount(line.unit_price, { fractionDigits: 0 })}</td>
										<td className="px-3 py-2 text-right text-rose-600">{line.discount_amount > 0 ? `-${formatAmount(line.discount_amount, { fractionDigits: 0 })}` : "-"}</td>
										<td className="px-3 py-2 text-right text-slate-500">
											<div>{line.tax_amount > 0 ? formatAmount(line.tax_amount, { fractionDigits: 0 }) : "-"}</div>
										</td>
										<td className="px-3 py-2 text-right font-medium text-slate-900">{formatAmount(line.line_total, { fractionDigits: 0 })}</td>
										<td className="px-3 py-2 text-right">
											<div className="flex justify-end gap-2">
												<button type="button" onClick={() => openDiscountSelector(line.id, line.product_id)} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">Select Discount</button>
												{line.discount_amount > 0 ? (
													<button type="button" onClick={() => handleRemoveItemDiscount(line.id)} className="text-xs font-medium text-amber-700 hover:text-amber-800">Clear Discount</button>
												) : null}
												<button type="button" onClick={() => handleRemoveLine(line.id)} className="text-xs font-medium text-rose-600 hover:text-rose-700">Remove</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<div className="mt-4 border-t border-slate-200 pt-4">
					<h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Coupon / Promo</h5>
					{(draftOrder?.applied_coupons ?? []).length > 0 && (
						<div className="mb-2 flex flex-wrap gap-2">
							{draftOrder!.applied_coupons.map((coupon) => (
								<div key={coupon.code} className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
									<span className="text-xs font-semibold uppercase text-emerald-700">{coupon.code}</span>
									<span className="text-xs text-slate-500 capitalize">({coupon.category})</span>
									<button type="button" onClick={() => handleRemoveCoupon(coupon.code)} disabled={savingCoupon} className="ml-1 text-xs leading-none text-rose-400 hover:text-rose-600 disabled:opacity-50" title="Remove coupon">
										✕
									</button>
								</div>
							))}
						</div>
					)}
					<div className="flex flex-wrap gap-2">
						<input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && void applyCouponCode(couponCode)} placeholder="Add another coupon code…" className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm uppercase" disabled={!draftOrder} />
						<button type="button" onClick={() => void applyCouponCode(couponCode)} disabled={savingCoupon || !draftOrder || !couponCode.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
							{savingCoupon ? "..." : "Apply"}
						</button>
						<button type="button" onClick={() => setCouponSelectorOpen(true)} disabled={!draftOrder} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60">
							Browse Vouchers
						</button>
					</div>
					<p className="mt-1 text-xs text-slate-400">Coupons can be combined when their categories differ: product, shipping, cashback.</p>
				</div>

				<div className="mt-4 border-t border-slate-200 pt-4">
					<h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Biaya Tambahan Custom</h5>
					<div className="grid gap-2 md:grid-cols-[2fr,1fr,2fr,auto]">
						<input type="text" value={customChargeName} onChange={(e) => setCustomChargeName(e.target.value)} placeholder="Nama biaya (mis: Packing Kayu, Asuransi)" className="rounded border border-slate-300 px-3 py-2 text-sm" />
						<input type="number" min="0" step="0.01" value={customChargeAmount} onChange={(e) => setCustomChargeAmount(e.target.value)} placeholder="Nominal" className="rounded border border-slate-300 px-3 py-2 text-sm" />
						<input type="text" value={customChargeNotes} onChange={(e) => setCustomChargeNotes(e.target.value)} placeholder="Catatan (opsional)" className="rounded border border-slate-300 px-3 py-2 text-sm" />
						<button type="button" onClick={handleAddCustomCharge} disabled={savingExtraCharges || saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
							{savingExtraCharges ? "..." : "Tambah"}
						</button>
					</div>

					{extraCharges.length > 0 ? (
						<div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
							{extraCharges.map((charge, index) => (
								<div key={charge.id || `${charge.name}-${index}`} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-sm">
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-slate-900">{charge.name}</p>
										{charge.notes ? <p className="truncate text-xs text-slate-500">{charge.notes}</p> : null}
									</div>
									<div className="flex items-center gap-3">
										<span className="font-semibold text-slate-800">{formatAmount(Number(charge.amount || 0), { fractionDigits: 0 })}</span>
										<button type="button" onClick={() => handleRemoveCustomCharge(index)} disabled={savingExtraCharges || saving} className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60">
											Hapus
										</button>
									</div>
								</div>
							))}
						</div>
					) : null}
				</div>

				<div className="mt-4 border-t border-slate-200 pt-4 space-y-1.5">
					<div className="flex justify-between text-sm text-slate-600">
						<span>Subtotal</span>
						<span>{formatAmount(subtotal, { fractionDigits: 0 })}</span>
					</div>
					{discountAmount > 0 ? (
						<div className="flex justify-between text-sm text-rose-600">
							<span>Diskon</span>
							<span>-{formatAmount(discountAmount, { fractionDigits: 0 })}</span>
						</div>
					) : null}
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
						<div className="flex justify-between text-sm text-slate-600">
							<span>Tax</span>
							<span>{formatAmount(taxAmount, { fractionDigits: 0 })}</span>
						</div>
					</div>
					<div className="flex justify-between text-sm text-slate-600">
						<span>Fulfillment</span>
						<span>{fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</span>
					</div>
					{shippingAmount > 0 ? (
						<div className="flex justify-between text-sm text-slate-600">
							<span>Shipping</span>
							<span>{formatAmount(shippingAmount, { fractionDigits: 0 })}</span>
						</div>
					) : null}
					{extraCharges.map((charge) => (
						<div key={charge.id} className="flex justify-between text-sm text-slate-600">
							<span>{charge.name}</span>
							<span>{formatAmount(Number(charge.amount || 0), { fractionDigits: 0 })}</span>
						</div>
					))}
					{extraChargeTotal > 0 ? (
						<div className="flex justify-between text-sm text-slate-700">
							<span>Total Biaya Tambahan</span>
							<span>{formatAmount(extraChargeTotal, { fractionDigits: 0 })}</span>
						</div>
					) : null}
					<div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
						<span>Total</span>
						<span>{formatAmount(grandTotal, { fractionDigits: 0 })}</span>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap justify-end gap-2">
					<button type="button" onClick={handleClearItems} disabled={saving || !draftOrder?.order_items?.length} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60">
						Clear
					</button>
					<button type="button" disabled={saving || !draftOrder} onClick={handleFinalize} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
						{saving ? "Saving..." : "Finalize Order"}
					</button>
				</div>
			</section>

			<CustomerSelectorModal
				open={customerSelectorOpen}
				businessID={selectedBusinessID}
				currentCustomerID={customerID || undefined}
				onClose={() => setCustomerSelectorOpen(false)}
				onSelect={handleSelectCustomer}
			/>

			<ProductSelectorModal
				open={selectorOpen}
				businessID={selectedBusinessID}
				businessNameByID={businessNameByID}
				currentProductID={selectedProduct?.id}
				onClose={() => setSelectorOpen(false)}
				onSelect={(product) => {
					setSelectedProduct(product);
					setUnitPrice(Number((product.sale_price ?? product.price) || 0));
					setSelectorOpen(false);
				}}
			/>

			<DiscountSelector
				open={discountSelectorOpen}
				businessID={selectedBusinessID}
				productID={discountTargetProductID}
				onClose={() => setDiscountSelectorOpen(false)}
				onSelect={applyItemDiscount}
			/>

			<CouponSelectorModal
				open={couponSelectorOpen}
				businessID={selectedBusinessID}
				onClose={() => setCouponSelectorOpen(false)}
				onSelect={(coupon) => {
					setCouponCode(coupon.code.toUpperCase());
					setCouponSelectorOpen(false);
					void applyCouponCode(coupon.code);
				}}
			/>

			{businessError && !businesses.length ? <p className="text-sm text-rose-600">{businessError}</p> : null}
			{loadingBusinesses ? <p className="text-sm text-slate-500">Loading businesses...</p> : null}
			{loadingOrder ? <p className="text-sm text-slate-500">Loading order...</p> : null}
			{error ? <p className="text-sm text-rose-600">{error}</p> : null}
		</div>
	);
}
