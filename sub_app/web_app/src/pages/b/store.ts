import type { PublicBusinessCarousel, PublicBusinessReview, PublicBusinessReviewSummary, PublicBusinessStore } from "../../components/front/business/types";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout";

type BuildBusinessStoreResult = { store: PublicBusinessStore; fetchErrorMessage: string };

type ReviewBundlePayload = {
  summary?: PublicBusinessReviewSummary | null;
  reviews?: PublicBusinessReview[] | null;
};

const BASE = import.meta.env.PUBLIC_API_URL || "http://localhost:8080";

async function fetchBusinessData(slug: string, locale?: string) {
  let payload: any = null;
  let fetchErrorMessage = "";

  try {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    const res = await fetchWithTimeout(`${BASE}/b/${encodeURIComponent(slug)}${query}`, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      fetchErrorMessage = `HTTP ${res.status} ${res.statusText}`;
    } else {
      payload = await res.json();
    }
  } catch (err) {
    fetchErrorMessage = err instanceof Error ? err.message : String(err);
  }

  return { payload, fetchErrorMessage };
}

function normalizeBusinessPayload(slug: string, payload: any) {
  const business = payload ? payload.data || payload : null;
  if (!business) return null;
  const resolvedAssets = business.assets || payload?.assets || [];
  const resolvedDisclaimers = business.disclaimers || payload?.disclaimers || [];
  return {
    ...business,
    slug: business.slug || slug,
    assets: resolvedAssets,
    disclaimers: resolvedDisclaimers,
  };
}

function buildFallbackStore(slug: string): PublicBusinessStore {
  return {
    business: {
      id: "",
      name: "",
      slug,
      short_description: "",
      description: "",
      assets: [],
      disclaimers: [],
      show_contact_email: true,
      show_phone: true,
    },
    products: [],
    reviewSummary: null,
    reviews: [],
    carousels: [],
  };
}

function normalizeProducts(payload: any) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return products.map((p: any) => {
    const gallery = Array.isArray(p?.gallery) ? p.gallery : Array.isArray(p?.assets) ? p.assets : [];
    const rawDescription = p?.description || p?.description_plain || p?.description_html || p?.long_description || "";
    const descriptionHtml = p?.description_html || (typeof p?.description === "string" && /<[^>]+>/.test(p.description) ? p.description : null) || null;
    const descriptionPlain = p?.description_plain || (typeof p?.description === "string" ? p.description.replace(/<[^>]+>/g, "") : undefined) || p?.excerpt || "";

    return {
      ...p,
      title: p?.title || p?.name || "",
      category: p?.category || "",
      excerpt: p?.excerpt || "",
      slug: p?.slug || "",
      id: p?.id || "",
      price: p?.price ?? p?.original_price ?? p?.price,
      original_price: p?.original_price ?? p?.originalPrice ?? null,
      discounted_price: p?.discounted_price ?? p?.discountedPrice ?? null,
      gallery,
      description: rawDescription,
      description_html: descriptionHtml,
      description_plain: descriptionPlain,
    };
  });
}

function normalizeCarouselItems(items: any): Array<{ id: string; title: string; subtitle?: string; image?: string; href?: string }> {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      id: String(item?.id || `carousel-item-${index}`),
      title: String(item?.title || ""),
      subtitle: item?.subtitle ? String(item.subtitle) : undefined,
      image: item?.image ? String(item.image) : undefined,
      href: item?.href ? String(item.href) : undefined,
    }))
    .filter((item) => Boolean(item.image || item.title.trim() || item.subtitle || item.href));
}

async function loadBusinessCarousels(businessId: string) {
  if (!businessId) return [];

  try {
    const res = await fetchWithTimeout(`${BASE}/api/marketing/business-carousels?business_id=${encodeURIComponent(businessId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return [];
    }
    const payload = await res.json().catch(() => ({}));
    const rows: PublicBusinessCarousel[] = Array.isArray(payload?.data) ? payload.data : [];
    return rows
      .filter((row) => row.isActive !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((row: PublicBusinessCarousel) => ({
        id: row.id,
        businessId: row.businessId,
        slot: row.slot,
        title: row.title,
        subtitle: row.subtitle || null,
        layoutType: row.layoutType as "large" | "medium" | "banner",
        isActive: row.isActive ?? true,
        sortOrder: Number(row.sortOrder || 0),
        items: normalizeCarouselItems(row.items),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  } catch {
    return [];
  }
}

async function loadBusinessReviews(businessId: string) {
  if (!businessId) {
    return {
      summary: null,
      reviews: [],
    };
  }

  try {
    const res = await fetchWithTimeout(`${BASE}/api/review/businesses/${encodeURIComponent(businessId)}?limit=100`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        summary: null,
        reviews: [],
      };
    }

    const payload = (await res.json().catch(() => ({}))) as { data?: ReviewBundlePayload };
    return {
      summary: payload?.data?.summary ?? null,
      reviews: Array.isArray(payload?.data?.reviews) ? payload.data.reviews : [],
    };
  } catch {
    return {
      summary: null,
      reviews: [],
    };
  }
}

export async function buildBusinessStore(slug: string, locale?: string): Promise<BuildBusinessStoreResult> {
  const { payload, fetchErrorMessage } = await fetchBusinessData(slug, locale);
  const business = normalizeBusinessPayload(slug, payload);

  if (!business) {
    return { store: buildFallbackStore(slug), fetchErrorMessage };
  }

  const store: PublicBusinessStore = {
    business,
    products: normalizeProducts(payload),
    reviewSummary: null,
    reviews: [],
    carousels: await loadBusinessCarousels(business.id),
  };

  const reviewBundle = await loadBusinessReviews(business.id);
  store.reviewSummary = reviewBundle.summary;
  store.reviews = reviewBundle.reviews;

  return { store, fetchErrorMessage };
}
