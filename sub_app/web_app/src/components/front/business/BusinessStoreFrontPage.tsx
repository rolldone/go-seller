/** @jsxRuntime classic */
import type { PublicBusinessStore, PublicBusinessProduct } from "./types";
import React, { useEffect, useState } from "react";
import BusinessPageNav from "./BusinessPageNav";
import BusinessStoreHeader from "./BusinessStoreHeader";
import BusinessHomeTab from "./tabs/BusinessHomeTab";
import BusinessProductTab from "./tabs/BusinessProductTab";
import BusinessReviewTab from "./tabs/BusinessReviewTab";
import BusinessAboutTab from "./tabs/BusinessAboutTab";
import Footer from "../Footer";
import { getFallbackBusinessStore } from "./mockData";
import type { CustomerSession } from "../../../lib/customerSession";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import { useTranslations } from "../../../i18n";
import { formatAmount } from "../../../lib/amountFormat";

interface BusinessStoreFrontPageProps {
  store: PublicBusinessStore;
  initialTab?: TabKey;
  locale?: string;
  customerSession?: CustomerSession | null;
}

type TabKey = "beranda" | "produk" | "ulasan" | "tentang";

const TAB_ITEMS: TabKey[] = ["beranda", "produk", "ulasan", "tentang"];

const VALID_TAB_KEYS = new Set<TabKey>(TAB_ITEMS);

function isTabKey(value: string | null): value is TabKey {
  return Boolean(value) && VALID_TAB_KEYS.has(value as TabKey);
}

export default function BusinessStoreFrontPage({ store, initialTab = "beranda", locale = "", customerSession = null }: BusinessStoreFrontPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const { business, products = [], reviewSummary = null, reviews = [], carousels = [] } = store;
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const needsMockProducts = (activeTab === "produk" || activeTab === "beranda") && products.length === 0;
  const mockStore = needsMockProducts ? getFallbackBusinessStore(business.slug) : null;
  const [productsState, setProductsState] = useState<PublicBusinessProduct[]>(products ?? []);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const effectiveProducts = productsState.length ? productsState : (products.length ? products : mockStore?.products ?? []);
  const effectiveReviewSummary = reviewSummary;
  const effectiveReviews = safeReviews;
  const effectiveCarousels = Array.isArray(carousels) ? carousels : [];
  const featuredProducts = effectiveProducts.slice(0, 6);
  const t = useTranslations("business", locale);

  const formatNumber = (value: number) => formatAmount(value, { fractionDigits: 0 });
  
  // Filter products by search query for the "Produk" tab
  const filteredProducts = effectiveProducts.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Group products by category, limit to 3 categories
  const categories = Array.from(new Set(effectiveProducts.map((p) => p.category))).slice(0, 3);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const queryTab = url.searchParams.get("tab");
    if (isTabKey(queryTab)) {
      setActiveTab(queryTab);
      return;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const pathTab = parts.length >= 3 && parts[0] === "b" ? parts[2] : null;
    if (isTabKey(pathTab)) {
      setActiveTab(pathTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const basePath = `/b/${business.slug}`;
    const nextPath = activeTab === "beranda" ? basePath : `${basePath}/${activeTab}`;

    url.pathname = buildLocalizedPath(nextPath, locale);
    url.searchParams.delete("tab");

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab, business.slug]);

  // Fetch products for the business when on the Produk tab or when search changes
  useEffect(() => {
    if (activeTab !== "produk") return;
    if (!business?.slug) return;

    const controller = new AbortController();
    let cancelled = false;

    async function fetchProducts() {
      setLoadingProducts(true);
      setProductsError(null);
      try {
        const params = new URLSearchParams();
        if (searchQuery) {
          params.set("search", searchQuery);
        }
        if (locale) {
          params.set("locale", locale);
        }
        const q = params.toString() ? `?${params.toString()}` : "";
        const apiBase = import.meta.env.PUBLIC_API_URL
          ? String(import.meta.env.PUBLIC_API_URL).replace(/\/$/, "")
          : "";
        // Use the public business route so frontend can reuse the page slug: /b/:slug
        const endpoint = apiBase
          ? `${apiBase}/b/${business.slug}${q}`
          : `/b/${business.slug}${q}`;
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Accept either an array response or { products: [...] }
        const list: PublicBusinessProduct[] = Array.isArray(data) ? data : data?.products ?? [];
        if (!cancelled) setProductsState(list);
      } catch (err: any) {
        if (!cancelled) setProductsError(err?.message ?? String(err));
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, business.slug, searchQuery, locale]);

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <BusinessPageNav business={business} customerSession={customerSession} locale={locale} />

        <BusinessStoreHeader business={business} locale={locale} />

        <nav className="mt-5 border-b border-slate-300">
          <ul className="flex items-center gap-6 text-sm font-semibold">
            {TAB_ITEMS.map((tab) => (
              <li
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer pb-3 transition-colors ${
                  activeTab === tab ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab === "beranda" ? t("home", "Beranda") : tab === "produk" ? t("products", "Produk") : tab === "ulasan" ? t("reviews", "Ulasan") : t("aboutStore", "Tentang Toko")}
              </li>
            ))}
          </ul>
        </nav>

        {activeTab === "beranda" && (
          <BusinessHomeTab
            businessSlug={business.slug}
            locale={locale}
            carousels={effectiveCarousels}
            featuredProducts={featuredProducts}
            products={effectiveProducts}
            categories={categories}
          />
        )}

        {activeTab === "produk" && (
          <BusinessProductTab
            businessSlug={business.slug}
            locale={locale}
            businessName={business.name}
            categories={categories}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filteredProducts={filteredProducts}
            loading={loadingProducts}
            error={productsError}
          />
        )}

        {activeTab === "ulasan" && effectiveReviewSummary && (
          <BusinessReviewTab
            businessSlug={business.slug}
            locale={locale}
            products={effectiveProducts}
            reviewSummary={effectiveReviewSummary}
            reviews={effectiveReviews}
            formatNumber={formatNumber}
          />
        )}

        {activeTab === "tentang" && <BusinessAboutTab business={business} locale={locale} />}
      </div>

      <Footer />
    </div>
  );
}
