/** @jsxRuntime classic */
import React from "react";
import { Search } from "lucide-react";
import type { PublicBusinessProduct } from "../types";
import { buildLocalizedPath } from "../../../../lib/siteLocale";
import { useTranslations } from "../../../../i18n";
import { formatAmount } from "../../../../lib/amountFormat";

interface BusinessProductTabProps {
  businessSlug: string;
  locale?: string;
  businessName: string;
  categories: string[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredProducts: PublicBusinessProduct[];
  loading?: boolean;
  error?: string | null;
}

export default function BusinessProductTab({
  businessSlug,
  locale,
  businessName,
  categories,
  searchQuery,
  onSearchQueryChange,
  filteredProducts,
  loading,
  error,
}: BusinessProductTabProps) {
  const t = useTranslations("business", locale);

  const formatPrice = (p?: number | string | null) => {
    if (p === null || p === undefined) return "-";
    if (typeof p === "number") return formatAmount(p, { fractionDigits: 0 });
    // try parse numeric string
    const cleaned = String(p).replace(/[^0-9.-]+/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? formatAmount(n, { fractionDigits: 0 }) : String(p);
  };

  const renderSkeletonGrid = () => (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="mb-2 h-0 aspect-square w-full rounded-xl bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
  const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="24">No image</text></svg>';

  const resolvePublicURL = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith("/")) {
      const apiBase = import.meta.env.PUBLIC_API_URL
        ? String(import.meta.env.PUBLIC_API_URL).replace(/\/$/, "")
        : "";
      return apiBase ? `${apiBase}${url}` : url;
    }
    return url;
  };

  const buildProductHref = (productSlug: string) => {
    const path = `/b/${businessSlug}/p/${productSlug}`;
    return buildLocalizedPath(path, locale);
  };
  return (
    <div className="mt-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex gap-2 text-xs text-slate-500">
          <span>{t("officialStore", "Official Store")}</span> <span>›</span> <span>{t("brand", "Brand")}</span> <span>›</span> <span>{businessName}</span> <span>›</span> <span className="font-semibold text-slate-900">{t("products", "Produk")}</span>
        </div>

        <div className="relative w-full md:max-w-[320px]">
          <input
            type="text"
            placeholder={t("searchPlaceholder", "Cari produk di toko ini...")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm outline-none ring-emerald-500 focus:ring-1"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[240px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-4 text-sm font-bold text-slate-900">{t("allProducts", "Etalase Toko")} ({categories.length})</h3>
            <ul className="space-y-1">
              <li className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-emerald-600">
                {t("allProducts", "Semua Produk")}
              </li>
              <li className="cursor-pointer px-3 py-2 text-sm text-slate-600 hover:text-emerald-600">
                {t("soldProducts", "Produk Terjual")}
              </li>
              <li className="cursor-pointer px-3 py-2 text-sm text-slate-600 hover:text-emerald-600">
                {t("specialDiscount", "Spesial Diskon")}
              </li>
              {categories.map((cat) => (
                <li key={cat} className="cursor-pointer px-3 py-2 text-sm text-slate-600 hover:text-emerald-600">
                  {cat}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {searchQuery ? `${t("searchResults", "Hasil pencarian")} : "${searchQuery}"` : t("allProducts", "Semua Produk")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{t("sort", "Urutkan")}</span>
              <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium outline-none ring-emerald-500 focus:ring-1">
                <option>{t("latest", "Terbaru")}</option>
                <option>{t("highestPrice", "Harga Tertinggi")}</option>
                <option>{t("lowestPrice", "Harga Terendah")}</option>
                <option>{t("mostPopular", "Paling Populer")}</option>
              </select>
            </div>
          </div>

          {loading ? (
            renderSkeletonGrid()
          ) : error ? (
            <div className="mt-20 flex flex-col items-center justify-center text-center text-rose-600">
              <p className="mb-3">{t("failedLoadProducts", "Gagal memuat produk:")} {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {t("reload", "Muat Ulang")}
              </button>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {filteredProducts.map((product) => {
                const original = product.original_price ?? (product.price ? Number(String(product.price).replace(/[^0-9.-]+/g, "")) : undefined);
                const discounted = product.discounted_price ?? undefined;
                const hasDiscount = typeof original === "number" && typeof discounted === "number" && discounted < original;
                const percentSave = hasDiscount && original ? Math.round((1 - (discounted as number) / original) * 100) : null;
                const badge = product.discount_badge ?? (percentSave ? `-${percentSave}%` : undefined);

                // pick hero image from gallery: is_main first, else first
                const heroAsset = product.gallery?.find((g) => g.is_main) ?? product.gallery?.[0];
                const heroUrl = resolvePublicURL(heroAsset?.public_url ?? heroAsset?.file_path ?? null) || PLACEHOLDER;

                return (
                  <a
                    key={product.id}
                    href={buildProductHref(product.slug)}
                    className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-500 hover:shadow-md"
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <img
                        src={heroUrl}
                        alt={product.title}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.src !== PLACEHOLDER) img.src = PLACEHOLDER;
                        }}
                        className="h-full w-full object-cover"
                      />
                      {badge && (
                        <div className="absolute left-0 top-2 rounded-r-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {badge}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 min-h-[40px] text-sm font-medium text-slate-800 group-hover:text-emerald-600">
                        {product.title}
                      </h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-base font-bold ${hasDiscount ? "text-rose-500" : "text-slate-800"}`}>
                          {formatPrice(hasDiscount ? discounted : original ?? product.price)}
                        </span>
                        {hasDiscount && original && (
                          <span className="text-sm text-slate-400 line-through">{formatPrice(original)}</span>
                        )}
                      </div>
                      {hasDiscount && percentSave !== null && (
                        <div className="mt-1 text-[12px] font-semibold text-emerald-600">{t("savePercent", "Hemat")} {percentSave}%</div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="mt-20 flex flex-col items-center justify-center text-center">
              <Search className="mb-4 h-10 w-10 text-slate-400" aria-hidden="true" />
              <p className="text-slate-500">{t("noResults", "Produk tidak ditemukan.")} {searchQuery ? `"${searchQuery}"` : ""}</p>
              <button
                onClick={() => onSearchQueryChange("")}
                className="mt-4 text-sm font-bold text-emerald-600 hover:underline"
              >
                {t("clearSearch", "Hapus Pencarian")}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
