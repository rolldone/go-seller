import { useMemo } from "react";
import type { BrowseStoreItem } from "./types";
import ProductsPagination from "./ProductsPagination";
import ProductsStoreCard from "./ProductsStoreCard";

interface ProductsStoreFilterSectionProps {
  stores: BrowseStoreItem[];
  page: number;
  onPageChange: (page: number) => void;
  activeStoreIDs: string[];
  onStoreSelect: (id: string) => void;
}

const STORE_PER_PAGE = 3;

export default function ProductsStoreFilterSection({
  stores,
  page,
  onPageChange,
  activeStoreIDs,
  onStoreSelect,
}: ProductsStoreFilterSectionProps) {
  const totalPages = Math.max(1, Math.ceil(stores.length / STORE_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const visibleStores = useMemo(() => {
    const start = (safePage - 1) * STORE_PER_PAGE;
    return stores.slice(start, start + STORE_PER_PAGE);
  }, [safePage, stores]);

  return (
    <section className="space-y-5">
      <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Filter di Toko</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {visibleStores.map((store) => (
          <ProductsStoreCard
            key={store.id}
            store={store}
            active={activeStoreIDs.includes(store.id)}
            onSelect={onStoreSelect}
          />
        ))}
      </div>

      <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-200 pb-5 text-sm text-slate-500 md:flex-row md:items-center">
        <p>List Ver Scanda</p>
        <ProductsPagination page={safePage} totalPages={totalPages} onPageChange={onPageChange} className="mt-0" />
      </div>
    </section>
  );
}
