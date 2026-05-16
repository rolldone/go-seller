export type StoreMaintenanceInfo = {
  index: boolean;
  business_page: boolean;
  product_detail: boolean;
  order_customer_confirmation: boolean;
};

export type StoreMaintenanceKey = keyof StoreMaintenanceInfo;

type MaintenanceResponse = {
  data?: Partial<StoreMaintenanceInfo>;
};

function normalizeBool(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function buildUrl(path: string, baseUrl: string): string {
  const base = String(baseUrl || "").trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

function resolveApiBase(): string {
  const envBase = String(import.meta.env.PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (!envBase) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }

  return envBase;
}

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAINTENANCE_KEYS: StoreMaintenanceKey[] = [
  "index",
  "business_page",
  "product_detail",
  "order_customer_confirmation",
];

type CacheEntry = {
  info: StoreMaintenanceInfo;
  expiresAt: number;
};

const maintenanceCache = new Map<string, CacheEntry>();
const pendingMaintenanceRequests = new Map<string, Promise<StoreMaintenanceInfo>>();

const DEFAULT_MAINTENANCE_TIMEOUT_MS = 30_000;

function normalizeKeys(keys?: readonly StoreMaintenanceKey[]): StoreMaintenanceKey[] {
  const input = Array.isArray(keys) && keys.length > 0 ? keys : DEFAULT_MAINTENANCE_KEYS;
  const unique = new Set<StoreMaintenanceKey>();
  for (const key of input) {
    unique.add(key);
  }
  return Array.from(unique);
}

function signatureForKeys(keys: readonly StoreMaintenanceKey[]): string {
  return [...keys].sort().join(",");
}

function normalizeMaintenancePayload(data: Partial<StoreMaintenanceInfo>): StoreMaintenanceInfo {
  return {
    index: normalizeBool(data.index),
    business_page: normalizeBool(data.business_page),
    product_detail: normalizeBool(data.product_detail),
    order_customer_confirmation: normalizeBool(data.order_customer_confirmation),
  };
}

async function fetchMaintenanceFromServer(options: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  keys?: readonly StoreMaintenanceKey[];
} = {}): Promise<StoreMaintenanceInfo | null> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_MAINTENANCE_TIMEOUT_MS;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  const keys = normalizeKeys(options.keys);
  const keyParam = keys.join(",");
  const apiBase = resolveApiBase();

  console.log("Fetching maintenance info with keys:", keyParam);
  console.log("Using API base URL:", apiBase);

  try {
    const response = await fetchImpl(buildUrl(`/api/settings/maintenance?keys=${encodeURIComponent(keyParam)}`, apiBase), {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    console.log("Maintenance API response status:", response.status);

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as MaintenanceResponse;
    const data = payload.data || {};

    return normalizeMaintenancePayload(data);
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchStoreMaintenanceInfo(options: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  cacheTtlMs?: number;
  keys?: readonly StoreMaintenanceKey[];
} = {}): Promise<StoreMaintenanceInfo> {
  const now = Date.now();
  const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const keys = normalizeKeys(options.keys);
  const cacheKey = signatureForKeys(keys);

  const cached = maintenanceCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.info;
  }

  const pending = pendingMaintenanceRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const pendingPromise = (async () => {
    try {
      const info = await fetchMaintenanceFromServer({ ...options, keys });
      if (info) {
        maintenanceCache.set(cacheKey, { info, expiresAt: Date.now() + ttlMs });
        return info;
      }

      return normalizeMaintenancePayload({
        index: true,
        business_page: true,
        product_detail: true,
        order_customer_confirmation: false,
      });
    } finally {
      pendingMaintenanceRequests.delete(cacheKey);
    }
  })();

  pendingMaintenanceRequests.set(cacheKey, pendingPromise);
  return pendingPromise;
}
