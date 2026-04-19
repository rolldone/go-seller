import type { BrowseProductItem } from "./types";

interface ProductsProductCardProps {
  product: BrowseProductItem;
}

function formatRupiah(value: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

export default function ProductsProductCard({ product }: ProductsProductCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-40 bg-gradient-to-br ${product.tone}`} />
      <div className="flex flex-1 flex-col space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-slate-900">{product.name}</h3>
        <p className="text-lg font-bold leading-tight text-emerald-700">{formatRupiah(product.price)}</p>
        <p className="mt-auto text-xs text-slate-500">{product.storeName}</p>
      </div>
    </article>
  );
}
