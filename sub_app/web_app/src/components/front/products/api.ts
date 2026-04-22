import type { PublicProductAsset } from "../business/types";
import type { BrowseProductItem, BrowseStoreItem } from "./types";

export type PublicProduct = {
  id: string;
  name?: string;
  slug?: string;
  price?: number;
  sale_price?: number | null;
  stock_status?: string | null;
  business_id?: string | null;
  product_type?: string | null;
  category_ids?: string[];
  gallery?: PublicProductAsset[] | null;
};

export type PublicBusiness = {
  id: string;
  name?: string;
  slug?: string;
  short_description?: string | null;
};

export type PublicSearchResult = {
  entityType: string;
  entityID: string;
  title: string;
  slug: string;
  businessID?: string | null;
  rank: number;
};

type ListResponse<T> = {
  data?: T[];
  total?: number;
};

const STORE_ACCENTS = [
  "text-emerald-700",
  "text-slate-900",
  "text-pink-600",
  "text-lime-700",
  "text-cyan-700",
  "text-emerald-600",
] as const;

const PRODUCT_TONES = [
  "from-lime-100 to-slate-100",
  "from-slate-100 to-zinc-100",
  "from-emerald-50 to-lime-100",
  "from-emerald-100 to-stone-100",
  "from-rose-50 to-stone-100",
  "from-cyan-50 to-slate-100",
] as const;

function getPublicApiBase(): string {
  return import.meta.env.PUBLIC_API_URL
    ? String(import.meta.env.PUBLIC_API_URL).replace(/\/$/, "")
    : "";
}

function buildUrl(path: string): string {
  const base = getPublicApiBase();
  return base ? `${base}${path}` : path;
}

function parseListResponse<T>(value: unknown): T[] {
  const payload = (value || {}) as ListResponse<T>;
  return Array.isArray(payload.data) ? payload.data : [];
}

function toStoreCode(id: string): string {
  return String(id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase() || "STORE";
}

function normalizeCategory(productType?: string | null): string {
  const value = String(productType || "").trim().toLowerCase();
  if (value === "service" || value === "digital") {
    return value;
  }
  return "product";
}

function normalizeAssetUrl(asset: PublicProductAsset): string {
  const apiBase = getPublicApiBase();
  let url = String(asset.public_url || "").trim();
  if (!url && asset.file_path) {
    url = `/assets/${String(asset.file_path).replace(/^\/+/, "")}`;
  }
  if (url.startsWith("/")) {
    return apiBase ? `${apiBase}${url}` : url;
  }
  return url;
}

export interface FetchPublicProductsOptions {
  locale?: string;
  page?: number;
  limit?: number;
  q?: string;
  sku?: string;
  slug?: string;
  stockStatus?: string;
  productType?: string;
  ids?: string[];
  businessIDs?: string[];
  categoryIDs?: string[];
  tagIDs?: string[];
}

export async function fetchPublicProducts(options: FetchPublicProductsOptions = {}): Promise<PublicProduct[]> {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, options.page || 1)));
  query.set("limit", String(Math.min(200, Math.max(1, options.limit || 200))));
  if (options.locale) {
    query.set("locale", options.locale);
  }
  if (options.q) query.set("q", options.q);
  if (options.sku) query.set("sku", options.sku);
  if (options.slug) query.set("slug", options.slug);
  if (options.stockStatus) query.set("stock_status", options.stockStatus);
  if (options.productType) query.set("product_type", options.productType);
  if (options.ids?.length) query.set("ids", options.ids.join(","));
  if (options.businessIDs?.length) query.set("business_ids", options.businessIDs.join(","));
  if (options.categoryIDs?.length) query.set("category_ids", options.categoryIDs.join(","));
  if (options.tagIDs?.length) query.set("tag_ids", options.tagIDs.join(","));

  const res = await fetch(buildUrl(`/api/catalog/products?${query.toString()}`), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch products: HTTP ${res.status}`);
  }

  const payload = await res.json().catch(() => ({}));
  return parseListResponse<PublicProduct>(payload);
}

export async function fetchPublicBusinesses(): Promise<PublicBusiness[]> {
  const query = new URLSearchParams();
  query.set("page", "1");
  query.set("limit", "200");

  const res = await fetch(buildUrl(`/api/catalog/businesses?${query.toString()}`), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch businesses: HTTP ${res.status}`);
  }

  const payload = await res.json().catch(() => ({}));
  return parseListResponse<PublicBusiness>(payload);
}

