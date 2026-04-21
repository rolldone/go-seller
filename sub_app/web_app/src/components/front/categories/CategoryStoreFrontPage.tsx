import { Check, FolderTree } from "lucide-react";
import { useMemo, useState } from "react";
import type { BrowseProductItem } from "../products/types";
import ProductsPagination from "../products/ProductsPagination";
import ProductsProductCard from "../products/ProductsProductCard";
import { buildLocalizedPath } from "../../../lib/siteLocale";

type ChildCategoryItem = {
  id: string;
  name: string;
  slug: string;
};

interface CategoryStoreFrontPageProps {
  locale?: string;
  categoryName: string;
  childCategories: ChildCategoryItem[];
  products: BrowseProductItem[];
  initialProductPage?: number;
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
}: CategoryStoreFrontPageProps) {
  const isEnglish = locale === "en";
  const [childCategoryPage, setChildCategoryPage] = useState(1);
  const [selectedChildCategoryIDs, setSelectedChildCategoryIDs] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");
  const [selectedPriceStatus, setSelectedPriceStatus] = useState("all");
  const [productPage, setProductPage] = useState(Math.max(1, initialProductPage));

  const childCategoryTotalPages = Math.max(1, Math.ceil(childCategories.length / CHILD_CATEGORY_PER_PAGE));
  const childCategorySafePage = Math.min(childCategoryPage, childCategoryTotalPages);

  const visibleChildCategories = useMemo(() => {
    const start = (childCategorySafePage - 1) * CHILD_CATEGORY_PER_PAGE;
    return childCategories.slice(start, start + CHILD_CATEGORY_PER_PAGE);
  }, [childCategories, childCategorySafePage]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const byChildCategory = selectedChildCategoryIDs.length === 0
        ? true
        : item.categoryIds.some((categoryID) => selectedChildCategoryIDs.includes(categoryID));
      const byPrice = inPriceRange(item.price, selectedPrice);
      const byStockStatus = matchStockStatus(item, selectedStockStatus);
      const byPriceStatus = matchPriceStatus(item, selectedPriceStatus);
      return byChildCategory && byPrice && byStockStatus && byPriceStatus;
    });
  }, [products, selectedChildCategoryIDs, selectedPrice, selectedStockStatus, selectedPriceStatus]);

  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PER_PAGE));
  const productSafePage = Math.min(productPage, productTotalPages);

  const pagedProducts = useMemo(() => {
    const start = (productSafePage - 1) * PRODUCT_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCT_PER_PAGE);
  }, [filteredProducts, productSafePage]);

  return (
    <div className="space-y-12">
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
          {isEnglish ? "Category Page" : "Halaman Kategori"}
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">{categoryName}</h1>
        <p className="mt-3 text-sm text-slate-600 sm:text-base">
          {isEnglish ? "Explore products from this category and its subcategories" : "Jelajahi produk dari kategori ini dan subkategorinya"}
        </p>
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
              {filteredProducts.length} {isEnglish ? "items match your filter" : "produk sesuai filter"}
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

        {pagedProducts.length > 0 ? (
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

        <ProductsPagination page={productSafePage} totalPages={productTotalPages} onPageChange={setProductPage} />
      </section>
    </div>
  );
}
