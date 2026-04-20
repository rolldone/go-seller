import type { BrowseProductItem } from "./types";
import { buildLocalizedPath } from "../../../lib/siteLocale";

interface ProductsProductCardProps {
  product: BrowseProductItem;
  locale?: string;
}

function formatRupiah(value: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

export default function ProductsProductCard({ product, locale }: ProductsProductCardProps) {
  const heroAsset = product.gallery?.find((asset) => asset.is_main) ?? product.gallery?.[0];
  const heroImageUrl = String(heroAsset?.public_url || "").trim();
  const productHref = product.slug && product.storeSlug
    ? buildLocalizedPath(`/b/${encodeURIComponent(product.storeSlug)}/p/${encodeURIComponent(product.slug)}`, locale)
    : buildLocalizedPath("/products", locale);

  return (
    <a
      href={productHref}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className={`relative aspect-square overflow-hidden bg-gradient-to-br ${product.tone}`}>
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
      </div>
      <div className="flex flex-1 flex-col space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-slate-900">{product.name}</h3>
        <p className="text-lg font-bold leading-tight text-emerald-700">{formatRupiah(product.price)}</p>
        <p className="mt-auto text-xs text-slate-500">{product.storeName}</p>
      </div>
    </a>
  );
}
