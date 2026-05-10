import { useEffect, useMemo, useState } from "react";

import { notifyError } from "../../../lib/notification";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import OrderDetailModal from "./OrderDetailModal";
import OrdersTable from "./OrdersTable";
import { getMemberOrderByID, listMemberOrders } from "./api";
import type { Order, MemberOrderListParams } from "./types";

export default function MemberOrdersPage() {
	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [items, setItems] = useState<Order[]>([]);
	const [total, setTotal] = useState(0);
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [businessError, setBusinessError] = useState<string | null>(null);

	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(20);
	const [q, setQ] = useState("");
	const [status, setStatus] = useState("");
	const [paymentStatus, setPaymentStatus] = useState("");
	const [channel, setChannel] = useState("");
	const [sort, setSort] = useState("-updated_at");

	const [selectedOrderID, setSelectedOrderID] = useState("");
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

	const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/en/") ? "en" : typeof window !== "undefined" && window.location.pathname.startsWith("/id/") ? "id" : undefined;
	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
	const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessID) || null, [businesses, selectedBusinessID]);

	const setOrderDetailQuery = (orderID: string | null) => {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		if (selectedBusinessID) {
			url.searchParams.set("business_id", selectedBusinessID);
		} else {
			url.searchParams.delete("business_id");
		}
		if (orderID) {
			url.searchParams.set("order_id", orderID);
		} else {
			url.searchParams.delete("order_id");
		}
		window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
	};

	const loadBusinesses = async () => {
		setLoadingBusinesses(true);
		setBusinessError(null);
		try {
			const res = await memberGet<BusinessListResponse>("/api/member/businesses?page=1&limit=200");
			const list = Array.isArray(res.data) ? res.data : [];
			setBusinesses(list);
			const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
			const queryBusinessID = params?.get("business_id")?.trim() || "";
			const queryMatch = queryBusinessID ? list.find((business) => business.id === queryBusinessID) : null;
			if (queryMatch?.id) {
				setSelectedBusinessID(queryMatch.id);
			} else if (!selectedBusinessID && list[0]?.id) {
				setSelectedBusinessID(list[0].id);
			}
		} catch (err) {
			setBusinessError(err instanceof Error ? err.message : "Gagal memuat daftar toko");
			setBusinesses([]);
		} finally {
			setLoadingBusinesses(false);
		}
	};

	const loadData = async (businessID: string) => {
		if (!businessID) return;
		setLoading(true);
		setError(null);
		const params: MemberOrderListParams = { q, status, payment_status: paymentStatus, channel, sort, page, limit };
		try {
			const res = await listMemberOrders(businessID, params);
			setItems(res.data || []);
			setTotal(res.total || 0);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Gagal memuat order");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadBusinesses();
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const selected = params.get("business_id")?.trim() || "";
		const qValue = params.get("q")?.trim() || "";
		const statusValue = params.get("status")?.trim() || "";
		const paymentStatusValue = params.get("payment_status")?.trim() || "";
		const channelValue = params.get("channel")?.trim() || "";
		const sortValue = params.get("sort")?.trim() || "-updated_at";
		const pageValue = Number(params.get("page") || "1");
		const limitValue = Number(params.get("limit") || "20");

		if (selected) setSelectedBusinessID(selected);
		if (qValue) setQ(qValue);
		if (statusValue) setStatus(statusValue);
		if (paymentStatusValue) setPaymentStatus(paymentStatusValue);
		if (channelValue) setChannel(channelValue);
		if (sortValue) setSort(sortValue);
		if (Number.isFinite(pageValue) && pageValue > 0) setPage(pageValue);
		if (Number.isFinite(limitValue) && limitValue > 0) setLimit(limitValue);
	}, []);

	useEffect(() => {
		if (!selectedBusinessID) return;
		void loadData(selectedBusinessID);
		setOrderDetailQuery(selectedOrderID || null);
	}, [selectedBusinessID, page, limit, q, status, paymentStatus, channel, sort]);

	useEffect(() => {
		const params = new URLSearchParams();
		if (selectedBusinessID) params.set("business_id", selectedBusinessID);
		if (q) params.set("q", q);
		if (status) params.set("status", status);
		if (paymentStatus) params.set("payment_status", paymentStatus);
		if (channel) params.set("channel", channel);
		if (sort) params.set("sort", sort);
		if (page > 1) params.set("page", String(page));
		if (limit !== 20) params.set("limit", String(limit));
		if (selectedOrderID) params.set("order_id", selectedOrderID);
		const next = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
		window.history.replaceState(null, "", next);
	}, [selectedBusinessID, q, status, paymentStatus, channel, sort, page, limit, selectedOrderID]);

	const openDetailByID = async (orderID: string) => {
		if (!selectedBusinessID) return;
		setSelectedOrderID(orderID);
		setDetailOpen(true);
		setDetailLoading(true);
		setOrderDetailQuery(orderID);
		try {
			const res = await getMemberOrderByID(selectedBusinessID, orderID);
			setSelectedOrder({
				...res.data.order,
				payments: res.data.payments || res.data.order.payments || [],
			});
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal memuat detail order");
			setSelectedOrder(null);
			setDetailOpen(false);
			setSelectedOrderID("");
			setOrderDetailQuery(null);
		} finally {
			setDetailLoading(false);
		}
	};

	const refreshSelectedOrder = async () => {
		if (!selectedOrderID || !selectedBusinessID) return;
		setDetailLoading(true);
		try {
			const res = await getMemberOrderByID(selectedBusinessID, selectedOrderID);
			setSelectedOrder({
				...res.data.order,
				payments: res.data.payments || res.data.order.payments || [],
			});
			await loadData(selectedBusinessID);
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal refresh order");
		} finally {
			setDetailLoading(false);
		}
	};

	const clearFilters = () => {
		setPage(1);
		setQ("");
		setStatus("");
		setPaymentStatus("");
		setChannel("");
		setSort("-updated_at");
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h3 className="text-base font-semibold text-slate-900">Orders</h3>
					<p className="text-sm text-slate-600">Monitoring order untuk toko yang dipilih.</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" onClick={() => selectedBusinessID && void loadData(selectedBusinessID)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Refresh</button>
					{selectedBusiness ? <a href={buildLocalizedPath(`/b/${selectedBusiness.slug}`, locale)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Open Store</a> : null}
				</div>
			</div>

			<div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-3 xl:grid-cols-6">
				<label className="space-y-2 text-sm lg:col-span-2">
					<span className="font-medium text-slate-700">Store</span>
					<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={selectedBusinessID} onChange={(e) => { setPage(1); setSelectedBusinessID(e.target.value); }} disabled={loadingBusinesses || businesses.length === 0}>
						<option value="">{loadingBusinesses ? "Loading stores..." : "Select store"}</option>
						{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
					</select>
				</label>
				<label className="space-y-2 text-sm">
					<span className="font-medium text-slate-700">Search</span>
					<input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search order number" />
				</label>
				<label className="space-y-2 text-sm">
					<span className="font-medium text-slate-700">Status</span>
					<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
						<option value="">All order status</option>
						<option value="pending">pending</option>
						<option value="processing">processing</option>
						<option value="shipped">shipped</option>
						<option value="waiting_customer_confirmation">waiting_customer_confirmation</option>
						<option value="in_dispute">in_dispute</option>
						<option value="refunded">refunded</option>
						<option value="completed">completed</option>
						<option value="cancelled">cancelled</option>
					</select>
				</label>
				<label className="space-y-2 text-sm">
					<span className="font-medium text-slate-700">Payment</span>
					<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={paymentStatus} onChange={(e) => { setPage(1); setPaymentStatus(e.target.value); }}>
						<option value="">All payment status</option>
						<option value="unpaid">unpaid</option>
						<option value="pending">pending</option>
						<option value="paid">paid</option>
						<option value="refunded">refunded</option>
						<option value="failed">failed</option>
					</select>
				</label>
				<label className="space-y-2 text-sm">
					<span className="font-medium text-slate-700">Channel</span>
					<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={channel} onChange={(e) => { setPage(1); setChannel(e.target.value); }}>
						<option value="">All channels</option>
						<option value="web">web</option>
						<option value="pos">pos</option>
					</select>
				</label>
				<label className="space-y-2 text-sm">
					<span className="font-medium text-slate-700">Sort</span>
					<select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }}>
						<option value="-updated_at">Latest updated</option>
						<option value="-created_at">Latest created</option>
						<option value="created_at">Oldest created</option>
					</select>
				</label>
				<div className="flex items-end gap-2 lg:col-span-2">
					<button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset Filters</button>
				</div>
			</div>

			{businessError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{businessError}</div> : null}
			{selectedBusinessID ? <OrdersTable items={items} loading={loading} error={error} onView={(item) => void openDetailByID(item.id)} /> : <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Pilih toko terlebih dahulu.</div>}

			<div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
				<p className="text-sm text-slate-600">Showing {items.length} of {total} orders</p>
				<div className="flex items-center gap-2">
					<button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
					<span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
					<button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
				</div>
			</div>

			<OrderDetailModal
				open={detailOpen}
				loading={detailLoading}
				order={selectedOrderID ? selectedOrder : null}
				businessID={selectedBusinessID}
				businessName={selectedBusiness?.name}
				onRefresh={refreshSelectedOrder}
				onClose={() => {
					setDetailOpen(false);
					setSelectedOrderID("");
					setSelectedOrder(null);
					setOrderDetailQuery(null);
				}}
			/>
		</div>
	);
}