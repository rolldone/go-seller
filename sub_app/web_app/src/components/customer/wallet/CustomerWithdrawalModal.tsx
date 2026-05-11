import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";

import { createMyCustomerWithdrawal } from "../auth/authApi";
import { notifyError } from "../../../lib/notification";

function formatCents(cents: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		minimumFractionDigits: 0,
	}).format(cents / 100);
}

interface Props {
	open: boolean;
	availableBalance: number;
	onClose: () => void;
	onSuccess: () => void;
}

export default function CustomerWithdrawalModal({ open, availableBalance, onClose, onSuccess }: Props) {
	const [amountRaw, setAmountRaw] = useState("");
	const [bankName, setBankName] = useState("");
	const [bankAccountNumber, setBankAccountNumber] = useState("");
	const [bankAccountName, setBankAccountName] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setAmountRaw("");
		setBankName("");
		setBankAccountNumber("");
		setBankAccountName("");
		setNotes("");
		setLoading(false);
	}, [open]);

	if (!open) return null;

	const amountCents = Number(amountRaw || "0") * 100;
	const isValid =
		amountCents > 0 &&
		amountCents <= availableBalance &&
		bankName.trim() !== "" &&
		bankAccountNumber.trim() !== "" &&
		bankAccountName.trim() !== "";

	const submitWithdrawal = async () => {
		if (!isValid) return;
		setLoading(true);
		try {
			await createMyCustomerWithdrawal({
				amount: amountCents,
				bank_name: bankName.trim(),
				bank_account_number: bankAccountNumber.trim(),
				bank_account_name: bankAccountName.trim(),
				notes: notes.trim() || undefined,
			});
			onSuccess();
		} catch (err) {
			notifyError(err instanceof Error ? err.message : "Gagal membuat permintaan penarikan");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
			<div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_100px_-40px_rgba(15,23,42,0.55)]">
				<div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Wallet Cash</p>
						<h2 className="mt-1 text-lg font-semibold text-slate-900">Tarik Dana Manual</h2>
					</div>
					<button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
						×
					</button>
				</div>

				<div className="space-y-4 px-6 py-5">
					<div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
						<p className="font-semibold">Saldo tersedia: {formatCents(availableBalance)}</p>
						<p className="mt-1 text-xs text-emerald-800">Penarikan diproses manual. Saldo promo atau credit campaign tidak bisa ditarik.</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nominal penarikan</span>
							<NumericFormat
								value={amountRaw}
								valueIsNumericString
								onValueChange={(values) => setAmountRaw(values.value)}
								thousandSeparator="."
								decimalScale={0}
								allowNegative={false}
								inputMode="numeric"
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
								placeholder="0"
							/>
							<p className="text-xs text-slate-500">Maksimum {formatCents(availableBalance)}</p>
						</label>

						<label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nama bank</span>
							<input
								value={bankName}
								onChange={(event) => setBankName(event.target.value)}
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
								placeholder="Contoh: BCA"
							/>
						</label>

						<label className="space-y-1 text-sm text-slate-700">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor rekening</span>
							<input
								value={bankAccountNumber}
								onChange={(event) => setBankAccountNumber(event.target.value)}
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
								placeholder="1234567890"
							/>
						</label>

						<label className="space-y-1 text-sm text-slate-700">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nama pemilik rekening</span>
							<input
								value={bankAccountName}
								onChange={(event) => setBankAccountName(event.target.value)}
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
								placeholder="Nama sesuai rekening"
							/>
						</label>

						<label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
							<span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan tambahan</span>
							<textarea
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								rows={4}
								className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
								placeholder="Opsional"
							/>
						</label>
					</div>
				</div>

				<div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
					<button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
						Batal
					</button>
					<button
						type="button"
						onClick={() => void submitWithdrawal()}
						disabled={!isValid || loading}
						className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? "Memproses..." : "Kirim Permintaan"}
					</button>
				</div>
			</div>
		</div>
	);
}