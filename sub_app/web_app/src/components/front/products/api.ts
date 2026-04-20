import type { BrowseProductItem, BrowseStoreItem } from "./types";

export type PublicProduct = {
  id: string;
  name?: string;
  price?: number;
  sale_price?: number | null;
  business_id?: string | null;
  product_type?: string | null;
};

export type PublicBusiness = {
  id: string;
  name?: string;
  short_description?: string | null;
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
  return (import.meta as any)?.env?.PUBLIC_API_URL
    ? String((import.meta as any).env.PUBLIC_API_URL).replace(/\/$/, "")
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

export async function fetchPublicProducts(locale?: string): Promise<PublicProduct[]> {
  const query = new URLSearchParams();
  query.set("page", "1");
  query.set("limit", "200");
  if (locale) {
    query.set("locale", locale);
  }

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
      const resolvedPrice = typeof item.sale_price === "number"
        ? item.sale_price
        : typeof item.price === "number"
          ? item.price
          : 0;

      return {
        id: item.id,
        name: String(item.name || "Produk"),
        price: Math.max(0, Number(resolvedPrice) || 0),
        storeId: storeID,
        storeName: String(business?.name || "Toko"),
        category: normalizeCategory(item.product_type),
        tone: PRODUCT_TONES[index % PRODUCT_TONES.length],
      };
    });

  const productCountByStore = new Map<string, number>();
  for (const product of browseProducts) {
    if (!product.storeId) continue;
    productCountByStore.set(product.storeId, (productCountByStore.get(product.storeId) || 0) + 1);
  }

  const browseStores: BrowseStoreItem[] = Array.from(productCountByStore.entries()).map(([storeID, productCount], index) => {
    const business = businessByID.get(storeID);
    return {
      id: storeID,
      name: String(business?.name || "Toko"),
      description: String(business?.short_description || "Produk pilihan dari toko ini"),
      productCount,
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
