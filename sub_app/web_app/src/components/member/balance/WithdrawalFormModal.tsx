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
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
			<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
				<div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
					<h2 className="text-lg font-semibold text-gray-900">Tarik Dana</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 text-xl leading-none"
					>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
					{/* Balance info */}
					<div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
						<span className="text-blue-600 font-medium">Saldo tersedia: </span>
						<span className="text-blue-800 font-bold">{formatCents(availableBalance)}</span>
					</div>

					{/* Amount */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Jumlah Penarikan (Rp) <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							inputMode="numeric"
							value={amountRaw}
							onChange={(e) => handleAmountInput(e.target.value)}
							placeholder="Contoh: 500000"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Nama Bank <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={bankName}
							onChange={(e) => setBankName(e.target.value)}
							placeholder="Contoh: BCA, Mandiri, BNI"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{/* Account Number */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Nomor Rekening <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							inputMode="numeric"
							value={bankAccountNumber}
							onChange={(e) => setBankAccountNumber(e.target.value)}
							placeholder="Contoh: 1234567890"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{/* Account Name */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Atas Nama Rekening <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={bankAccountName}
							onChange={(e) => setBankAccountName(e.target.value)}
							placeholder="Nama sesuai rekening bank"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{/* Notes */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Catatan (opsional)
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
							placeholder="Tambahkan catatan jika diperlukan"
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
						/>
					</div>

					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={!isValid || loading}
							className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? "Memproses..." : "Ajukan Penarikan"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
