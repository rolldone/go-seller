import type { BrowseProductItem } from "./types";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import ProductCard from "../ProductCard";

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
    <ProductCard
      href={productHref}
      title={product.name}
      priceLabel={formatRupiah(product.price)}
      imageUrl={heroImageUrl || null}
      imageAlt={product.name}
      toneClassName={product.tone}
      storeName={product.storeName}
      targetBlank
    />
  );
}
