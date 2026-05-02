import { useEffect, useState } from "react";
import { notifyError } from "../../../lib/notification";
import { memberGet } from "../businesses/api";
import type { Business, BusinessListResponse } from "../businesses/types";
import NotificationGroupManager from "./NotificationGroupManager";

export default function NotificationGroupsPage() {
	const [businesses, setBusinesses] = useState<Business[]>([]);
	const [selectedBusinessID, setSelectedBusinessID] = useState("");
	const [loadingBusinesses, setLoadingBusinesses] = useState(true);

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
		return <div className="flex items-center justify-center py-20 text-gray-400">Memuat...</div>;
	}

	if (businesses.length === 0) {
		return <div className="text-center py-20 text-gray-400">Tidak ada bisnis ditemukan.</div>;
	}

	return (
		<div className="space-y-4">
			{businesses.length > 1 && (
				<div className="flex items-center gap-2">
					<label className="text-sm font-medium text-gray-700">Toko:</label>
					<select
						value={selectedBusinessID}
						onChange={(e) => setSelectedBusinessID(e.target.value)}
						className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{businesses.map((b) => (
							<option key={b.id} value={b.id}>
								{b.name}
							</option>
						))}
					</select>
				</div>
			)}

			{selectedBusinessID && <NotificationGroupManager businessID={selectedBusinessID} />}
		</div>
	);
}
