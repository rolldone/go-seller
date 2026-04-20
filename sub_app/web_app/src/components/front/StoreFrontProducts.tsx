import { useEffect, useMemo, useState } from "react";
import type { CustomerSession } from "../../lib/customerSession";
import HomeNav from "./HomeNav";
import Footer from "./Footer";
import ProductsCatalogSection from "./products/ProductsCatalogSection";
import ProductsHeroSearchSection from "./products/ProductsHeroSearchSection";
import ProductsStoreFilterSection from "./products/ProductsStoreFilterSection";
import type { BrowseCategoryItem } from "./products/types";
import {
  buildBrowseData,
  fetchPublicBusinesses,
  fetchPublicProducts,
  fetchPublicSearchResults,
  type PublicBusiness,
  type PublicProduct,
  type PublicSearchResult,
} from "./products/api";

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
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicSearchResult[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
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
    const keyword = searchQuery.trim();
    if (!keyword) {
      setAppliedSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      setSearchPending(false);
      setSearchLoading(false);
      return;
    }

    setSearchPending(true);

    const timer = window.setTimeout(() => {
      setAppliedSearchQuery(keyword);
      setCatalogPage(1);
      setStorePage(1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const keyword = appliedSearchQuery.trim();
    if (!keyword) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSearchResults() {
      setSearchLoading(true);
      setSearchError("");

      try {
        const results = await fetchPublicSearchResults(keyword);
        if (cancelled) return;
        setSearchResults(results);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setSearchError(message || "Gagal mencari produk");
        setSearchResults([]);
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
          setSearchPending(false);
        }
      }
    }

    void loadSearchResults();
    return () => {
      cancelled = true;
    };
  }, [appliedSearchQuery]);

  const searchResultMaps = useMemo(() => {
    const productIDs = new Set<string>();
    const businessIDs = new Set<string>();
    const categoryIDs = new Set<string>();

    for (const result of searchResults) {
      const entityType = String(result.entityType || "").toLowerCase();
      if (entityType === "product") {
        productIDs.add(result.entityID);
      } else if (entityType === "business") {
        businessIDs.add(result.entityID);
      } else if (entityType === "category") {
        categoryIDs.add(result.entityID);
      }
    }

    return { productIDs, businessIDs, categoryIDs };
  }, [searchResults]);

  const activeSearchQuery = appliedSearchQuery.trim();
  useEffect(() => {
    if (!businessesLoaded) {
      return;
    }
    if (activeSearchQuery && (searchPending || searchLoading)) {
      return;
    }

    let cancelled = false;

    async function loadProducts() {
      setLoadError("");
      setProductsLoaded(false);

      const businessIDs = new Set<string>();
      if (activeSearchQuery) {
        for (const id of searchResultMaps.businessIDs) {
          businessIDs.add(id);
        }
      }

      const ids = activeSearchQuery ? Array.from(searchResultMaps.productIDs) : [];
      const categoryIDs = activeSearchQuery ? Array.from(searchResultMaps.categoryIDs) : [];

      if (activeSearchQuery && ids.length === 0 && businessIDs.size === 0 && categoryIDs.length === 0) {
        if (cancelled) return;
        setProductsData([]);
        setProductsLoaded(true);
        return;
      }

      try {
        const products = await fetchPublicProducts({
          locale,
          page: 1,
          limit: 200,
          productType: heroCategory === "all" ? undefined : heroCategory,
          ids: ids.length > 0 ? ids : undefined,
          businessIDs: businessIDs.size > 0 ? Array.from(businessIDs) : undefined,
          categoryIDs: categoryIDs.length > 0 ? categoryIDs : undefined,
        });
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
  }, [activeSearchQuery, businessesLoaded, heroCategory, locale, searchLoading, searchPending, searchResultMaps]);

  const browseData = useMemo(() => buildBrowseData(productsData, businessesData), [businessesData, productsData]);
  const { products: browseProducts, stores: browseStores } = browseData;

  const searchRelevanceByProductID = useMemo<Record<string, number>>(() => {
    const directRanks = new Map<string, number>();
    const businessRanks = new Map<string, number>();
    const categoryRanks = new Map<string, number>();

    for (const result of searchResults) {
      const entityType = String(result.entityType || "").toLowerCase();
      const rank = Number(result.rank || 0);
      if (entityType === "product") {
        directRanks.set(result.entityID, Math.max(directRanks.get(result.entityID) || 0, rank));
      } else if (entityType === "business") {
        businessRanks.set(result.entityID, Math.max(businessRanks.get(result.entityID) || 0, rank));
      } else if (entityType === "category") {
        categoryRanks.set(result.entityID, Math.max(categoryRanks.get(result.entityID) || 0, rank));
      }
    }

    const relevanceByProductID: Record<string, number> = {};
    for (const product of browseProducts) {
      let score = directRanks.get(product.id) || 0;
      if (product.storeId && businessRanks.has(product.storeId)) {
        score = Math.max(score, businessRanks.get(product.storeId) || 0);
      }
      for (const categoryID of product.categoryIds) {
        if (categoryRanks.has(categoryID)) {
          score = Math.max(score, categoryRanks.get(categoryID) || 0);
        }
      }
      if (score > 0) {
        relevanceByProductID[product.id] = score;
      }
    }

    return relevanceByProductID;
  }, [browseProducts, searchResults]);

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

    if (!activeSearchQuery) {
      return byHeroCategory;
    }

    return byHeroCategory.filter((store) => {
      const storeMatch = searchResultMaps.businessIDs.has(store.id);
      const productMatch = browseProducts.some((product) => {
        const categoryMatch = product.categoryIds.some((categoryID) => searchResultMaps.categoryIDs.has(categoryID));
        return product.storeId === store.id && (searchResultMaps.productIDs.has(product.id) || categoryMatch);
      });
      return storeMatch || productMatch;
    });
  }, [activeSearchQuery, browseProducts, browseStores, heroCategory, searchResultMaps]);

  const topFilteredProducts = useMemo(() => {
    const byCategory = heroCategory === "all"
      ? browseProducts
      : browseProducts.filter((item) => item.category === heroCategory);

    const byStore = selectedStoreIDs.length === 0
      ? byCategory
      : byCategory.filter((item) => selectedStoreIDs.includes(item.storeId));

    if (!activeSearchQuery) {
      return byStore;
    }

    return byStore.filter((item) => {
      const categoryMatch = item.categoryIds.some((categoryID) => searchResultMaps.categoryIDs.has(categoryID));
      return searchResultMaps.productIDs.has(item.id)
        || searchResultMaps.businessIDs.has(item.storeId)
        || categoryMatch;
    });
  }, [activeSearchQuery, browseProducts, heroCategory, searchResultMaps, selectedStoreIDs]);

  const storeSectionLoading = !businessesLoaded || searchPending || searchLoading;
  const productSectionLoading = !productsLoaded || searchPending || searchLoading;

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
            onSearchSubmit={() => {
              setAppliedSearchQuery(searchQuery.trim());
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
            isSearching={searchLoading}
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
            loading={storeSectionLoading}
            statusMessage={loadError && !searchError ? loadError : undefined}
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
            searchRelevanceByProductID={searchRelevanceByProductID}
            loading={productSectionLoading}
            statusMessage={searchError || (searchLoading && activeSearchQuery ? `Mencari "${activeSearchQuery}"...` : undefined) || (loadError && !searchError ? loadError : undefined)}
          />
        </main>
      </div>

      <Footer />
    </div>
  );
}
