import React from "react";

type Props = {
  selectedBusinessName: string;
  accountCount: number;
};

export default function PayoutsHeader({ selectedBusinessName, accountCount }: Props) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#e6d9c7] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_48%,#eef8f1_100%)] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            <span>Finance</span>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Penarikan Dana</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Kelola rekening payout dan tarik saldo per toko dengan alur yang lebih rapi.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[30rem]">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toko aktif</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedBusinessName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rekening terdaftar</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{accountCount}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
