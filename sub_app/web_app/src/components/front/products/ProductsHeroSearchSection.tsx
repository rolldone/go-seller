import { Search } from "lucide-react";
import type { BrowseCategoryItem } from "./types";

interface ProductsHeroSearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  categories: BrowseCategoryItem[];
  sortOptions: string[];
}

export default function ProductsHeroSearchSection({
  searchQuery,
  onSearchQueryChange,
  category,
  onCategoryChange,
  sortBy,
  onSortByChange,
  categories,
  sortOptions,
}: ProductsHeroSearchSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">Jelajahi Toko</h1>
        <p className="mt-2 text-base text-slate-500">Temukan toko terbaik dari berbagai kategori.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 md:flex-row md:items-center">
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="h-11 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
          aria-label="Pilih kategori"
        >
          {categories.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value)}
          className="h-11 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
          aria-label="Urutkan produk"
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Cari toko / produk..."
            className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
          />
        </div>

        <button
          type="button"
          className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Cari
        </button>
      </div>
    </section>
  );
}
