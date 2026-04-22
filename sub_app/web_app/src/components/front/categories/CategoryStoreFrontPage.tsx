import { Check, FolderTree } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowseProductItem } from "../products/types";
import ProductsPagination from "../products/ProductsPagination";
import ProductsProductCard from "../products/ProductsProductCard";
import { fetchPublicProductsPage, fetchPublicBusinesses, buildBrowseData } from "../products/api";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import Breadcrumbs from "../common/Breadcrumbs";

type ChildCategoryItem = {
  id: string;
  name: string;
  slug: string;
};

type CategoryDescription = {
  html?: string | null;
  short?: string | null;
};

interface CategoryStoreFrontPageProps {
  locale?: string;
  categoryName: string;
  childCategories: ChildCategoryItem[];
  products: BrowseProductItem[];
  initialProductPage?: number;
  initialSelectedChildCategoryIDs?: string[];
  ancestors?: ChildCategoryItem[];
  description?: CategoryDescription;
  slug?: string;
  serverTotalPages?: number;
  serverTotalProducts?: number;
}

const CHILD_CATEGORY_PER_PAGE = 3;
const PRODUCT_PER_PAGE = 12;

function inPriceRange(price: number, selectedPrice: string): boolean {
  if (selectedPrice === "all") return true;
  if (selectedPrice === "lt100") return price < 100000;
  if (selectedPrice === "100-200") return price >= 100000 && price <= 200000;
  if (selectedPrice === "gt200") return price > 200000;
  return true;
}

function matchStockStatus(item: BrowseProductItem, selectedStockStatus: string): boolean {
  if (selectedStockStatus === "all") return true;
  const status = String(item.stockStatus || "").trim().toLowerCase();
  if (selectedStockStatus === "in_stock") {
    return status === "in_stock" || status === "available" || status === "ready";
  }
  if (selectedStockStatus === "out_of_stock") {
    return status === "out_of_stock" || status === "unavailable" || status === "sold_out";
  }
  return true;
}

function matchPriceStatus(item: BrowseProductItem, selectedPriceStatus: string): boolean {
  if (selectedPriceStatus === "all") return true;
  if (selectedPriceStatus === "discount") return item.hasDiscount;
  if (selectedPriceStatus === "normal") return !item.hasDiscount;
  return true;
}

