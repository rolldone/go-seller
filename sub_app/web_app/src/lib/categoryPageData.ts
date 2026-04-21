import { buildBrowseData, type PublicBusiness, type PublicProduct } from "../components/front/products/api";

type ListResponse<T> = {
  data?: T[];
  total?: number;
};

type PublicCategory = {
  id: string;
  parent_id?: string | null;
  name?: string;
  slug?: string;
  sort_priority?: number;
};

type CategoryPageResult = {
  notFound: boolean;
  category: PublicCategory | null;
  childCategories: PublicCategory[];
  products: ReturnType<typeof buildBrowseData>["products"];
  page: number;
  totalPages: number;
  totalProducts: number;
};

const MOCK_CATEGORIES: PublicCategory[] = [
  { id: "cat-elektronik", name: "Elektronik", slug: "elektronik", sort_priority: 1 },
  { id: "cat-gadget", parent_id: "cat-elektronik", name: "Gadget", slug: "gadget", sort_priority: 1 },
  { id: "cat-audio", parent_id: "cat-elektronik", name: "Audio", slug: "audio", sort_priority: 2 },
  { id: "cat-smartphone", parent_id: "cat-elektronik", name: "Smartphone", slug: "smartphone", sort_priority: 3 },
  { id: "cat-laptop", parent_id: "cat-elektronik", name: "Laptop", slug: "laptop", sort_priority: 4 },
  { id: "cat-camera", parent_id: "cat-elektronik", name: "Kamera", slug: "kamera", sort_priority: 5 },
  { id: "cat-accessories", parent_id: "cat-elektronik", name: "Aksesori", slug: "aksesori", sort_priority: 6 },
  { id: "cat-tv", parent_id: "cat-elektronik", name: "Televisi", slug: "televisi", sort_priority: 7 },
  { id: "cat-wearable", parent_id: "cat-elektronik", name: "Wearable", slug: "wearable", sort_priority: 8 },
  { id: "cat-gaming", parent_id: "cat-elektronik", name: "Gaming", slug: "gaming", sort_priority: 9 },
  { id: "cat-peripheral", parent_id: "cat-elektronik", name: "Peripheral", slug: "peripheral", sort_priority: 10 },

  { id: "cat-rumah", name: "Rumah Tangga", slug: "rumah-tangga", sort_priority: 2 },
  { id: "cat-dapur", parent_id: "cat-rumah", name: "Peralatan Dapur", slug: "peralatan-dapur", sort_priority: 1 },
  { id: "cat-kebersihan", parent_id: "cat-rumah", name: "Kebersihan", slug: "kebersihan", sort_priority: 2 },
  { id: "cat-dekorasi", parent_id: "cat-rumah", name: "Dekorasi", slug: "dekorasi", sort_priority: 3 },
  { id: "cat-kamar", parent_id: "cat-rumah", name: "Perabot Kamar", slug: "perabot-kamar", sort_priority: 4 },

  { id: "cat-olahraga", name: "Olahraga", slug: "olahraga", sort_priority: 3 },
  { id: "cat-fitness", parent_id: "cat-olahraga", name: "Fitness", slug: "fitness", sort_priority: 1 },
  { id: "cat-outdoor", parent_id: "cat-olahraga", name: "Outdoor Gear", slug: "outdoor-gear", sort_priority: 2 },
  { id: "cat-team-sport", parent_id: "cat-olahraga", name: "Team Sport", slug: "team-sport", sort_priority: 3 },
];

const MOCK_BUSINESSES: PublicBusiness[] = [
  { id: "biz-tech", name: "TechHub Store", slug: "techhub-store", short_description: "Pusat gadget harian" },
  { id: "biz-home", name: "HomeLiving", slug: "homeliving", short_description: "Perlengkapan rumah terpilih" },
  { id: "biz-sport", name: "ActiveFit", slug: "activefit", short_description: "Kebutuhan olahraga" },
];

