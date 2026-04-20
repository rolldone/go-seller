import { useEffect, useMemo, useState } from "react";
import type { CustomerSession } from "../../lib/customerSession";
import HomeNav from "./HomeNav";
import Footer from "./Footer";
import ProductsCatalogSection from "./products/ProductsCatalogSection";
import ProductsHeroSearchSection from "./products/ProductsHeroSearchSection";
import ProductsStoreFilterSection from "./products/ProductsStoreFilterSection";
import type { BrowseCategoryItem } from "./products/types";
import { buildBrowseData, fetchPublicBusinesses, fetchPublicProducts, type PublicBusiness, type PublicProduct } from "./products/api";

const browseSortOptions = ["Terbaru", "Terlaris", "Harga Terendah", "Harga Tertinggi"];
const PRODUCT_TYPE_LABEL: Record<string, string> = {
  product: "Produk",
  service: "Jasa",
  digital: "Digital",
};

interface StoreFrontProductsProps {
  customerSession?: CustomerSession | null;
  locale?: string;
}

export default function StoreFrontProducts({ customerSession = null, locale }: StoreFrontProductsProps) {
  const [businessesData, setBusinessesData] = useState<PublicBusiness[]>([]);
  const [productsData, setProductsData] = useState<PublicProduct[]>([]);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [heroCategory, setHeroCategory] = useState("all");
  const [heroSort, setHeroSort] = useState("Terbaru");
  const [storePage, setStorePage] = useState(1);
  const [selectedStoreIDs, setSelectedStoreIDs] = useState<string[]>([]);

  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogPrice, setCatalogPrice] = useState("all");
  const [catalogSort, setCatalogSort] = useState("Terbaru");
  const [catalogPage, setCatalogPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadBusinesses() {
      setBusinessesLoaded(false);
      setProductsLoaded(false);
      setLoadError("");

      try {
        const businesses = await fetchPublicBusinesses();
        if (cancelled) return;
        setBusinessesData(businesses);
        setBusinessesLoaded(true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message || "Gagal memuat data toko");
        setBusinessesData([]);
        setBusinessesLoaded(true);
      }
    }

    void loadBusinesses();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!businessesLoaded) {
      return;
    }

    let cancelled = false;

    async function loadProducts() {
      setLoadError("");
      try {
        const products = await fetchPublicProducts(locale);
        if (cancelled) return;
        setProductsData(products);
        setProductsLoaded(true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message || "Gagal memuat data produk");
        setProductsLoaded(true);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [businessesLoaded, locale, selectedStoreIDs]);

  const browseData = useMemo(() => buildBrowseData(productsData, businessesData), [businessesData, productsData]);
  const { products: browseProducts, stores: browseStores } = browseData;

  const browseCategories = useMemo<BrowseCategoryItem[]>(() => {
    const seen = new Set<string>();
    const dynamic = browseProducts
      .map((product) => product.category)
      .filter((categoryID) => {
        if (!categoryID || seen.has(categoryID)) return false;
        seen.add(categoryID);
        return true;
      })
      .map((categoryID) => ({
        id: categoryID,
        label: PRODUCT_TYPE_LABEL[categoryID] || categoryID,
      }));

    return [{ id: "all", label: "Semua Kategori" }, ...dynamic];
  }, [browseProducts]);

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
  }, [browseProducts, browseStores, heroCategory, searchQuery]);

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
  }, [browseProducts, heroCategory, searchQuery, selectedStoreIDs]);

  const isLoading = !businessesLoaded || !productsLoaded;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f7f5]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <HomeNav variant="light" customerSession={customerSession} locale={locale} />

        <main className="mt-10 flex-1 space-y-12 pb-8">
          {loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Memuat data produk...
            </div>
          ) : null}

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
