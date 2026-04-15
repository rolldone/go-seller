/** @jsxRuntime classic */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Star, Minus, Plus, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import BusinessPageNav from "./BusinessPageNav";
import BusinessStoreHeader from "./BusinessStoreHeader";
import BusinessDisclaimerSection from "./BusinessDisclaimerSection";
import Footer from "../Footer";
import { getCustomerAuthToken } from "../../customer/auth/authApi";
import { rememberCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";
import { getProductReviewStats } from "../../../lib/orderApi";
import type { PublicBusinessProduct, PublicBusinessStore } from "./types";
import type { CustomerSession } from "../../../lib/customerSession";

interface ProductDetailPageProps {
  store: PublicBusinessStore;
  product: PublicBusinessProduct;
  relatedProducts: PublicBusinessProduct[];
  locale?: string;
  customerSession?: CustomerSession | null;
}

type VariationAttribute = {
  id: string;
  attribute_group_id: string;
  name: string;
  attribute_group?: { id: string; name: string } | null;
};

type VariationAsset = {
  id: string;
  file_path?: string | null;
  public_url?: string | null;
  is_main?: boolean;
  display_order?: number;
};

type ProductVariation = {
  id: string;
  product_id: string;
  sku: string;
  price: number;
  compare_price?: number | null;
  is_default?: boolean;
  is_active?: boolean;
  attributes?: VariationAttribute[];
  assets?: VariationAsset[];
};

type PublicProductReview = {
  id: string;
  product_id: string;
  rating: number;
  review_text: string;
  question_text: string;
  seller_reply?: string | null;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
};

type ReviewAttachmentMeta = {
  name?: string;
  publicUrl?: string;
  public_url?: string;
  storageKey?: string;
  storage_key?: string;
  mimeType?: string;
  mime_type?: string;
  fileSize?: number;
  file_size?: number;
};

function getPublicApiBase(): string {
  return (import.meta as any)?.env?.PUBLIC_API_URL
    ? String((import.meta as any).env.PUBLIC_API_URL).replace(/\/$/, "")
    : "";
}

function buildMediaSetFromVariationAssets(assets: VariationAsset[] | undefined): Array<{ key: string; url: string }> {
  if (!assets || assets.length === 0) return [];
  const apiBase = getPublicApiBase();
  const sorted = [...assets].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const mapped = sorted.map((a, idx) => {
    let url = a.public_url || "";
    if (!url && a.file_path) url = a.file_path;
    if (url && url.startsWith("/")) {
      url = apiBase ? `${apiBase}${url}` : url;
    }
    return { key: a.id || `var-asset-${idx}`, url };
  });
  return mapped.filter((item) => Boolean(item.url));
}

function toNumber(price?: string | number | null): number {
  if (typeof price === "number") return price;
  if (!price) return 0;
  const value = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

function parseMetadata(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as Record<string, any>;
  }
  return null;
}

function parseReviewAttachments(value: unknown): ReviewAttachmentMeta[] {
  const metadata = parseMetadata(value);
  const attachments = Array.isArray(metadata?.attachments) ? metadata.attachments : [];
  return attachments
    .map((item) => (item && typeof item === "object" ? (item as ReviewAttachmentMeta) : null))
    .filter((item): item is ReviewAttachmentMeta => Boolean(item));
}

function resolveAttachmentUrl(attachment: ReviewAttachmentMeta): string {
  const rawUrl = attachment.publicUrl || attachment.public_url || attachment.storageKey || attachment.storage_key || "";
  if (!rawUrl) return "";
  if (rawUrl.startsWith("/")) {
    const apiBase = getPublicApiBase();
    return apiBase ? `${apiBase}${rawUrl}` : rawUrl;
  }
  return rawUrl;
}

export default function ProductDetailPage({ store, product, relatedProducts, locale = "", customerSession = null }: ProductDetailPageProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedAttributeByGroup, setSelectedAttributeByGroup] = useState<Record<string, string>>({});
  const [variationLoading, setVariationLoading] = useState(false);
  const [variationMatching, setVariationMatching] = useState(false);
  const [variationError, setVariationError] = useState<string | null>(null);
  const [productReviews, setProductReviews] = useState<PublicProductReview[]>([]);
  const [productReviewsLoading, setProductReviewsLoading] = useState(false);
  const [productReviewStats, setProductReviewStats] = useState<{ total_reviews: number; average_rating: number; rating_count: Record<number, number> } | null>(null);
  const [productReviewStatsLoading, setProductReviewStatsLoading] = useState(false);
  const thumbListRef = useRef<HTMLDivElement>(null);

  const attributeGroups = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; items: VariationAttribute[] }>();
    for (const variation of variations) {
      for (const attr of variation.attributes || []) {
        const groupID = attr.attribute_group_id;
        if (!groupID) continue;
        const existing = grouped.get(groupID);
        const groupName = attr.attribute_group?.name || `Group ${groupID.slice(0, 6)}`;
        if (!existing) {
          grouped.set(groupID, { id: groupID, name: groupName, items: [attr] });
          continue;
        }
        if (!existing.items.some((it) => it.id === attr.id)) {
          existing.items.push(attr);
        }
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [variations]);

  const fetchVariationByAttributes = async (productID: string, attributeIDs: string[]): Promise<ProductVariation | null> => {
    if (!productID || attributeIDs.length === 0) return null;
    const query = new URLSearchParams();
    query.set("product_id", productID);
    query.set("attribute_ids", attributeIDs.join(","));
    const apiBase = getPublicApiBase();
    const endpoint = apiBase
      ? `${apiBase}/api/catalog/variations/by-attributes?${query.toString()}`
      : `/api/catalog/variations/by-attributes?${query.toString()}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ProductVariation;
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadVariations = async () => {
      if (!product.id) return;
      setVariationLoading(true);
      setVariationError(null);
      try {
        const query = new URLSearchParams();
        query.set("product_id", product.id);
        const apiBase = getPublicApiBase();
        const endpoint = apiBase
          ? `${apiBase}/api/catalog/variations?${query.toString()}`
          : `/api/catalog/variations?${query.toString()}`;
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const list = (await res.json()) as ProductVariation[];
        if (cancelled) return;
        setVariations(list || []);

        const preferred = (list || []).find((v) => v.is_default) || (list || [])[0] || null;
        setSelectedVariation(preferred);

        const selection: Record<string, string> = {};
        for (const attr of preferred?.attributes || []) {
          if (attr.attribute_group_id) selection[attr.attribute_group_id] = attr.id;
        }
        setSelectedAttributeByGroup(selection);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load variations";
        setVariationError(message);
      } finally {
        if (!cancelled) setVariationLoading(false);
      }
    };

    loadVariations();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product.id]);

  const onSelectAttributeItem = async (groupID: string, attributeID: string) => {
    const next = { ...selectedAttributeByGroup, [groupID]: attributeID };
    setSelectedAttributeByGroup(next);

    const selectedIDs = Object.values(next).filter(Boolean);
    if (selectedIDs.length === 0) return;

    const localMatch = variations.find((v) =>
      selectedIDs.every((attrID) => (v.attributes || []).some((a) => a.id === attrID)),
    );
    if (localMatch) {
      setSelectedVariation(localMatch);
    }

    if (attributeGroups.length > 0 && selectedIDs.length < attributeGroups.length) {
      return;
    }

    setVariationMatching(true);
    try {
      const exact = await fetchVariationByAttributes(product.id, selectedIDs);
      if (exact) {
        setSelectedVariation(exact);
      } else {
        // Fallback to base non-variant product when no exact combination exists.
        setSelectedVariation(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to match variation";
      setVariationError(message);
    } finally {
      setVariationMatching(false);
    }
  };

  const useBaseProduct = () => {
    setSelectedVariation(null);
    setSelectedAttributeByGroup({});
    setVariationError(null);
    setVariationMatching(false);
  };

  const basePrice = useMemo(() => {
    if (selectedVariation?.price != null) return Number(selectedVariation.price);
    const discounted = toNumber(product.discounted_price);
    const original = toNumber(product.original_price);
    const fallback = toNumber(product.price);
    return discounted || original || fallback;
  }, [product.discounted_price, product.original_price, product.price, selectedVariation]);
  const currentPrice = basePrice;
  const comparePrice = selectedVariation?.compare_price != null
    ? Number(selectedVariation.compare_price)
    : (basePrice > 0 ? Math.round(basePrice * 1.35) : 0);

  const mediaSet = useMemo(() => {
    const variationMedia = buildMediaSetFromVariationAssets(selectedVariation?.assets);
    if (variationMedia.length > 0) {
      return variationMedia;
    }

    const apiBase = (import.meta as any)?.env?.PUBLIC_API_URL
      ? String((import.meta as any).env.PUBLIC_API_URL).replace(/\/$/, "")
      : "";
    const items = (product.gallery || []).map((g, idx) => {
      let url = g?.public_url || "";
      if (!url && g?.file_path) url = g.file_path;
      if (url && url.startsWith("/")) {
        url = apiBase ? `${apiBase}${url}` : url;
      }
      return {
        key: g?.id || `img-${idx}`,
        url,
      };
    });
    return items.filter((item) => Boolean(item.url));
  }, [product.gallery, selectedVariation]);

  useEffect(() => {
    setActiveImage(0);
  }, [selectedVariation?.id]);

  const noVariationFound = useMemo(() => {
    const selectedCount = Object.values(selectedAttributeByGroup || {}).filter(Boolean).length;
    return (
      selectedVariation === null &&
      attributeGroups.length > 0 &&
      selectedCount === attributeGroups.length &&
      !variationLoading &&
      !variationMatching
    );
  }, [selectedVariation, selectedAttributeByGroup, attributeGroups, variationLoading, variationMatching]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadProductReviews = async () => {
      if (!product.id) {
        setProductReviews([]);
        return;
      }
      setProductReviewsLoading(true);
      try {
        const apiBase = getPublicApiBase();
        const endpoint = apiBase
          ? `${apiBase}/api/review/products/${encodeURIComponent(product.id)}?page=1&limit=10`
          : `/api/review/products/${encodeURIComponent(product.id)}?page=1&limit=10`;
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { data?: PublicProductReview[] };
        if (!cancelled) {
          setProductReviews(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch {
        if (!cancelled) setProductReviews([]);
      } finally {
        if (!cancelled) setProductReviewsLoading(false);
      }
    };

    void loadProductReviews();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product.id]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadReviewStats = async () => {
      if (!product.id) {
        setProductReviewStats(null);
        return;
      }
      setProductReviewStatsLoading(true);
      try {
        const result = await getProductReviewStats(product.id);
        if (!cancelled) {
          setProductReviewStats(result.data);
        }
      } catch {
        if (!cancelled) setProductReviewStats(null);
      } finally {
        if (!cancelled) setProductReviewStatsLoading(false);
      }
    };

    void loadReviewStats();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product.id]);

  const businessMeta = store.business as any;
  const businessRating = businessMeta?.rating || "-";
  const businessReviewCount = businessMeta?.reviewCount || 0;
  const businessSoldLabel = businessMeta?.soldLabel || "-";
  const isCustomerAuthenticated = Boolean(customerSession?.authenticated || getCustomerAuthToken());
  const businessSlug = String((store.business as any)?.slug || "").trim();

  const buildCartTarget = (intent: "add_to_cart" | "buy_now") => {
    const cartPath = businessSlug ? `/b/${encodeURIComponent(businessSlug)}/cart` : "/cart";
    if (typeof window === "undefined") return cartPath;

    const target = new URL(`${window.location.origin}${cartPath}`);
    target.searchParams.set("intent", intent);
    target.searchParams.set("product_id", product.id);
    target.searchParams.set("product_name", product.title);
    target.searchParams.set("business_id", store.business.id);
    target.searchParams.set("business_name", store.business.name);
    if (businessSlug) target.searchParams.set("business_slug", businessSlug);
    target.searchParams.set("qty", String(qty));
    target.searchParams.set("unit_price", String(currentPrice));
    if (selectedVariation?.id) target.searchParams.set("variation_id", selectedVariation.id);
    if (selectedVariation?.sku) target.searchParams.set("sku", selectedVariation.sku);
    const firstImage = mediaSet[0]?.url || "";
    if (firstImage) target.searchParams.set("image_url", firstImage);
    return `${target.pathname}${target.search}${target.hash}`;
  };

  const handleAddToCart = () => {
    if (typeof window === "undefined") return;

    if (!isCustomerAuthenticated) {
      window.location.replace(rememberCustomerAuthNextPath(buildCartTarget("add_to_cart")));
      return;
    }

    window.location.href = buildCartTarget("add_to_cart");
  };

  const handleBuyNow = () => {
    if (typeof window === "undefined") return;

    // If not authenticated, remember the product page with buy intent and redirect to login
    if (!isCustomerAuthenticated) {
      window.location.replace(rememberCustomerAuthNextPath(buildCartTarget("buy_now")));
      return;
    }

    window.location.href = buildCartTarget("buy_now");
  };

  const goToPrevSlide = () => {
    if (mediaSet.length === 0) return;
    setActiveImage((prev) => (prev - 1 + mediaSet.length) % mediaSet.length);
  };

  const goToNextSlide = () => {
    if (mediaSet.length === 0) return;
    setActiveImage((prev) => (prev + 1) % mediaSet.length);
  };

  const scrollThumbnails = (direction: "left" | "right") => {
    if (!thumbListRef.current) return;
    const amount = 220;
    thumbListRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <BusinessPageNav business={store.business} customerSession={customerSession} />

       

        <main className="mt-6 space-y-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <a href={locale ? `/b/${store.business.slug}?locale=${encodeURIComponent(locale)}` : `/b/${store.business.slug}`} className="hover:text-emerald-600">
                {store.business.name}
              </a>
              <span>/</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{product.category}</span>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 md:aspect-[16/9]">
                  {noVariationFound ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-amber-50 text-amber-900">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
                        <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.5" />
                        <path d="M8 13l2.5 3L14 11l4 6" strokeWidth="1.5" />
                      </svg>
                      <div className="text-center">
                        <h3 className="mb-1 text-lg font-semibold">Variasi tidak ditemukan</h3>
                        <p className="text-sm text-amber-800/90">Tidak ada kombinasi atribut yang cocok untuk produk ini.</p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={useBaseProduct}
                          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                        >
                          Kembali ke Produk Utama
                        </button>
                      </div>
                    </div>
                  ) : mediaSet.length > 0 ? (
                    <img
                      src={mediaSet[activeImage]?.url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No image</div>
                  )}
                  <button
                    type="button"
                    onClick={goToPrevSlide}
                    aria-label="Slide sebelumnya"
                    className="absolute left-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNextSlide}
                    aria-label="Slide berikutnya"
                    className="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Geser thumbnail ke kiri"
                    onClick={() => scrollThumbnails("left")}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div ref={thumbListRef} className="flex flex-1 gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {mediaSet.map((media, idx) => (
                      <button
                        key={media.key}
                        type="button"
                        aria-label={`Thumbnail ${idx + 1}`}
                        onClick={() => setActiveImage(idx)}
                        className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl border transition ${
                          activeImage === idx
                            ? "border-emerald-500 ring-2 ring-emerald-100"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <img src={media.url} alt={`${product.title} ${idx + 1}`} loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Geser thumbnail ke kanan"
                    onClick={() => scrollThumbnails("right")}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

              </div>

              <div className="min-w-0 space-y-5">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-800">{businessRating}</span>
                    <span>({businessReviewCount} ulasan)</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Best Seller</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">{product.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{product.excerpt}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Harga</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-bold text-slate-900">{toCurrency(currentPrice)}</span>
                    {comparePrice > currentPrice && (
                      <span className="pb-1 text-sm text-slate-400 line-through">{toCurrency(comparePrice)}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {attributeGroups.length > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          Mode: {selectedVariation ? "Variant" : "Produk utama"}
                        </p>
                        {selectedVariation ? (
                          <button
                            type="button"
                            onClick={useBaseProduct}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
                          >
                            Pilih Produk Utama
                          </button>
                        ) : null}
                      </div>
                  ) : null}

                  {variationLoading ? <p className="text-sm text-slate-500">Memuat variasi...</p> : null}
                  {variationError ? <p className="text-sm text-red-600">Error variasi: {variationError}</p> : null}

                  {!variationLoading && !variationError && attributeGroups.length === 0 ? (
                    <p className="text-sm text-slate-500">Variasi belum tersedia untuk produk ini.</p>
                  ) : null}

                  {!variationLoading && attributeGroups.length > 0 ? (
                    <>
                      {attributeGroups.map((group) => (
                        <div key={group.id}>
                          <p className="mb-2 text-sm font-semibold text-slate-700">{group.name}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((item) => {
                              const active = selectedAttributeByGroup[group.id] === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => onSelectAttributeItem(group.id, item.id)}
                                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                                    active
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                                  }`}
                                >
                                  {item.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p><span className="font-semibold">SKU aktif:</span> {selectedVariation?.sku || "(produk utama)"}</p>
                        {variationMatching ? <p className="mt-1 text-xs text-slate-500">Menyocokkan variasi...</p> : null}
                            {noVariationFound ? (
                              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold">Variasi tidak ditemukan</p>
                                    <p className="text-xs text-amber-800/90">Kombinasi atribut yang dipilih tidak memiliki produk variasi.</p>
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={useBaseProduct}
                                      className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                                    >
                                      Kembali ke Produk Utama
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-700">Qty</p>
                  <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
                    <button type="button" onClick={() => setQty((prev) => Math.max(1, prev - 1))} className="px-3 py-2 text-slate-600 hover:text-slate-900">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-10 text-center text-sm font-semibold">{qty}</span>
                    <button type="button" onClick={() => setQty((prev) => prev + 1)} className="px-3 py-2 text-slate-600 hover:text-slate-900">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={handleBuyNow} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    Beli Sekarang
                  </button>
                  <button type="button" onClick={handleAddToCart} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Tambah ke Keranjang
                  </button>
                </div>

                <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50">
                  <MessageCircle className="h-4 w-4" />
                  Chat Penjual
                </button>

                <BusinessDisclaimerSection businessName={store.business.name} disclaimers={store.business.disclaimers} />

              </div>
            </div>
          </section>

           <div className="mt-6">
          <BusinessStoreHeader business={store.business} />
        </div>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Deskripsi Produk</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {product.excerpt} Paket ini dirancang untuk membantu kamu mendapatkan workflow yang lebih terstruktur
                dengan insight praktis dan eksekusi cepat.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>Update rutin mengikuti trend terbaru.</li>
                <li>Template siap pakai agar implementasi lebih cepat.</li>
                <li>Cocok untuk pemula maupun tim yang sudah berjalan.</li>
              </ul>
            </article>

            <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Spesifikasi Singkat</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Kategori</span>
                  <span className="font-semibold text-slate-800">{product.category}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Merchant</span>
                  <span className="font-semibold text-slate-800">{store.business.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Rating Toko</span>
                  <span className="font-semibold text-slate-800">{businessRating}/5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Terjual</span>
                  <span className="font-semibold text-slate-800">{businessSoldLabel}</span>
                </div>
              </div>
            </aside>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Review Pembeli</h3>
            
            {productReviewStatsLoading ? (
              <p className="mt-4 text-sm text-slate-500">Memuat statistik review...</p>
            ) : productReviewStats && productReviewStats.total_reviews > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
                <div className="flex items-start gap-8">
                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-bold text-amber-600">{productReviewStats.average_rating.toFixed(1)}</div>
                    <div className="mt-1 text-lg text-amber-500">{"★".repeat(Math.round(productReviewStats.average_rating))}</div>
                    <div className="mt-2 text-xs text-slate-600">berdasarkan {productReviewStats.total_reviews} review</div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = productReviewStats.rating_count[stars] || 0;
                      const percentage = productReviewStats.total_reviews > 0 ? (count / productReviewStats.total_reviews) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-8 text-right text-xs font-medium text-slate-600">{stars}★</span>
                          <div className="h-2 w-32 rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs text-slate-600">({count})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
            
            <div className="mt-4 space-y-4">
              {productReviewsLoading ? (
                <p className="text-sm text-slate-500">Memuat review produk...</p>
              ) : productReviews.length > 0 ? (
                productReviews.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    {(() => {
                      const attachments = parseReviewAttachments(review.metadata);
                      return attachments.length > 0 ? (
                        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {attachments.map((attachment, index) => {
                            const publicUrl = resolveAttachmentUrl(attachment);
                            const mimeType = String(attachment.mimeType || attachment.mime_type || "").toLowerCase();
                            const isVideo = mimeType.startsWith("video/");
                            const key = `${attachment.storageKey || attachment.storage_key || publicUrl || index}`;
                            return (
                              <a
                                key={key}
                                href={publicUrl || undefined}
                                target={publicUrl ? "_blank" : undefined}
                                rel={publicUrl ? "noreferrer" : undefined}
                                className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
                              >
                                <div className="relative flex h-28 items-center justify-center bg-slate-100">
                                  {publicUrl ? (
                                    isVideo ? (
                                      <video src={publicUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                    ) : (
                                      <img src={publicUrl} alt={attachment.name || `Lampiran ${index + 1}`} className="h-full w-full object-cover" />
                                    )
                                  ) : (
                                    <div className="px-3 text-center text-xs font-semibold text-slate-500">Lampiran tersedia</div>
                                  )}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                                    {attachment.name || `Lampiran ${index + 1}`}
                                  </div>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Pembeli terverifikasi</p>
                      <p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString("id-ID")}</p>
                    </div>
                    <div className="mt-1 text-sm text-amber-500">{"★".repeat(Math.max(0, Math.min(5, Number(review.rating || 0))))}</div>
                    {review.review_text ? <p className="mt-2 text-sm text-slate-600">{review.review_text}</p> : null}
                    {review.question_text ? (
                      <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        Pertanyaan pembeli: {review.question_text}
                      </div>
                    ) : null}
                    {review.seller_reply ? (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        Balasan penjual: {review.seller_reply}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-500">Belum ada review untuk produk ini.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Produk Terkait</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((item) => (
                <a
                  key={item.id}
                  href={locale ? `/b/${store.business.slug}/p/${item.slug}?locale=${encodeURIComponent(locale)}` : `/b/${store.business.slug}/p/${item.slug}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">{item.category}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.excerpt}</p>
                  <p className="mt-4 text-sm font-bold text-slate-900">{toCurrency(toNumber(item.discounted_price) || toNumber(item.original_price) || toNumber(item.price))}</p>
                </a>
              ))}
            </div>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
