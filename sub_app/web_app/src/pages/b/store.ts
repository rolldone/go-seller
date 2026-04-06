import type { PublicBusinessStore } from "../../components/front/business/types";

type BuildBusinessStoreResult = { store: PublicBusinessStore; fetchErrorMessage: string };

const BASE = import.meta.env.PUBLIC_API_URL || "http://localhost:8080";

async function fetchBusinessData(slug: string) {
  let payload: any = null;
  let fetchErrorMessage = "";

  try {
    const res = await fetch(`${BASE}/b/${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" } });
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
  return {
    ...business,
    slug: business.slug || slug,
    assets: resolvedAssets,
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
      show_contact_email: true,
      show_phone: true,
    },
    products: [],
    reviewSummary: null,
    reviews: [],
  };
}

function normalizeProducts(payload: any) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return products.map((p: any) => ({
    ...p,
    title: p?.title || p?.name || "",
    category: p?.category || "",
    excerpt: p?.excerpt || "",
    slug: p?.slug || "",
    id: p?.id || "",
  }));
}

export async function buildBusinessStore(slug: string): Promise<BuildBusinessStoreResult> {
  const { payload, fetchErrorMessage } = await fetchBusinessData(slug);
  const business = normalizeBusinessPayload(slug, payload);

  if (!business) {
    return { store: buildFallbackStore(slug), fetchErrorMessage };
  }

  const store: PublicBusinessStore = {
    business,
    products: normalizeProducts(payload),
    reviewSummary: null,
    reviews: [],
  };

  return { store, fetchErrorMessage };
}