const MOCK_PRODUCTS: PublicProduct[] = [
  { id: "prd-1", name: "Smartwatch Pulse X", slug: "smartwatch-pulse-x", price: 799000, sale_price: 699000, stock_status: "in_stock", business_id: "biz-tech", category_ids: ["cat-gadget"] },
  { id: "prd-2", name: "Wireless Earbuds Nova", slug: "wireless-earbuds-nova", price: 459000, stock_status: "out_of_stock", business_id: "biz-tech", category_ids: ["cat-audio"] },
  { id: "prd-3", name: "Bluetooth Speaker Mini", slug: "bluetooth-speaker-mini", price: 389000, stock_status: "in_stock", business_id: "biz-tech", category_ids: ["cat-audio"] },
  { id: "prd-4", name: "Air Fryer 5L", slug: "air-fryer-5l", price: 999000, sale_price: 919000, stock_status: "in_stock", business_id: "biz-home", category_ids: ["cat-dapur"] },
  { id: "prd-5", name: "Pisau Chef Premium", slug: "pisau-chef-premium", price: 249000, stock_status: "in_stock", business_id: "biz-home", category_ids: ["cat-dapur"] },
  { id: "prd-6", name: "Vacuum Cleaner Compact", slug: "vacuum-cleaner-compact", price: 1250000, stock_status: "out_of_stock", business_id: "biz-home", category_ids: ["cat-kebersihan"] },
  { id: "prd-7", name: "Yoga Mat Pro", slug: "yoga-mat-pro", price: 219000, sale_price: 199000, stock_status: "in_stock", business_id: "biz-sport", category_ids: ["cat-fitness"] },
  { id: "prd-8", name: "Adjustable Dumbbell 20kg", slug: "adjustable-dumbbell-20kg", price: 1499000, stock_status: "in_stock", business_id: "biz-sport", category_ids: ["cat-fitness"] },
  { id: "prd-9", name: "Resistance Band Set", slug: "resistance-band-set", price: 149000, stock_status: "in_stock", business_id: "biz-sport", category_ids: ["cat-fitness"] },
  { id: "prd-10", name: "Tablet Belajar 10 inch", slug: "tablet-belajar-10-inch", price: 2399000, stock_status: "in_stock", business_id: "biz-tech", category_ids: ["cat-gadget"] },
  { id: "prd-11", name: "Smart Lamp WiFi", slug: "smart-lamp-wifi", price: 179000, sale_price: 149000, stock_status: "in_stock", business_id: "biz-tech", category_ids: ["cat-elektronik"] },
  { id: "prd-12", name: "Rak Sepatu Minimalis", slug: "rak-sepatu-minimalis", price: 299000, stock_status: "in_stock", business_id: "biz-home", category_ids: ["cat-rumah"] },
];

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getApiBase(requestOrigin: string): string {
  const envBase = String((import.meta as any)?.env?.PUBLIC_API_URL || "").trim();
  if (envBase) {
    return trimTrailingSlash(envBase);
  }
  return trimTrailingSlash(requestOrigin);
}

function buildApiUrl(path: string, requestOrigin: string): string {
  return `${getApiBase(requestOrigin)}${path}`;
}

function parseListResponse<T>(payload: unknown): { data: T[]; total: number } {
  const parsed = (payload || {}) as ListResponse<T>;
  return {
    data: Array.isArray(parsed.data) ? parsed.data : [],
    total: Math.max(0, Number(parsed.total) || 0),
  };
}

