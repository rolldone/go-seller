import { Check, Leaf } from "lucide-react";
import type { BrowseStoreItem } from "./types";
import { buildLocalizedPath } from "../../../lib/siteLocale";

interface ProductsStoreCardProps {
  store: BrowseStoreItem;
  active: boolean;
  onSelect: (id: string) => void;
  locale?: string;
}

export default function ProductsStoreCard({ store, active, onSelect, locale }: ProductsStoreCardProps) {
  const storeHref = store.slug ? buildLocalizedPath(`/b/${encodeURIComponent(store.slug)}`, locale) : buildLocalizedPath("/products", locale);

  return (
    <div
      role="button"
      aria-pressed={active}
      tabIndex={0}
      onClick={() => onSelect(store.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(store.id);
        }
      }}
      className={[
        "flex h-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer",
        active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className={`h-5 w-5 ${store.accent}`} />
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">{store.name}</h3>
        </div>
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-[5px] border transition",
            active ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent",
          ].join(" ")}
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-slate-500">{store.description}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{store.productCount}+ produk</span>
        <span className="rounded-lg border border-slate-200 px-3 py-1 text-[9px] font-semibold text-slate-400">{store.code}</span>
      </div>
      <a
        href={storeHref}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => event.stopPropagation()}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Lihat Toko
      </a>
    </div>
  );
}
