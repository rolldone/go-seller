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
  locale?: string;
  loading?: boolean;
  statusMessage?: string;
}

const STORE_PER_PAGE = 3;

export default function ProductsStoreFilterSection({
  stores,
  page,
  onPageChange,
  activeStoreIDs,
  onStoreSelect,
  locale,
  loading = false,
  statusMessage,
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

      {statusMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {statusMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`store-skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-5 w-3/4 rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full rounded bg-slate-100" />
              <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
              <div className="mt-6 h-8 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {!loading
          ? visibleStores.map((store) => (
              <ProductsStoreCard
                key={store.id}
                store={store}
                active={activeStoreIDs.includes(store.id)}
                onSelect={onStoreSelect}
                locale={locale}
              />
            ))
          : null}
      </div>

      <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-200 pb-5 text-sm text-slate-500 md:flex-row md:items-center">
        <p>List Ver Scanda</p>
        <ProductsPagination page={safePage} totalPages={totalPages} onPageChange={onPageChange} className="mt-0" />
      </div>
    </section>
  );
}
