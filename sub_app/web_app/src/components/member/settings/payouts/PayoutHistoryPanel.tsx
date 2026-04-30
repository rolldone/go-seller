import React from "react";

import type { Payout } from "./types";
import { formatCurrencyIDR, formatDateTimeID, payoutStatusClass } from "./utils";

type Props = {
  payouts: Payout[];
};

export default function PayoutHistoryPanel({ payouts }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Riwayat Penarikan</h3>
      </div>
      <div className="p-4">
        {payouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">Belum ada riwayat payout.</p>
            <p className="mt-1 text-sm text-slate-500">Riwayat akan muncul setelah request pertama dibuat.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout) => (
              <article key={payout.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrencyIDR(payout.amount)}</p>
                    <p className="text-xs text-slate-500">{formatDateTimeID(payout.created_at)}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutStatusClass(payout.status)}`}>
                    {payout.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
