import { Search } from "lucide-react";
import ProductsFloatingCategoryMenu from "./ProductsFloatingCategoryMenu";
import type { PublicCategory } from "./api";

interface ProductsHeroSearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  categories: PublicCategory[];
  selectedCategoryID: string;
  onSelectedCategoryChange: (value: string) => void;
  isSearching?: boolean;
}

export default function ProductsHeroSearchSection({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  categories,
  selectedCategoryID,
  onSelectedCategoryChange,
  isSearching = false,
}: ProductsHeroSearchSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">Jelajahi Toko</h1>
        <p className="mt-2 text-base text-slate-500">Temukan toko terbaik dari berbagai kategori.</p>
      </div>

      <form
        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 md:flex-row md:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <ProductsFloatingCategoryMenu
          categories={categories}
          selectedCategoryID={selectedCategoryID}
          onSelectedCategoryChange={onSelectedCategoryChange}
        />

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
          type="submit"
          disabled={isSearching}
          className="h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSearching ? "Mencari..." : "Cari"}
        </button>
      </form>
    </section>
  );
}
