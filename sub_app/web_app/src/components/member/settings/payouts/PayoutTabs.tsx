import React from "react";

import type { PayoutTab } from "./types";

type Props = {
  value: PayoutTab;
  onChange: (next: PayoutTab) => void;
};

const tabs: Array<{ id: PayoutTab; label: string }> = [
  { id: "accounts", label: "Rekening" },
  { id: "history", label: "Riwayat" },
];

export default function PayoutTabs({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              active ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
