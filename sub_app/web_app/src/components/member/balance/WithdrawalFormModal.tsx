import { useState } from "react";
import { notifyError } from "../../../lib/notification";
import { createWithdrawal } from "./api";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

interface Props {
	businessID: string;
	availableBalance: number; // in cents
	onSuccess: () => void;
	onClose: () => void;
}

export default function WithdrawalFormModal({ businessID, availableBalance, onSuccess, onClose }: Props) {
	const [amountRaw, setAmountRaw] = useState("");
	const [bankName, setBankName] = useState("");
	const [bankAccountNumber, setBankAccountNumber] = useState("");
	const [bankAccountName, setBankAccountName] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);

	// Parse rupiah input to cents
	const amountCents = Math.round(parseFloat(amountRaw.replace(/\D/g, "") || "0") * 100);
	const isValid =
		amountCents > 0 &&
		amountCents <= availableBalance &&
		bankName.trim() &&
		bankAccountNumber.trim() &&
		bankAccountName.trim();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValid) return;

		setLoading(true);
		try {
			await createWithdrawal(businessID, {
				amount: amountCents,
				bank_name: bankName.trim(),
				bank_account_number: bankAccountNumber.trim(),
				bank_account_name: bankAccountName.trim(),
				notes: notes.trim() || undefined,
			});
			onSuccess();
		} catch (err: any) {
			notifyError(err?.message || "Gagal membuat permintaan penarikan");
		} finally {
			setLoading(false);
		}
	};

	const handleAmountInput = (val: string) => {
		// Only allow digits
		const digits = val.replace(/\D/g, "");
		setAmountRaw(digits);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-[28px] border border-[#e6d9c7] bg-white shadow-[0_32px_96px_-48px_rgba(15,23,42,0.45)]">
				<div className="flex items-center justify-between border-b border-[#f0e6d6] px-6 pt-5 pb-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Saldo Toko</p>
						<h2 className="mt-1 text-lg font-semibold text-slate-900">Tarik Dana</h2>
					</div>
					<button onClick={onClose} className="text-xl leading-none text-slate-400 transition hover:text-slate-600">
						×
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
					{/* Balance info */}
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
						<span className="font-medium">Saldo tersedia: </span>
						<span className="font-bold">{formatCents(availableBalance)}</span>
					</div>

					{/* Amount */}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Jumlah Penarikan (Rp) <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							inputMode="numeric"
							value={amountRaw}
							onChange={(e) => handleAmountInput(e.target.value)}
							placeholder="Contoh: 500000"
							className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
						{amountCents > availableBalance && (
							<p className="text-xs text-red-500 mt-1">Melebihi saldo tersedia</p>
						)}
						{amountCents > 0 && amountCents <= availableBalance && (
							<p className="text-xs text-green-600 mt-1">= {formatCents(amountCents)}</p>
						)}
					</div>

					{/* Bank Name */}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Nama Bank <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={bankName}
							onChange={(e) => setBankName(e.target.value)}
							placeholder="Contoh: BCA, Mandiri, BNI"
							className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
					</div>

					{/* Account Number */}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Nomor Rekening <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							inputMode="numeric"
							value={bankAccountNumber}
							onChange={(e) => setBankAccountNumber(e.target.value)}
							placeholder="Contoh: 1234567890"
							className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
					</div>

					{/* Account Name */}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Atas Nama Rekening <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={bankAccountName}
							onChange={(e) => setBankAccountName(e.target.value)}
							placeholder="Nama sesuai rekening bank"
							className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
					</div>

					{/* Notes */}
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Catatan (opsional)
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
							placeholder="Tambahkan catatan jika diperlukan"
							className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
						/>
					</div>

					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#f2ede5]"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={!isValid || loading}
							className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{loading ? "Memproses..." : "Ajukan Penarikan"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
