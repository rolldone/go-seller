import { Ellipsis } from "lucide-react";
import type { HomeProductItem } from "./types";

interface HomeProductCardProps {
  product: HomeProductItem;
  compactTitle?: boolean;
}

export default function HomeProductCard({ product, compactTitle = false }: HomeProductCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`relative h-36 bg-gradient-to-br ${product.tone}`}>
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {product.badge}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className={`${compactTitle ? "text-base" : "text-lg"} font-semibold text-slate-900`}>{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xl font-bold text-emerald-700">{product.price}</p>
          <button type="button" className="text-slate-400 transition hover:text-slate-700" aria-label="More options">
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