function sortCategories(items: PublicCategory[]): PublicCategory[] {
  return [...items].sort((left, right) => {
    const leftPriority = Number(left.sort_priority || 0);
    const rightPriority = Number(right.sort_priority || 0);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function buildResultFromStaticData(options: {
  slug: string;
  page: number;
  perPage: number;
  categories: PublicCategory[];
  products: PublicProduct[];
  businesses: PublicBusiness[];
}): CategoryPageResult {
  const activeCategory = options.categories.find((item) => String(item.slug || "").trim().toLowerCase() === options.slug) || null;

  if (!activeCategory) {
    return {
      notFound: true,
      category: null,
      childCategories: [],
      products: [],
      page: options.page,
      totalPages: 1,
      totalProducts: 0,
    };
  }

  const childCategories = sortCategories(
    options.categories.filter((item) => String(item.parent_id || "").trim() === activeCategory.id),
  );

  const categoryIDs = collectDescendantCategoryIDs(activeCategory.id, options.categories);
  const filteredProducts = options.products.filter((item) => {
    const productCategoryIDs = Array.isArray(item.category_ids) ? item.category_ids : [];
    return productCategoryIDs.some((id) => categoryIDs.includes(String(id)));
  });

  const browseProducts = buildBrowseData(filteredProducts, options.businesses).products;
  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / options.perPage));

  return {
    notFound: false,
    category: activeCategory,
    childCategories,
    products: browseProducts,
    page: Math.min(options.page, totalPages),
    totalPages,
    totalProducts,
  };
}

function buildMockCategoryPageResult(slug: string, page: number, perPage: number): CategoryPageResult {
  return buildResultFromStaticData({
    slug,
    page,
    perPage,
    categories: MOCK_CATEGORIES,
    products: MOCK_PRODUCTS,
    businesses: MOCK_BUSINESSES,
  });
}

function collectDescendantCategoryIDs(rootID: string, categories: PublicCategory[]): string[] {
  const childrenByParent = new Map<string, string[]>();

  for (const item of categories) {
    const parentID = String(item.parent_id || "").trim();
    if (!parentID) continue;
    const next = childrenByParent.get(parentID) || [];
    next.push(item.id);
    childrenByParent.set(parentID, next);
  }

  const visited = new Set<string>();
  const queue = [rootID];

  while (queue.length > 0) {
    const currentID = queue.shift();
    if (!currentID || visited.has(currentID)) continue;
    visited.add(currentID);
    for (const childID of childrenByParent.get(currentID) || []) {
      if (!visited.has(childID)) {
        queue.push(childID);
      }
    }
  }

  return Array.from(visited);
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch: HTTP ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

export async function fetchCategoryPageData(options: {
  requestOrigin: string;
  locale: string;
  slug: string;
  page?: number;
  perPage?: number;
  fetchImpl?: typeof fetch;
}): Promise<CategoryPageResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const locale = String(options.locale || "id").trim() || "id";
  const slug = String(options.slug || "").trim().toLowerCase();
  const perPage = Math.min(48, Math.max(1, Number(options.perPage) || 12));
  const page = Math.max(1, Number(options.page) || 1);

  try {
    const categoryParams = new URLSearchParams();
    categoryParams.set("page", "1");
    categoryParams.set("limit", "500");
    categoryParams.set("locale", locale);

    const categoriesPayload = await fetchJson(
      fetchImpl,
      buildApiUrl(`/api/catalog/categories?${categoryParams.toString()}`, options.requestOrigin),
    );

    const allCategories = parseListResponse<PublicCategory>(categoriesPayload).data;
    const activeCategory = allCategories.find((item) => String(item.slug || "").trim().toLowerCase() === slug) || null;

    if (!activeCategory) {
      return buildMockCategoryPageResult(slug, page, perPage);
    }

    const childCategories = sortCategories(
      allCategories.filter((item) => String(item.parent_id || "").trim() === activeCategory.id),
    );

    const categoryIDs = collectDescendantCategoryIDs(activeCategory.id, allCategories);

    const productsParams = new URLSearchParams();
    productsParams.set("page", "1");
    productsParams.set("limit", "200");
    productsParams.set("locale", locale);
    productsParams.set("category_ids", categoryIDs.join(","));

    const businessesParams = new URLSearchParams();
    businessesParams.set("page", "1");
    businessesParams.set("limit", "200");

    const [productsPayload, businessesPayload] = await Promise.all([
      fetchJson(fetchImpl, buildApiUrl(`/api/catalog/products?${productsParams.toString()}`, options.requestOrigin)),
      fetchJson(fetchImpl, buildApiUrl(`/api/catalog/businesses?${businessesParams.toString()}`, options.requestOrigin)),
    ]);

    const parsedProducts = parseListResponse<PublicProduct>(productsPayload);
    const parsedBusinesses = parseListResponse<PublicBusiness>(businessesPayload);
    const browseProducts = buildBrowseData(parsedProducts.data || [], parsedBusinesses.data || []).products;

    const totalProducts = browseProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));

    return {
      notFound: false,
      category: activeCategory,
      childCategories,
      products: browseProducts,
      page,
      totalPages,
      totalProducts,
    };
  } catch {
    return buildMockCategoryPageResult(slug, page, perPage);
  }
}
