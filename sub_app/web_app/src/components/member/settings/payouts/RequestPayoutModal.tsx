import React, { useEffect, useState } from "react";

import MemberModal from "../../ui/MemberModal";
import type { Account } from "./types";
import { maskAccountNumber } from "./utils";

type Props = {
  open: boolean;
  accounts: Account[];
  initialAccountID: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { accountID: string; amount: number }) => Promise<void> | void;
};

export default function RequestPayoutModal({ open, accounts, initialAccountID, submitting, onClose, onSubmit }: Props) {
  const [accountID, setAccountID] = useState("");
  const [amount, setAmount] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    const hasInitial = !!initialAccountID && accounts.some((account) => account.id === initialAccountID);
    setAccountID(hasInitial ? (initialAccountID as string) : (accounts[0]?.id || ""));
    setAmount(0);
  }, [open, initialAccountID, accounts]);

  const handleSubmit = async () => {
    if (!accountID || amount <= 0) return;
    await onSubmit({ accountID, amount });
  };

  return (
    <MemberModal
      open={open}
      onClose={onClose}
      title="Request Payout"
      maxWidth="lg"
      footer={(
        <>
          <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => void handleSubmit()}
            disabled={submitting || !accountID || amount <= 0}
          >
            {submitting ? "Processing..." : "Request"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pilih Rekening</label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={accountID}
            onChange={(event) => setAccountID(event.target.value)}
          >
            <option value="">Pilih rekening</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank} ({maskAccountNumber(account.account_number)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah</label>
          <input
            type="number"
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800"
            value={amount || ""}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </div>
      </div>
    </MemberModal>
  );
}
