import { useMemo } from "react";
import type { BrowseCategoryItem, BrowseProductItem } from "./types";
import ProductsPagination from "./ProductsPagination";
import ProductsProductCard from "./ProductsProductCard";

interface ProductsCatalogSectionProps {
  products: BrowseProductItem[];
  selectedCategory: string;
  onSelectedCategoryChange: (value: string) => void;
  selectedPrice: string;
  onSelectedPriceChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  categories: BrowseCategoryItem[];
  sortOptions: string[];
  page: number;
  onPageChange: (page: number) => void;
  searchRelevanceByProductID?: Record<string, number>;
  loading?: boolean;
  statusMessage?: string;
}

const PRODUCT_PER_PAGE = 12;

function inPriceRange(price: number, selectedPrice: string): boolean {
  if (selectedPrice === "all") return true;
  if (selectedPrice === "lt100") return price < 100000;
  if (selectedPrice === "100-200") return price >= 100000 && price <= 200000;
  if (selectedPrice === "gt200") return price > 200000;
  return true;
}

export default function ProductsCatalogSection({
  products,
  selectedCategory,
  onSelectedCategoryChange,
  selectedPrice,
  onSelectedPriceChange,
  sortBy,
  onSortByChange,
  categories,
  sortOptions,
  page,
  onPageChange,
  searchRelevanceByProductID = {},
  loading = false,
  statusMessage,
}: ProductsCatalogSectionProps) {
  const filteredProducts = useMemo(() => {
    const base = products.filter((item) => {
      const byCategory = selectedCategory === "all" ? true : item.category === selectedCategory;
      const byPrice = inPriceRange(item.price, selectedPrice);
      return byCategory && byPrice;
    });

    return [...base].sort((left, right) => {
      const leftRelevance = searchRelevanceByProductID[left.id] || 0;
      const rightRelevance = searchRelevanceByProductID[right.id] || 0;
      if (leftRelevance !== rightRelevance) {
        return rightRelevance - leftRelevance;
      }

      if (sortBy === "Harga Terendah") return left.price - right.price;
      if (sortBy === "Harga Tertinggi") return right.price - left.price;
      if (sortBy === "Terlaris") return left.name.localeCompare(right.name);
      return right.id.localeCompare(left.id);
    });
  }, [products, searchRelevanceByProductID, selectedCategory, selectedPrice, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const pagedProducts = useMemo(() => {
    const start = (safePage - 1) * PRODUCT_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCT_PER_PAGE);
  }, [filteredProducts, safePage]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-5xl font-extrabold tracking-tight text-slate-900">Semua Produk</h2>
          <p className="mt-1 text-base text-slate-500">Pilihan terbaik dari berbagai toko</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <select
            value={selectedCategory}
            onChange={(event) => onSelectedCategoryChange(event.target.value)}
            className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>

          <select
            className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
            value={selectedPrice}
            onChange={(event) => onSelectedPriceChange(event.target.value)}
          >
            <option value="all">Harga</option>
            <option value="lt100">Di bawah Rp100.000</option>
            <option value="100-200">Rp100.000 - Rp200.000</option>
            <option value="gt200">Di atas Rp200.000</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
            className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {statusMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`product-skeleton-${index}`} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-40 bg-slate-200" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-4/5 rounded bg-slate-200" />
                <div className="h-5 w-1/3 rounded bg-slate-100" />
                <div className="h-3 w-2/5 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!loading
          ? pagedProducts.map((product) => (
              <ProductsProductCard key={product.id} product={product} />
            ))
          : null}
      </div>

      <ProductsPagination page={safePage} totalPages={totalPages} onPageChange={onPageChange} />
    </section>
  );
}
