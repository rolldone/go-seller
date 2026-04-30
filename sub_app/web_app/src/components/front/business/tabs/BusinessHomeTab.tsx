/** @jsxRuntime classic */
import React from "react";
import LargeCardCarousel from "../../LargeCardCarousel";
import type { PublicBusinessCarousel, PublicBusinessProduct } from "../types";
import { buildLocalizedPath } from "../../../../lib/siteLocale";
import { useTranslations } from "../../../../i18n";
import { formatAmount } from "../../../../lib/amountFormat";
import ProductCard from "../../ProductCard";

interface BusinessHomeTabProps {
  businessSlug: string;
  locale?: string;
  carousels: PublicBusinessCarousel[];
  featuredProducts: PublicBusinessProduct[];
  products: PublicBusinessProduct[];
  categories: string[];
}

function buildProductHref(businessSlug: string, productSlug: string, locale?: string) {
  const path = `/b/${businessSlug}/p/${productSlug}`;
  return buildLocalizedPath(path, locale);
}

function resolveProductImage(product: PublicBusinessProduct): string | null {
  const heroAsset = product.gallery?.find((asset) => asset.is_main) ?? product.gallery?.[0];
  return String(heroAsset?.public_url ?? heroAsset?.file_path ?? "").trim() || null;
}

function formatPrice(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "number") {
    return formatAmount(value, { fractionDigits: 0 });
  }

  const normalized = String(value).replace(/[^0-9.-]+/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? formatAmount(numeric, { fractionDigits: 0 }) : String(value);
}

export default function BusinessHomeTab({
  businessSlug,
  locale,
  carousels,
  featuredProducts,
  products,
  categories,
}: BusinessHomeTabProps) {
  const t = useTranslations("business", locale);

  return (
    <>
      {carousels.length > 0 ? (
        <section className="mt-7 space-y-8">
          {carousels.map((carousel) => (
            <div key={carousel.id} className="space-y-4">

              <LargeCardCarousel
                items={carousel.items.map((item) => ({
                  id: item.id,
                  title: item.title,
                  subtitle: item.subtitle || undefined,
                  image: item.image || undefined,
                  href: item.href || undefined,
                }))}
                variant={carousel.layoutType === "medium" ? "medium" : "large"}
                hideArrows={carousel.items.length <= 1}
                className="-mt-2"
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="text-[30px] font-bold tracking-tight text-slate-900">{t("popular", "Populer")}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id} 
              href={buildProductHref(businessSlug, product.slug, locale)}
              title={product.title}
              priceLabel={formatPrice(product.discounted_price ?? product.original_price ?? product.price)}
              originalPriceLabel={product.discounted_price && product.original_price && product.discounted_price < product.original_price ? formatPrice(product.original_price) : null}
              imageUrl={resolveProductImage(product)}
              imageAlt={product.title}
              badgeLabel={product.discount_badge ?? null}
              storeName={businessSlug}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button className="rounded-full border border-slate-300 bg-white px-8 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-600">
            {t("viewAllPopular", "Lihat Semua Populer")}
          </button>
        </div>
      </section>

      {categories.map((catName) => (
        <section key={catName} className="mt-8">
          <h2 className="text-[30px] font-bold tracking-tight text-slate-900">{catName}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {products
              .filter((p) => p.category === catName)
              .slice(0, 6)
              .map((product, idx) => (
                <ProductCard
                  key={`${product.id}-${idx}`}
                  href={buildProductHref(businessSlug, product.slug, locale)}
                  title={product.title}
                  priceLabel={formatPrice(product.discounted_price ?? product.original_price ?? product.price)}
                  originalPriceLabel={product.discounted_price && product.original_price && product.discounted_price < product.original_price ? formatPrice(product.original_price) : null}
                  imageUrl={resolveProductImage(product)}
                  imageAlt={product.title}
                  badgeLabel={product.discount_badge ?? null}
                  storeName={product.category}
                />
              ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button className="rounded-full border border-slate-300 bg-white px-8 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-600">
              {t("viewAllProducts", "Lihat Produk Lainnya")}
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