export default function CategoryStoreFrontPage({
  locale,
  categoryName,
  childCategories,
  products,
  initialProductPage = 1,
  initialSelectedChildCategoryIDs = [],
  ancestors = [],
  description,
  slug,
  serverTotalPages,
  serverTotalProducts,
}: CategoryStoreFrontPageProps) {
  const isEnglish = locale === "en";
  const [childCategoryPage, setChildCategoryPage] = useState(1);
  const [selectedChildCategoryIDs, setSelectedChildCategoryIDs] = useState<string[]>(() => [...initialSelectedChildCategoryIDs]);
  const [selectedPrice, setSelectedPrice] = useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");
  const [selectedPriceStatus, setSelectedPriceStatus] = useState("all");
  const [productPage, setProductPage] = useState(Math.max(1, initialProductPage));
  const [clientProducts, setClientProducts] = useState<BrowseProductItem[] | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [ajaxTotalProducts, setAjaxTotalProducts] = useState<number | null>(null);
  const [ajaxTotalPages, setAjaxTotalPages] = useState<number | null>(null);
  const isMountedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const skipInitialClientFetchRef = useRef<boolean>(false);

  const childCategoryTotalPages = Math.max(1, Math.ceil(childCategories.length / CHILD_CATEGORY_PER_PAGE));
  const childCategorySafePage = Math.min(childCategoryPage, childCategoryTotalPages);

  const visibleChildCategories = useMemo(() => {
    const start = (childCategorySafePage - 1) * CHILD_CATEGORY_PER_PAGE;
    return childCategories.slice(start, start + CHILD_CATEGORY_PER_PAGE);
  }, [childCategories, childCategorySafePage]);

  const sourceProducts = clientProducts ?? products;

  const filteredProducts = useMemo(() => {
    return sourceProducts.filter((item) => {
      const byChildCategory = selectedChildCategoryIDs.length === 0
        ? true
        : item.categoryIds.some((categoryID) => selectedChildCategoryIDs.includes(categoryID));
      const byPrice = inPriceRange(item.price, selectedPrice);
      const byStockStatus = matchStockStatus(item, selectedStockStatus);
      const byPriceStatus = matchPriceStatus(item, selectedPriceStatus);
      return byChildCategory && byPrice && byStockStatus && byPriceStatus;
    });
  }, [sourceProducts, selectedChildCategoryIDs, selectedPrice, selectedStockStatus, selectedPriceStatus]);

  const serverPaged = typeof serverTotalPages === "number" && serverTotalPages > 0 && clientProducts == null;

  const productTotalPages = serverPaged ? serverTotalPages! : Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PER_PAGE));
  const productSafePage = Math.min(productPage, productTotalPages);

  const pagedProducts = useMemo(() => {
    if (serverPaged) {
      // server already returned the current page items in `products`
      return sourceProducts;
    }
    const start = (productSafePage - 1) * PRODUCT_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCT_PER_PAGE);
  }, [filteredProducts, productSafePage, serverPaged, sourceProducts]);

  // Apply initial query params from URL (if any) on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const cats = sp.get("category_ids") ? sp.get("category_ids")!.split(",").filter(Boolean) : [];
    const price = sp.get("price") || "all";
    const stock = sp.get("stock_status") || "all";
    const priceStatus = sp.get("price_status") || "all";
    const pageParam = Math.max(1, Number(sp.get("page") || String(initialProductPage)) || initialProductPage);

    if (cats.length) {
      setSelectedChildCategoryIDs(cats);
    }
    if (price !== "all") {
      setSelectedPrice(price);
    }
    if (stock !== "all") {
      setSelectedStockStatus(stock);
    }
    if (priceStatus !== "all") {
      setSelectedPriceStatus(priceStatus);
    }
    setProductPage(pageParam);
    // If SSR already provided data for the same initial query, skip the first client fetch.
    const sameCategories = cats.length === initialSelectedChildCategoryIDs.length && cats.every((value, index) => value === initialSelectedChildCategoryIDs[index]);
    const samePage = pageParam === initialProductPage;
    const noClientOnlyFilters = price === "all" && stock === "all" && priceStatus === "all";
    if (sameCategories && samePage && noClientOnlyFilters) {
      skipInitialClientFetchRef.current = true;
    }

    isMountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductPage, initialSelectedChildCategoryIDs]);

  // Helper: determine whether we should do client AJAX fetch
  const shouldUseClientFetch = (): boolean => {
    return (
      (selectedChildCategoryIDs && selectedChildCategoryIDs.length > 0) ||
      selectedPrice !== "all" ||
      selectedStockStatus !== "all" ||
      selectedPriceStatus !== "all"
    );
  };

  // Fetch products via AJAX when filters or page change (debounced)
  useEffect(() => {
    if (!isMountedRef.current) return;

    // If SSR already provided matching data for the initial query, skip the first client fetch
    if (skipInitialClientFetchRef.current) {
      skipInitialClientFetchRef.current = false;
      return;
    }

    const doClear = () => {
      setClientProducts(null);
      setClientError(null);
      setClientLoading(false);
      setAjaxTotalProducts(null);
      setAjaxTotalPages(null);
    };

    if (!shouldUseClientFetch()) {
      doClear();
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      let cancelled = false;
      async function exec() {
        setClientLoading(true);
        setClientError(null);
        try {
          const res = await fetchPublicProductsPage({
            categoryIDs: selectedChildCategoryIDs?.length ? selectedChildCategoryIDs : undefined,
            page: productPage,
            limit: PRODUCT_PER_PAGE,
            locale,
            stockStatus: selectedStockStatus !== "all" ? selectedStockStatus : undefined,
          });

          if (cancelled) return;

          const businesses = await fetchPublicBusinesses();
          if (cancelled) return;

          const browse = buildBrowseData(res.items, businesses).products;
          setClientProducts(browse);
          setAjaxTotalProducts(res.total);
          setAjaxTotalPages(Math.max(1, Math.ceil(res.total / PRODUCT_PER_PAGE)));

          // update URL without reload
          try {
            const params = new URLSearchParams();
            if (selectedChildCategoryIDs && selectedChildCategoryIDs.length) params.set("category_ids", selectedChildCategoryIDs.join(","));
            if (selectedPrice !== "all") params.set("price", selectedPrice);
            if (selectedStockStatus !== "all") params.set("stock_status", selectedStockStatus);
            if (selectedPriceStatus !== "all") params.set("price_status", selectedPriceStatus);
            if (productPage && productPage > 1) params.set("page", String(productPage));

            const base = buildLocalizedPath(`/categories/${encodeURIComponent(slug || "")}`, locale);
            const url = params.toString() ? `${base}?${params.toString()}` : base;
            window.history.pushState({ filters: true }, "", url);
          } catch (e) {
            // ignore history errors
          }
        } catch (err) {
          if (cancelled) return;
          setClientError(err instanceof Error ? err.message : String(err));
          setClientProducts([]);
        } finally {
          if (!cancelled) setClientLoading(false);
        }
      }

      void exec();
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChildCategoryIDs, selectedPrice, selectedStockStatus, selectedPriceStatus, productPage, locale, slug]);

  // Handle back/forward navigation
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      const cats = sp.get("category_ids") ? sp.get("category_ids")!.split(",").filter(Boolean) : [];
      const price = sp.get("price") || "all";
      const stock = sp.get("stock_status") || "all";
      const priceStatus = sp.get("price_status") || "all";
      const pageParam = Math.max(1, Number(sp.get("page") || String(initialProductPage)) || initialProductPage);

      setSelectedChildCategoryIDs(cats);
      setSelectedPrice(price);
      setSelectedStockStatus(stock);
      setSelectedPriceStatus(priceStatus);
      setProductPage(pageParam);
      // effect above will trigger fetch if needed
    }

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductPage]);

  const descriptionHtml = String(description?.html || "").trim();
  const shortDescription = String(description?.short || "").trim();

  return (
    <div className="space-y-12">
      {ancestors && ancestors.length > 0 ? (
        <Breadcrumbs ancestors={ancestors} locale={locale} />
      ) : null}
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
          {isEnglish ? "Category Page" : "Halaman Kategori"}
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">{categoryName}</h1>
        {descriptionHtml ? (
          <div
            className="prose prose-slate mt-3 max-w-none text-sm sm:text-base"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : shortDescription ? (
          <p className="mt-3 text-sm text-slate-600 sm:text-base">{shortDescription}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            {isEnglish ? "Explore products from this category and its subcategories" : "Jelajahi produk dari kategori ini dan subkategorinya"}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {isEnglish ? "Filter Subcategories" : "Filter Subkategori"}
          </h2>
          <p className="text-sm text-slate-500">
            {selectedChildCategoryIDs.length > 0
              ? `${selectedChildCategoryIDs.length} ${isEnglish ? "selected" : "dipilih"}`
              : (isEnglish ? "Select subcategories" : "Pilih subkategori")}
          </p>
        </div>

        {visibleChildCategories.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {visibleChildCategories.map((item) => {
              const active = selectedChildCategoryIDs.includes(item.id);
              return (
                <div
                  key={item.id}
                  role="button"
                  aria-pressed={active}
                  tabIndex={0}
                  onClick={() => {
                    setSelectedChildCategoryIDs((current) => (
                      current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id]
                    ));
                    setProductPage(1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedChildCategoryIDs((current) => (
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id]
                      ));
                      setProductPage(1);
                    }
                  }}
                  className={[
                    "flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-100",
                    active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-5 w-5 text-emerald-700" />
                      <h3 className="text-xl font-bold tracking-tight text-slate-900">{item.name}</h3>
                    </div>
                    <span
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-[5px] border transition",
                        active ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">/{item.slug}</p>
                  <a
                    href={buildLocalizedPath(`/categories/${encodeURIComponent(item.slug)}`, locale)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {isEnglish ? "Open Category" : "Buka Kategori"}
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            {isEnglish ? "No subcategories yet." : "Belum ada subkategori."}
          </div>
        )}

        <ProductsPagination
          page={childCategorySafePage}
          totalPages={childCategoryTotalPages}
          onPageChange={setChildCategoryPage}
          className="mt-3 justify-start"
        />
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">{isEnglish ? "Products" : "Produk"}</h2>
            <p className="mt-1 text-base text-slate-500">
              {(typeof serverTotalProducts === "number" && clientProducts == null ? serverTotalProducts : filteredProducts.length)} {isEnglish ? "items match your filter" : "produk sesuai filter"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <select
              className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
              value={selectedPrice}
              onChange={(event) => {
                setSelectedPrice(event.target.value);
                setProductPage(1);
              }}
            >
              <option value="all">{isEnglish ? "Price" : "Harga"}</option>
              <option value="lt100">{isEnglish ? "Under Rp100.000" : "Di bawah Rp100.000"}</option>
              <option value="100-200">Rp100.000 - Rp200.000</option>
              <option value="gt200">{isEnglish ? "Above Rp200.000" : "Di atas Rp200.000"}</option>
            </select>

            <select
              className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
              value={selectedStockStatus}
              onChange={(event) => {
                setSelectedStockStatus(event.target.value);
                setProductPage(1);
              }}
            >
              <option value="all">{isEnglish ? "Item Status" : "Status Barang"}</option>
              <option value="in_stock">{isEnglish ? "Available" : "Tersedia"}</option>
              <option value="out_of_stock">{isEnglish ? "Out of Stock" : "Habis"}</option>
            </select>

            <select
              className="h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
              value={selectedPriceStatus}
              onChange={(event) => {
                setSelectedPriceStatus(event.target.value);
                setProductPage(1);
              }}
            >
              <option value="all">{isEnglish ? "Price Status" : "Status Harga"}</option>
              <option value="discount">{isEnglish ? "Discount" : "Diskon"}</option>
              <option value="normal">{isEnglish ? "Normal" : "Normal"}</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSelectedChildCategoryIDs([]);
                setSelectedPrice("all");
                setSelectedStockStatus("all");
                setSelectedPriceStatus("all");
                setProductPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700"
            >
              {isEnglish ? "Reset" : "Reset"}
            </button>
          </div>
        </div>

        {clientLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {isEnglish ? "Loading products..." : "Memuat produk..."}
          </div>
        ) : pagedProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pagedProducts.map((product) => (
              <ProductsProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {isEnglish ? "No products available with current filters." : "Belum ada produk yang cocok dengan filter saat ini."}
          </div>
        )}

        <ProductsPagination
          page={productSafePage}
          totalPages={productTotalPages}
          onPageChange={(targetPage) => {
            if (clientProducts == null) {
              const base = slug
                ? buildLocalizedPath(`/categories/${encodeURIComponent(slug)}`, locale)
                : buildLocalizedPath(`/categories`, locale);
              const separator = base.includes("?") ? "&" : "?";
              window.location.href = `${base}${separator}page=${targetPage}`;
            } else {
              setProductPage(targetPage);
            }
          }}
        />
      </section>
    </div>
  );
}
