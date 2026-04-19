import { useMemo, useState } from "react";
import type { CustomerSession } from "../../lib/customerSession";
import HomeNav from "./HomeNav";
import Footer from "./Footer";
import ProductsCatalogSection from "./products/ProductsCatalogSection";
import ProductsHeroSearchSection from "./products/ProductsHeroSearchSection";
import ProductsStoreFilterSection from "./products/ProductsStoreFilterSection";
import { browseCategories, browseProducts, browseSortOptions, browseStores } from "./products/mockData";

interface StoreFrontProductsProps {
  customerSession?: CustomerSession | null;
  locale?: string;
}

export default function StoreFrontProducts({ customerSession = null, locale }: StoreFrontProductsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [heroCategory, setHeroCategory] = useState("all");
  const [heroSort, setHeroSort] = useState("Terbaru");
  const [storePage, setStorePage] = useState(1);
  const [selectedStoreIDs, setSelectedStoreIDs] = useState<string[]>([]);

  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogPrice, setCatalogPrice] = useState("all");
  const [catalogSort, setCatalogSort] = useState("Terbaru");
  const [catalogPage, setCatalogPage] = useState(1);

  const topFilteredStores = useMemo(() => {
    const byHeroCategory = heroCategory === "all"
      ? browseStores
      : browseStores.filter((store) => {
          return browseProducts.some((product) => product.storeId === store.id && product.category === heroCategory);
        });

    if (!searchQuery.trim()) {
      return byHeroCategory;
    }

    const keyword = searchQuery.trim().toLowerCase();
    return byHeroCategory.filter((store) => {
      const storeMatch = store.name.toLowerCase().includes(keyword) || store.description.toLowerCase().includes(keyword);
      const productMatch = browseProducts.some((product) => {
        return product.storeId === store.id && product.name.toLowerCase().includes(keyword);
      });
      return storeMatch || productMatch;
    });
  }, [heroCategory, searchQuery]);

  const topFilteredProducts = useMemo(() => {
    const byCategory = heroCategory === "all"
      ? browseProducts
      : browseProducts.filter((item) => item.category === heroCategory);

    const byStore = selectedStoreIDs.length === 0
      ? byCategory
      : byCategory.filter((item) => selectedStoreIDs.includes(item.storeId));

    if (!searchQuery.trim()) {
      return byStore;
    }

    const keyword = searchQuery.trim().toLowerCase();
    return byStore.filter((item) => item.name.toLowerCase().includes(keyword) || item.storeName.toLowerCase().includes(keyword));
  }, [heroCategory, searchQuery, selectedStoreIDs]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f7f5]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <HomeNav variant="light" customerSession={customerSession} locale={locale} />

        <main className="mt-10 flex-1 space-y-12 pb-8">
          <ProductsHeroSearchSection
            searchQuery={searchQuery}
            onSearchQueryChange={(value) => {
              setSearchQuery(value);
              setCatalogPage(1);
              setStorePage(1);
            }}
            category={heroCategory}
            onCategoryChange={(value) => {
              setHeroCategory(value);
              setCatalogCategory(value);
              setCatalogPage(1);
              setStorePage(1);
            }}
            sortBy={heroSort}
            onSortByChange={setHeroSort}
            categories={browseCategories}
            sortOptions={browseSortOptions}
          />

          <ProductsStoreFilterSection
            stores={topFilteredStores}
            page={storePage}
            onPageChange={setStorePage}
            activeStoreIDs={selectedStoreIDs}
            onStoreSelect={(id) => {
              setSelectedStoreIDs((currentStoreIDs) => (
                currentStoreIDs.includes(id)
                  ? currentStoreIDs.filter((storeID) => storeID !== id)
                  : [...currentStoreIDs, id]
              ));
              setCatalogPage(1);
            }}
          />

          <ProductsCatalogSection
            products={topFilteredProducts}
            selectedCategory={catalogCategory}
            onSelectedCategoryChange={(value) => {
              setCatalogCategory(value);
              setCatalogPage(1);
            }}
            selectedPrice={catalogPrice}
            onSelectedPriceChange={(value) => {
              setCatalogPrice(value);
              setCatalogPage(1);
            }}
            sortBy={catalogSort}
            onSortByChange={(value) => {
              setCatalogSort(value);
              setCatalogPage(1);
            }}
            categories={browseCategories}
            sortOptions={browseSortOptions}
            page={catalogPage}
            onPageChange={setCatalogPage}
          />
        </main>
      </div>

      <Footer />
    </div>
  );
}
