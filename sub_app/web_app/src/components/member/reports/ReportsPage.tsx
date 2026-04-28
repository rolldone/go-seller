import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, CircleDollarSign, Download, Package, RefreshCw, ReceiptText, Store, TrendingUp } from "lucide-react";

import { formatAmount } from "../../../lib/amountFormat";
import { getMemberAuthToken } from "../../../lib/memberSession";
import { buildLocalizedPath, getLocaleFromPathname } from "../../../lib/siteLocale";
import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import { listMemberOrders } from "../orders/api";
import type { Order } from "../orders/types";

interface Props {
	locale?: string;
}

type Locale = "id" | "en";
type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: Array<{ value: PeriodKey; labelId: string; labelEn: string; days: number | null }> = [
	{ value: "7d", labelId: "7 hari", labelEn: "7 days", days: 7 },
	{ value: "30d", labelId: "30 hari", labelEn: "30 days", days: 30 },
	{ value: "90d", labelId: "90 hari", labelEn: "90 days", days: 90 },
	{ value: "all", labelId: "Semua data", labelEn: "All data", days: null },
];

function normalizeValue(value?: string | null) {
	return String(value || "").trim().toLowerCase();
}

function formatCurrency(amount: number) {
	return `Rp ${formatAmount(amount, { fractionDigits: 0 })}`;
}

function formatShortDate(value: string, locale: Locale) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { day: "2-digit", month: "short" }).format(date);
}

function formatLongDate(value?: string | null, locale: Locale = "id") {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "-";
	return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function getOrderDate(order: Order) {
	return order.placed_at || order.created_at;
}

function isPaidOrder(order: Order) {
	const paymentStatus = normalizeValue(order.payment_status);
	const orderStatus = normalizeValue(order.status);
	return ["paid", "confirmed", "processing", "packed", "shipped", "delivered", "completed"].includes(paymentStatus) || ["paid", "confirmed", "processing", "packed", "shipped", "delivered", "completed"].includes(orderStatus);
}

function isProblemOrder(order: Order) {
	const paymentStatus = normalizeValue(order.payment_status);
	const orderStatus = normalizeValue(order.status);
	return ["cancelled", "canceled", "expired", "failed", "rejected"].includes(paymentStatus) || ["cancelled", "canceled", "expired", "failed", "rejected"].includes(orderStatus);
}

function getBusinessLabel(business: Business, locale: Locale) {
	if (business.member_invited) {
		return locale === "en" ? `${business.name} (invited)` : `${business.name} (diundang)`;
	}
	return business.name;
}

function escapeCsv(value: unknown) {
	const text = String(value ?? "");
	return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<Record<string, unknown>>) {
	if (!rows.length) return "";
	const columns = Object.keys(rows[0]);
	const header = columns.map(escapeCsv).join(",");
	const body = rows
		.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))
		.join("\n");
	return `${header}\n${body}`;
}