export async function fetchPublicSearchResults(query: string): Promise<PublicSearchResult[]> {
  const search = new URLSearchParams();
  search.set("q", query);
  search.set("type", "product,business,category");
  search.set("limit", "200");

  const res = await fetch(buildUrl(`/api/search?${search.toString()}`), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to search products: HTTP ${res.status}`);
  }

  const payload = await res.json().catch(() => ({}));
  const rawItems = parseListResponse<Record<string, unknown>>(payload);

  return rawItems
    .map((item) => ({
      entityType: String(item.entity_type || ""),
      entityID: String(item.entity_id || ""),
      title: String(item.title || ""),
      slug: String(item.slug || ""),
      businessID: item.business_id ? String(item.business_id) : undefined,
      rank: Number(item.rank || 0),
    }))
    .filter((item) => item.entityType && item.entityID);
}

export function buildBrowseData(products: PublicProduct[], businesses: PublicBusiness[]): {
  products: BrowseProductItem[];
  stores: BrowseStoreItem[];
} {
  const businessByID = new Map<string, PublicBusiness>();
  for (const business of businesses) {
    if (business?.id) {
      businessByID.set(business.id, business);
    }
  }

  const browseProducts: BrowseProductItem[] = products
    .filter((item) => Boolean(item?.id))
    .map((item, index) => {
      const storeID = item.business_id || "";
      const business = storeID ? businessByID.get(storeID) : undefined;
      const originalPrice = typeof item.price === "number" ? Math.max(0, Number(item.price) || 0) : 0;
      const salePrice = typeof item.sale_price === "number" ? Math.max(0, Number(item.sale_price) || 0) : null;
      const resolvedPrice = typeof item.sale_price === "number"
        ? item.sale_price
        : typeof item.price === "number"
          ? item.price
          : 0;

      return {
        id: item.id,
        slug: String(item.slug || ""),
        name: String(item.name || "Produk"),
        price: Math.max(0, Number(resolvedPrice) || 0),
        originalPrice,
        hasDiscount: salePrice != null && originalPrice > 0 && salePrice < originalPrice,
        stockStatus: String(item.stock_status || "in_stock").trim().toLowerCase() || "in_stock",
        storeId: storeID,
        storeSlug: String(business?.slug || ""),
        storeName: String(business?.name || "Toko"),
        category: normalizeCategory(item.product_type),
        categoryIds: Array.isArray(item.category_ids) ? item.category_ids.filter(Boolean).map(String) : [],
        gallery: Array.isArray(item.gallery)
          ? item.gallery
              .filter((asset) => Boolean(asset?.id))
              .map((asset) => ({
                ...asset,
                id: String(asset.id),
                product_id: asset.product_id ? String(asset.product_id) : undefined,
                file_path: asset.file_path ? String(asset.file_path) : undefined,
                public_url: normalizeAssetUrl(asset) || undefined,
                is_main: Boolean(asset.is_main),
                usage_tag: asset.usage_tag ? String(asset.usage_tag) : undefined,
                display_order: asset.display_order != null ? Number(asset.display_order) : undefined,
              }))
          : undefined,
        tone: PRODUCT_TONES[index % PRODUCT_TONES.length],
      };
    });

  const productCountByStore = new Map<string, number>();
  for (const product of browseProducts) {
    if (!product.storeId) continue;
    productCountByStore.set(product.storeId, (productCountByStore.get(product.storeId) || 0) + 1);
  }

  const browseStores: BrowseStoreItem[] = businesses
    .filter((business) => Boolean(business?.id))
    .map((business, index) => {
      const storeID = business.id;
      return {
        id: storeID,
        slug: String(business.slug || ""),
        name: String(business.name || "Toko"),
        description: String(business.short_description || "Produk pilihan dari toko ini"),
        productCount: productCountByStore.get(storeID) || 0,
        code: toStoreCode(storeID),
        accent: STORE_ACCENTS[index % STORE_ACCENTS.length],
        verified: true,
      };
    });

  return {
    products: browseProducts,
    stores: browseStores,
  };
}
