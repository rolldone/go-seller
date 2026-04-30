import React, { useEffect, useState } from "react";

import MemberModal from "../../ui/MemberModal";
import { BANK_OPTIONS, type Business } from "./types";

type Props = {
  open: boolean;
  businesses: Business[];
  defaultBusinessID: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { businessID: string; bank: string; accountNumber: string; ownerName: string }) => Promise<void> | void;
};

export default function AddBankAccountModal({ open, businesses, defaultBusinessID, submitting, onClose, onSubmit }: Props) {
  const [businessID, setBusinessID] = useState("");
  const [bank, setBank] = useState(BANK_OPTIONS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    if (!open) return;
    setBusinessID(defaultBusinessID || businesses[0]?.id || "");
    setBank(BANK_OPTIONS[0]);
    setAccountNumber("");
    setOwnerName("");
  }, [open, defaultBusinessID, businesses]);

  const handleSubmit = async () => {
    if (!businessID || !accountNumber.trim() || !ownerName.trim()) return;
    await onSubmit({
      businessID,
      bank,
      accountNumber: accountNumber.trim(),
      ownerName: ownerName.trim(),
    });
  };

  return (
    <MemberModal
      open={open}
      onClose={onClose}
      title="Tambah Rekening"
      maxWidth="xl"
      footer={(
        <>
          <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => void handleSubmit()}
            disabled={submitting || !businessID || !accountNumber.trim() || !ownerName.trim()}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toko / Business</label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={businessID}
            onChange={(event) => setBusinessID(event.target.value)}
          >
            <option value="">Pilih toko</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>{business.name || business.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank</label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={bank}
            onChange={(event) => setBank(event.target.value)}
          >
            {BANK_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Rekening</label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Pemilik</label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
          />
        </div>
      </div>
    </MemberModal>
  );
}
