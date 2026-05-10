export type StoreMaintenanceInfo = {
  index: boolean;
  business_page: boolean;
  product_detail: boolean;
  order_customer_confirmation: boolean;
};

type MaintenanceResponse = {
  data?: Partial<StoreMaintenanceInfo>;
};

function normalizeBool(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function buildUrl(path: string, baseUrl?: string): string {
  const base = String(baseUrl || "").trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

const DEFAULT_CACHE_TTL_MS = 30_000;
let cachedMaintenanceInfo: StoreMaintenanceInfo | null = null;
let cachedMaintenanceExpiresAt = 0;
let pendingMaintenancePromise: Promise<StoreMaintenanceInfo> | null = null;

const DEFAULT_MAINTENANCE_TIMEOUT_MS = 30_000;

async function fetchMaintenanceFromServer(options: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<StoreMaintenanceInfo | null> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_MAINTENANCE_TIMEOUT_MS;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(buildUrl("/api/settings/maintenance", options.baseUrl), {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as MaintenanceResponse;
    const data = payload.data || {};

    return {
      index: normalizeBool(data.index),
      business_page: normalizeBool(data.business_page),
      product_detail: normalizeBool(data.product_detail),
      order_customer_confirmation: normalizeBool(data.order_customer_confirmation),
    };
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchStoreMaintenanceInfo(options: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  cacheTtlMs?: number;
} = {}): Promise<StoreMaintenanceInfo> {
  const now = Date.now();
  const ttlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  if (cachedMaintenanceInfo && now < cachedMaintenanceExpiresAt) {
    return cachedMaintenanceInfo;
  }

  if (pendingMaintenancePromise) {
    return pendingMaintenancePromise;
  }

  pendingMaintenancePromise = (async () => {
    try {
      const info = await fetchMaintenanceFromServer(options);
      if (info) {
        cachedMaintenanceInfo = info;
        cachedMaintenanceExpiresAt = Date.now() + ttlMs;
        return info;
      }

      return {
        index: true,
        business_page: true,
        product_detail: true,
        order_customer_confirmation: false,
      };
    } finally {
      pendingMaintenancePromise = null;
    }
  })();

  return pendingMaintenancePromise;
}
