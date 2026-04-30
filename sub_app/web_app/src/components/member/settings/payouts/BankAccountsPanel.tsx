import React from "react";

import type { Account } from "./types";
import { accountStatusClass, maskAccountNumber } from "./utils";

type Props = {
  accounts: Account[];
  loading: boolean;
  onSetPrimary: (id: string) => void;
  onRequestPayout: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function BankAccountsPanel({ accounts, loading, onSetPrimary, onRequestPayout, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Daftar Rekening</h3>
          <p className="text-xs text-slate-500">Rekening payout untuk toko terpilih.</p>
        </div>
      </div>
      <div className="p-4">
        {loading && accounts.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-dashed border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">Belum ada rekening terdaftar.</p>
            <p className="mt-1 text-sm text-slate-500">Tambahkan rekening pertama untuk mulai request payout.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {account.bank} <span className="text-slate-500">({maskAccountNumber(account.account_number)})</span>
                    </p>
                    <p className="text-sm text-slate-600">{account.owner_name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${accountStatusClass(account.is_verified)}`}>
                      {account.is_verified ? "Verified" : "Pending"}
                    </span>
                    {account.is_primary ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Primary</span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => onSetPrimary(account.id)}
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      onClick={() => onRequestPayout(account.id)}
                    >
                      Request Payout
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      onClick={() => onDelete(account.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