async function memberDownloadBlob(path: string): Promise<Blob> {
	const apiUrl = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";
	if (!apiUrl) {
		throw new Error("PUBLIC_API_URL belum dikonfigurasi");
	}

	const token = getMemberAuthToken();
	const headers: HeadersInit = { Accept: "application/pdf" };
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${apiUrl}${path}`, {
		method: "GET",
		credentials: "include",
		headers,
	});

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
	}

	return response.blob();
}

export default function ReportsPage({ locale }: Props) {
	const resolvedLocale: Locale = locale === "en" ? "en" : getLocaleFromPathname(typeof window !== "undefined" ? window.location.pathname : null);
	const t = (idText: string, enText: string) => (resolvedLocale === "en" ? enText : idText);

	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [period, setPeriod] = useState<PeriodKey>("30d");
	const [businessesLoading, setBusinessesLoading] = useState(true);
	const [reportsLoading, setReportsLoading] = useState(false);
	const [pdfLoading, setPdfLoading] = useState(false);
	const [businessesError, setBusinessesError] = useState("");
	const [reportsError, setReportsError] = useState("");
	const [orders, setOrders] = useState<Order[]>([]);
	const [referenceNow] = useState(() => new Date());

	useEffect(() => {
		let cancelled = false;
		setBusinessesLoading(true);
		setBusinessesError("");

		memberGet<BusinessListResponse>("/api/member/businesses?page=1&limit=100")
			.then((response) => {
				if (cancelled) return;
				const list = Array.isArray(response.data) ? response.data : [];
				setBusinesses(list);
				setSelectedBusinessID((current) => {
					if (current && list.some((business) => business.id === current)) return current;
					return list[0]?.id || "";
				});
			})
			.catch((error) => {
				if (cancelled) return;
				setBusinessesError(error instanceof Error ? error.message : t("Gagal memuat toko", "Failed to load stores"));
				setBusinesses([]);
				setSelectedBusinessID("");
			})
			.finally(() => {
				if (!cancelled) setBusinessesLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!selectedBusinessID) {
			setOrders([]);
			return;
		}

		let cancelled = false;
		setReportsLoading(true);
		setReportsError("");

		listMemberOrders(selectedBusinessID, { page: 1, limit: 200, sort: "-updated_at" })
			.then((response) => {
				if (cancelled) return;
				setOrders(Array.isArray(response.data) ? response.data : []);
			})
			.catch((error) => {
				if (cancelled) return;
				setReportsError(error instanceof Error ? error.message : t("Gagal memuat laporan", "Failed to load report data"));
				setOrders([]);
			})
			.finally(() => {
				if (!cancelled) setReportsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedBusinessID]);

	const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessID) || null, [businesses, selectedBusinessID]);
	const periodDays = PERIOD_OPTIONS.find((option) => option.value === period)?.days || null;
	const periodStart = useMemo(() => {
		if (!periodDays) return null;
		const date = new Date(referenceNow);
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - (periodDays - 1));
		return date;
	}, [periodDays, referenceNow]);

	const filteredOrders = useMemo(() => {
		if (!periodStart) return orders;
		return orders.filter((order) => {
			const orderDate = new Date(getOrderDate(order));
			return !Number.isNaN(orderDate.getTime()) && orderDate >= periodStart && orderDate <= referenceNow;
		});
	}, [orders, periodStart, referenceNow]);

	const summary = useMemo(() => {
		const totalOrders = filteredOrders.length;
		const grossRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
		const paidOrders = filteredOrders.filter(isPaidOrder).length;
		const pendingOrders = filteredOrders.filter((order) => !isPaidOrder(order) && !isProblemOrder(order)).length;
		const cancelledOrders = filteredOrders.filter(isProblemOrder).length;
		const averageOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;
		return { totalOrders, grossRevenue, paidOrders, pendingOrders, cancelledOrders, averageOrderValue };
	}, [filteredOrders]);

	const trend = useMemo(() => {
		const bucketCount = period === "7d" ? 7 : period === "30d" ? 14 : period === "90d" ? 21 : 14;
		const revenueByDate = new Map<string, number>();
		for (const order of filteredOrders) {
			const orderDate = new Date(getOrderDate(order));
			if (Number.isNaN(orderDate.getTime())) continue;
			const key = toDateKey(orderDate);
			revenueByDate.set(key, (revenueByDate.get(key) || 0) + Number(order.grand_total || 0));
		}

		const series: Array<{ key: string; label: string; amount: number }> = [];
		for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
			const date = new Date(referenceNow);
			date.setDate(date.getDate() - offset);
			const key = toDateKey(date);
			series.push({ key, label: formatShortDate(key, resolvedLocale), amount: revenueByDate.get(key) || 0 });
		}
		return series;
	}, [filteredOrders, period, referenceNow, resolvedLocale]);

	const maxTrendAmount = Math.max(...trend.map((item) => item.amount), 1);

	const topProducts = useMemo(() => {
		const aggregate = new Map<string, { name: string; qty: number; revenue: number }>();
		for (const order of filteredOrders) {
			for (const item of order.order_items || []) {
				const name = item.product_name?.trim() || item.sku?.trim() || t("Produk tanpa nama", "Unnamed product");
				const current = aggregate.get(name) || { name, qty: 0, revenue: 0 };
				current.qty += Number(item.qty || 0);
				current.revenue += Number(item.line_total || 0);
				aggregate.set(name, current);
			}
		}
		return Array.from(aggregate.values())
			.sort((left, right) => right.revenue - left.revenue)
			.slice(0, 5);
	}, [filteredOrders, t]);

	const recentOrders = filteredOrders.slice(0, 10);
	const businessHref = selectedBusiness?.slug ? buildLocalizedPath(`/b/${encodeURIComponent(selectedBusiness.slug)}`, resolvedLocale) : buildLocalizedPath("/member/businesses", resolvedLocale);
	const ordersHref = buildLocalizedPath("/member/orders", resolvedLocale);

	const exportCsv = () => {
		if (typeof window === "undefined" || !filteredOrders.length) return;
		const rows = filteredOrders.map((order) => ({
			order_number: order.order_number,
			date: formatLongDate(getOrderDate(order), resolvedLocale),
			status: order.status,
			payment_status: order.payment_status,
			channel: order.channel,
			subtotal: Number(order.subtotal || 0),
			discount_amount: Number(order.discount_amount || 0),
			tax_amount: Number(order.tax_amount || 0),
			shipping_amount: Number(order.shipping_amount || 0),
			grand_total: Number(order.grand_total || 0),
		}));
		const csv = buildCsv(rows);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `laporan-${selectedBusiness?.slug || "member"}-${period}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	};

	const exportPdf = async () => {
		if (!selectedBusinessID) return;
		setPdfLoading(true);
		setReportsError("");
		try {
			const blob = await memberDownloadBlob(
				`/api/member/businesses/${encodeURIComponent(selectedBusinessID)}/reports/pdf?period=${encodeURIComponent(period)}&locale=${encodeURIComponent(resolvedLocale)}`,
			);
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `laporan-${selectedBusiness?.slug || "member"}-${period}.pdf`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch (error) {
			setReportsError(error instanceof Error ? error.message : t("Gagal mengunduh PDF", "Failed to download PDF"));
		} finally {
			setPdfLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-[28px] border border-[#e6d9c7] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_48%,#eef8f1_100%)] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl space-y-3">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
							<ReceiptText className="h-4 w-4" />
							<span>{t("Laporan operasional toko", "Store operations report")}</span>
						</div>
						<div>
							<h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{t("Pantau performa toko dengan ringkas", "Track store performance at a glance")}</h2>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
								{t(
									"Halaman ini memakai data order yang sudah ada untuk menampilkan ringkasan omzet, order, tren harian, dan produk yang paling banyak terjual.",
									"This page uses existing order data to show revenue summary, order totals, daily trends, and the best-selling products.",
								)}
							</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2 lg:w-[30rem]">
						<a href={ordersHref} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
							<ArrowUpRight className="h-4 w-4" />
							<span>{t("Lihat order", "View orders")}</span>
						</a>
						<a href={businessHref} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
							<Store className="h-4 w-4" />
							<span>{t("Buka toko aktif", "Open active store")}</span>
						</a>
						<button type="button" onClick={() => selectedBusinessID && window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
							<RefreshCw className="h-4 w-4" />
							<span>{t("Muat ulang", "Refresh")}</span>
						</button>
						<button type="button" onClick={exportCsv} disabled={!filteredOrders.length} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
							<Download className="h-4 w-4" />
							<span>{t("Export CSV", "Export CSV")}</span>
						</button>
						<button type="button" onClick={() => void exportPdf()} disabled={!selectedBusinessID || pdfLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
							<Download className="h-4 w-4" />
							<span>{pdfLoading ? t("Membuat PDF...", "Generating PDF...") : t("Export PDF", "Export PDF")}</span>
						</button>
					</div>
				</div>
			</section>

			{(businessesError || reportsError) && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{businessesError || reportsError}</div>}

			<section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
				<div className="rounded-[28px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<h3 className="text-lg font-semibold text-slate-900">{t("Filter laporan", "Report filters")}</h3>
							<p className="mt-1 text-sm text-slate-500">{t("Pilih toko dan periode data yang ingin dilihat.", "Choose the store and period you want to inspect.")}</p>
						</div>
						<div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
							<CalendarDays className="h-4 w-4" />
							<span>{t("Data tersaring", "Filtered data")}: <strong className="text-slate-900">{filteredOrders.length}</strong></span>
						</div>
					</div>

					<div className="mt-5 grid gap-4 xl:grid-cols-3">
						<label className="block text-sm font-medium text-slate-700 xl:col-span-2">
							<span>{t("Pilih toko", "Select store")}</span>
							<select value={selectedBusinessID} onChange={(event) => setSelectedBusinessID(event.target.value)} disabled={businessesLoading || !businesses.length} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50">
								{businesses.length === 0 ? <option value="">{businessesLoading ? t("Memuat toko...", "Loading stores...") : t("Belum ada toko", "No stores yet")}</option> : null}
								{businesses.map((business) => <option key={business.id} value={business.id}>{getBusinessLabel(business, resolvedLocale)}</option>)}
							</select>
						</label>

						<label className="block text-sm font-medium text-slate-700">
							<span>{t("Periode", "Period")}</span>
							<select value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
								{PERIOD_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{resolvedLocale === "en" ? option.labelEn : option.labelId}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>

				<div className="rounded-[28px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<h3 className="text-lg font-semibold text-slate-900">{t("Ringkasan cepat", "Quick summary")}</h3>
					<p className="mt-1 text-sm text-slate-500">{t("Angka inti dari data yang sedang difilter.", "Core numbers from the currently filtered data.")}</p>
					<div className="mt-4 space-y-3 text-sm text-slate-600">
						<div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
							<span>{t("Omzet", "Revenue")}</span>
							<strong className="text-slate-900">{reportsLoading ? "..." : formatCurrency(summary.grossRevenue)}</strong>
						</div>
						<div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
							<span>{t("Order selesai", "Completed orders")}</span>
							<strong className="text-slate-900">{summary.paidOrders}</strong>
						</div>
						<div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
							<span>{t("Menunggu tindak lanjut", "Needs follow-up")}</span>
							<strong className="text-slate-900">{summary.pendingOrders}</strong>
						</div>
						<div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
							<span>{t("Order bermasalah", "Problem orders")}</span>
							<strong className="text-slate-900">{summary.cancelledOrders}</strong>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Total order", "Total orders")}</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{reportsLoading ? "..." : summary.totalOrders}</p>
							<p className="mt-1 text-sm text-slate-500">{t("Order yang masuk ke periode ini.", "Orders that fall within the selected period.")}</p>
						</div>
						<div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
							<ReceiptText className="h-5 w-5" />
						</div>
					</div>
				</article>

				<article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Omzet", "Revenue")}</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{reportsLoading ? "..." : formatCurrency(summary.grossRevenue)}</p>
							<p className="mt-1 text-sm text-slate-500">{t("Total nilai transaksi bruto.", "Gross transaction value.")}</p>
						</div>
						<div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
							<CircleDollarSign className="h-5 w-5" />
						</div>
					</div>
				</article>

				<article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("AOV", "Average order value")}</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{reportsLoading ? "..." : formatCurrency(summary.averageOrderValue)}</p>
							<p className="mt-1 text-sm text-slate-500">{t("Rata-rata nilai per order.", "Average value per order.")}</p>
						</div>
						<div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
							<TrendingUp className="h-5 w-5" />
						</div>
					</div>
				</article>

				<article className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("Toko terpilih", "Selected store")}</p>
							<p className="mt-2 text-3xl font-semibold text-slate-900">{businessesLoading ? "..." : businesses.length}</p>
							<p className="mt-1 text-sm text-slate-500">{selectedBusiness ? selectedBusiness.name : t("Belum ada toko aktif.", "No active store yet.")}</p>
						</div>
						<div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
							<Store className="h-5 w-5" />
						</div>
					</div>
				</article>
			</section>

			<section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
				<div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
					<div className="border-b border-[#f0e6d6] px-5 py-5">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h3 className="text-lg font-semibold text-slate-900">{t("Tren omzet harian", "Daily revenue trend")}</h3>
								<p className="mt-1 text-sm text-slate-500">{t("Grafik sederhana dari data order yang sedang difilter.", "A simple chart from the currently filtered orders.")}</p>
							</div>
							<p className="text-sm text-slate-600">{t("Periode", "Period")} <span className="font-semibold text-slate-900">{resolvedLocale === "en" ? PERIOD_OPTIONS.find((option) => option.value === period)?.labelEn : PERIOD_OPTIONS.find((option) => option.value === period)?.labelId}</span></p>
						</div>
					</div>
					<div className="p-5">
						{reportsLoading ? (
							<div className="grid h-72 place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
								{t("Memuat laporan...", "Loading report...")}
							</div>
						) : trend.every((item) => item.amount === 0) ? (
							<div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
								{t("Belum ada omzet pada periode ini.", "No revenue data in this period yet.")}
							</div>
						) : (
							<div className="flex items-end gap-2 overflow-x-auto rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-6">
								{trend.map((item) => {
									const height = Math.max(8, Math.round((item.amount / maxTrendAmount) * 180));
									return (
										<div key={item.key} className="flex min-w-[3.5rem] flex-col items-center gap-2">
											<div className="flex h-48 w-full items-end justify-center rounded-2xl bg-slate-100 px-2 py-2">
												<div className="w-full rounded-2xl bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-sm" style={{ height }} />
											</div>
											<p className="text-[11px] font-medium text-slate-500">{item.label}</p>
											<p className="text-xs font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
					<div className="border-b border-[#f0e6d6] px-5 py-5">
						<h3 className="text-lg font-semibold text-slate-900">{t("Produk terlaris", "Best-selling products")}</h3>
						<p className="mt-1 text-sm text-slate-500">{t("Agregasi sederhana dari item di order yang sedang difilter.", "Simple aggregation from items in the filtered orders.")}</p>
					</div>
					<div className="space-y-3 px-5 py-5">
						{topProducts.length > 0 ? (
							topProducts.map((product, index) => (
								<div key={`${product.name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-start gap-3">
											<div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
												<Package className="h-4 w-4" />
											</div>
											<div>
												<p className="font-medium text-slate-900">{product.name}</p>
												<p className="mt-1 text-sm text-slate-500">{product.qty} {t("item terjual", "items sold")}</p>
											</div>
										</div>
										<p className="text-sm font-semibold text-slate-900">{formatCurrency(product.revenue)}</p>
									</div>
								</div>
							))
						) : (
							<div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
								{t("Belum ada item yang bisa dihitung.", "No items are available to aggregate yet.")}
							</div>
						)}
					</div>
				</div>
			</section>

			<section className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white/90 shadow-sm">
				<div className="border-b border-[#f0e6d6] px-5 py-5">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h3 className="text-lg font-semibold text-slate-900">{t("Order terbaru", "Recent orders")}</h3>
							<p className="mt-1 text-sm text-slate-500">{t("Baris data yang dipakai untuk laporan saat ini.", "Rows used by the current report.")}</p>
						</div>
						<div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
							{t("Snapshot nilai order", "Order snapshot value")}: <span className="font-semibold text-slate-900">{formatCurrency(filteredOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0))}</span>
						</div>
					</div>
				</div>

				<div className="p-5">
					{reportsLoading ? (
						<div className="space-y-3">
							{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-dashed border-slate-200 bg-slate-50" />)}
						</div>
					) : recentOrders.length > 0 ? (
						<div className="space-y-3">
							{recentOrders.map((order) => (
								<article key={order.id} className="rounded-2xl border border-[#ece3d5] bg-[#fcfbf8] px-4 py-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<p className="text-base font-semibold text-slate-900">{order.order_number}</p>
												{order.order_items?.length ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">{order.order_items.length} {t("item", "items")}</span> : null}
											</div>
											<p className="text-sm text-slate-500">{formatLongDate(getOrderDate(order), resolvedLocale)} · {order.channel || "-"}</p>
											<p className="text-sm text-slate-600">{t("Status", "Status")}: <span className="font-medium text-slate-800">{order.status}</span> · {t("Pembayaran", "Payment")}: <span className="font-medium text-slate-800">{order.payment_status}</span></p>
										</div>
										<div className="text-right">
											<p className="text-base font-semibold text-slate-900">{formatCurrency(Number(order.grand_total || 0))}</p>
											<p className="mt-2 text-xs text-slate-500">{t("Subtotal", "Subtotal")}: {formatCurrency(Number(order.subtotal || 0))}</p>
										</div>
									</div>
								</article>
							))}
						</div>
					) : (
						<div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
							<p className="text-base font-semibold text-slate-900">{selectedBusiness ? t("Belum ada order pada periode ini.", "There are no orders in this period yet.") : t("Pilih toko untuk melihat laporan.", "Pick a store to view the report.")}</p>
							<p className="mt-2 text-sm text-slate-500">{t("Data akan muncul setelah order masuk ke toko yang dipilih.", "Data will appear once orders come in for the selected store.")}</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}