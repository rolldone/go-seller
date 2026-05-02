import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import NotificationGroupManager from "./NotificationGroupManager";

export default function NotificationGroupsPage() {
	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);
	const selectedBusiness = businesses.find((business) => business.id === selectedBusinessID) || businesses[0] || null;

	useEffect(() => {
		memberGet<BusinessListResponse>("/api/member/businesses")
			.then((res) => {
				const list = Array.isArray(res) ? res : res.data ?? [];
				setBusinesses(list);
				if (list.length > 0) setSelectedBusinessID(list[0].id);
			})
			.catch((err) => notifyError(err?.message || "Gagal memuat bisnis"))
			.finally(() => setLoadingBusinesses(false));
	}, []);

	if (loadingBusinesses) {
		return <div className="flex items-center justify-center py-20 text-slate-400">Memuat...</div>;
	}

	if (businesses.length === 0) {
		return <div className="py-20 text-center text-slate-400">Tidak ada bisnis ditemukan.</div>;
	}

	return (
		<div className="space-y-5">
			<section className="overflow-hidden rounded-[28px] border border-[#e6d9c7] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_56%,#eef8f1_100%)] p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl space-y-2">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
							<span>Grup Notifikasi</span>
						</div>
						<div>
							<h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Atur penerima notifikasi per toko</h2>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
								Pilih toko yang ingin diatur, lalu kelola grup penerima untuk order, pembayaran, dan penarikan dana dengan tampilan yang selaras dengan halaman member lain.
							</p>
						</div>
					</div>
					{businesses.length > 1 ? (
						<div className="min-w-[260px] rounded-[24px] border border-[#eadfce] bg-white/90 p-4 shadow-sm">
							<label className="mb-2 block text-sm font-medium text-slate-700">Toko</label>
							<select
								value={selectedBusinessID}
								onChange={(e) => setSelectedBusinessID(e.target.value)}
								className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
							>
								{businesses.map((b) => (
									<option key={b.id} value={b.id}>
										{b.name}
									</option>
								))}
							</select>
						</div>
					) : selectedBusiness ? (
						<div className="rounded-[24px] border border-[#eadfce] bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm">
							Toko aktif: <span className="font-semibold text-slate-900">{selectedBusiness.name}</span>
						</div>
					) : null}
				</div>
			</section>

			{selectedBusinessID && <NotificationGroupManager businessID={selectedBusinessID} />}
		</div>
	);
}
