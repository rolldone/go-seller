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
  description_html?: string | null;
  short_description?: string | null;
  sort_priority?: number;
};

const API_PAGE_SIZE = 100;

type CategoryPageResult = {
  notFound: boolean;
  category: PublicCategory | null;
  childCategories: PublicCategory[];
  ancestors: PublicCategory[];
  products: ReturnType<typeof buildBrowseData>["products"];
  page: number;
  totalPages: number;
  totalProducts: number;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getApiBase(): string {
  const raw = import.meta.env.PUBLIC_API_URL;
  if (!raw) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }
  const publicApiUrl = String(raw).trim();
  return trimTrailingSlash(publicApiUrl);
}

function buildApiUrl(path: string): string {
  return `${getApiBase()}${path}`;
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

function buildPagedUrl(
  path: string,
  requestOrigin: string,
  page: number,
  limit: number,
  extraParams?: Record<string, string>,
): string {
  const url = new URL(buildApiUrl(path));
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  for (const [key, value] of Object.entries(extraParams || {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  console.info(`[categoryPageData] fetch ${url}`);
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    console.warn(`[categoryPageData] fetch failed ${response.status} ${url}`);
    throw new Error(`Failed to fetch: HTTP ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

async function fetchAllListItems<T>(fetchImpl: typeof fetch, makeUrl: (page: number, limit: number) => string): Promise<T[]> {
  const firstPayload = await fetchJson(fetchImpl, makeUrl(1, API_PAGE_SIZE));
  const firstPage = parseListResponse<T>(firstPayload);
  const total = Math.max(0, Number(firstPage.total) || firstPage.data.length);
  const totalPages = Math.max(1, Math.ceil(total / API_PAGE_SIZE));
  const items = [...firstPage.data];

  for (let page = 2; page <= totalPages; page += 1) {
    if (items.length >= total) {
      break;
    }
    const payload = await fetchJson(fetchImpl, makeUrl(page, API_PAGE_SIZE));
    const parsedPage = parseListResponse<T>(payload);
    if (!parsedPage.data.length) {
      break;
    }
    items.push(...parsedPage.data);
  }

  return items;
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

  const allCategories = await fetchAllListItems<PublicCategory>(fetchImpl, (nextPage, limit) => {
    return buildPagedUrl("/api/catalog/categories", options.requestOrigin, nextPage, limit, { locale });
  });

  console.info(`[categoryPageData] loaded ${allCategories.length} categories for slug=${slug}`);

  const activeCategory = allCategories.find((item) => String(item.slug || "").trim().toLowerCase() === slug) || null;

  if (!activeCategory) {
    console.warn(`[categoryPageData] category not found for slug=${slug}`);
    return {
      notFound: true,
      category: null,
      childCategories: [],
      ancestors: [],
      products: [],
      page,
      totalPages: 1,
      totalProducts: 0,
    };
  }

  // build ancestor chain from root -> ... -> active
  const ancestors: PublicCategory[] = [];
  try {
    let parentId = String(activeCategory.parent_id || "").trim();
    const seen = new Set<string>();
    const stack: PublicCategory[] = [];
    while (parentId) {
      const parent = allCategories.find((it) => String(it.id) === parentId);
      if (!parent) break;
      if (seen.has(parent.id)) break;
      stack.push(parent);
      seen.add(parent.id);
      parentId = String(parent.parent_id || "").trim();
    }
    // stack currently has parents from immediate parent -> root, reverse to root->...->parent
    stack.reverse();
    ancestors.push(...stack);
    // include active category as last crumb
    ancestors.push(activeCategory);
  } catch (e) {
    // ignore
  }

  const childCategories = sortCategories(
    allCategories.filter((item) => String(item.parent_id || "").trim() === activeCategory.id),
  );
  const categoryIDs = collectDescendantCategoryIDs(activeCategory.id, allCategories);

  console.info(
    `[categoryPageData] matched category id=${activeCategory.id} slug=${String(activeCategory.slug || "")}, child=${childCategories.length}, descendants=${categoryIDs.length}`,
  );

  // Fetch only the requested page of products from the public API (server-side pagination)
  // If the active category is a root (no parent), do not send category filter so
  // the page returns all products; filtering will apply only when users select subcategory checkboxes.
  const productExtraParams: Record<string, string> = { locale };
  if (String(activeCategory.parent_id || "").trim()) {
    productExtraParams.category_ids = categoryIDs.join(",");
  }

  console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  
  const productsPayload = await fetchJson(
    fetchImpl,
    buildPagedUrl(
      "/api/catalog/products",
      options.requestOrigin,
      page,
      perPage,
      productExtraParams,
    ),
  );

  console.log("[categoryPageData] fetched products for category, payload:", productsPayload);

  const parsedProducts = parseListResponse<PublicProduct>(productsPayload);
  const pageProducts = parsedProducts.data;
  const totalProducts = Math.max(0, Number(parsedProducts.total) || pageProducts.length);

  const allBusinesses = await fetchAllListItems<PublicBusiness>(fetchImpl, (nextPage, limit) => {
    return buildPagedUrl("/api/catalog/businesses", options.requestOrigin, nextPage, limit);
  });

  const browseProducts = buildBrowseData(pageProducts, allBusinesses).products;
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));

  return {
    notFound: false,
    category: activeCategory,
    childCategories,
    ancestors,
    products: browseProducts,
    page: Math.min(page, totalPages),
    totalPages,
    totalProducts,
  };
}

export async function fetchRootCategories(options: { fetchImpl?: typeof fetch; locale?: string }) {
  const fetchImpl = options.fetchImpl || fetch;
  const locale = String(options.locale || "id").trim() || "id";

  const allCategories = await fetchAllListItems<PublicCategory>(fetchImpl, (nextPage, limit) => {
    return buildPagedUrl("/api/catalog/categories", "", nextPage, limit, { locale });
  });

  const roots = sortCategories(allCategories.filter((item) => !String(item.parent_id || "").trim()));
  console.info(`[categoryPageData] loaded ${allCategories.length} categories, roots=${roots.length}`);
  return roots;
}
