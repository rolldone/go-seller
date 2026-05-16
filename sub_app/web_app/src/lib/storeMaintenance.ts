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

type MaintenanceErrorDetails = {
  name?: string;
  message?: string;
  stack?: string;
  cause?: unknown;
};

type FetchMaintenanceOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  keys?: readonly StoreMaintenanceKey[];
};

const DEFAULT_MAINTENANCE_INFO: StoreMaintenanceInfo = {
  index: true,
  business_page: true,
  product_detail: true,
  order_customer_confirmation: false,
};

const DEFAULT_MAINTENANCE_KEYS: StoreMaintenanceKey[] = [
  "index",
  "business_page",
  "product_detail",
  "order_customer_confirmation",
];

function normalizeBool(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
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

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

const maintenanceCache = new Map<StoreMaintenanceKey, CacheEntry>();
const pendingMaintenanceRequests = new Map<string, Promise<void>>();

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
    index: normalizeBool(data.index, DEFAULT_MAINTENANCE_INFO.index),
    business_page: normalizeBool(data.business_page, DEFAULT_MAINTENANCE_INFO.business_page),
    product_detail: normalizeBool(data.product_detail, DEFAULT_MAINTENANCE_INFO.product_detail),
    order_customer_confirmation: normalizeBool(
      data.order_customer_confirmation,
      DEFAULT_MAINTENANCE_INFO.order_customer_confirmation,
    ),
  };
}

function readCachedMaintenanceValue(key: StoreMaintenanceKey, now: number): boolean | undefined {
  const cached = maintenanceCache.get(key);
  if (!cached || now >= cached.expiresAt) {
    return undefined;
  }

  return cached.value;
}

function snapshotMaintenanceValues(keys: readonly StoreMaintenanceKey[], now: number): Partial<StoreMaintenanceInfo> {
  const snapshot: Partial<StoreMaintenanceInfo> = {};

  for (const key of keys) {
    const cachedValue = readCachedMaintenanceValue(key, now);
    if (cachedValue !== undefined) {
      snapshot[key] = cachedValue;
    }
  }

  return snapshot;
}

function describeMaintenanceError(error: unknown): MaintenanceErrorDetails {
  if (error instanceof Error) {
    const details: MaintenanceErrorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      details.cause = cause;
    }

    return details;
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

function isRetryableMaintenanceError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause as
      | { code?: string; errors?: Array<{ code?: string }> }
      | undefined;

    if (cause?.code === "ETIMEDOUT" || cause?.code === "ECONNRESET" || cause?.code === "EAI_AGAIN") {
      return true;
    }

    if (Array.isArray(cause?.errors)) {
      return cause.errors.some((item) => item.code === "ETIMEDOUT" || item.code === "ECONNRESET" || item.code === "EAI_AGAIN");
    }
  }

  return false;
}

function hasMaintenanceErrorCode(error: unknown, code: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause as
    | { code?: string; errors?: Array<{ code?: string }> }
    | undefined;

  if (cause?.code === code) {
    return true;
  }

  return Array.isArray(cause?.errors) ? cause.errors.some((item) => item.code === code) : false;
}

function buildSimulatedMaintenanceResponse(keys: readonly StoreMaintenanceKey[]): MaintenanceResponse {
  const data: Partial<StoreMaintenanceInfo> = {};

  for (const key of keys) {
    data[key] = false;
  }

  return { data };
}

async function fetchMaintenanceFromServer(options: FetchMaintenanceOptions = {}): Promise<StoreMaintenanceInfo | null> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_MAINTENANCE_TIMEOUT_MS;
  const keys = normalizeKeys(options.keys);
  const keyParam = keys.join(",");
  const apiBase = resolveApiBase();
  const requestUrl = buildUrl(`/api/settings/maintenance?keys=${encodeURIComponent(keyParam)}`, apiBase);

  console.log("Fetching maintenance info with keys:", keyParam);
  console.log("Using API base URL:", apiBase);
  console.log("Maintenance request URL:", requestUrl);

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(requestUrl, {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    if (!response.ok) {
      const responseBody = await response.clone().text().catch(() => "");
      console.error("Maintenance API returned non-OK response", {
        requestUrl,
        keys,
        status: response.status,
        statusText: response.statusText,
        responseBody,
      });

      return null;
    }

    const payload = (await response.json().catch((parseError: unknown) => {
      console.error("Failed to parse maintenance API response JSON", {
        requestUrl,
        keys,
        error: describeMaintenanceError(parseError),
      });
      return null;
    })) as MaintenanceResponse | null;

    console.log("Received maintenance API response", {
      requestUrl,
      keys,
      payload,
    });

    if (!payload) {
      return null;
    }

    const data = payload.data || {};

    return normalizeMaintenancePayload(data);
  } catch (error: unknown) {
    const isTimedOut = hasMaintenanceErrorCode(error, "ETIMEDOUT");

    if (isTimedOut) {
      const simulatedResponse = buildSimulatedMaintenanceResponse(keys);
      console.warn("Received maintenance API response", {
        requestUrl,
        keys,
        simulated: true,
        payload: simulatedResponse,
      });

      const data = simulatedResponse.data || {};

      return normalizeMaintenancePayload(data);
    }

    console.error("Error fetching maintenance info", {
      requestUrl,
      keys,
      timeoutMs,
      aborted: error instanceof DOMException ? error.name === "AbortError" : false,
      retryable: isRetryableMaintenanceError(error),
      error: describeMaintenanceError(error),
    });

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
  const cachedValues = snapshotMaintenanceValues(keys, now);
  const missingKeys = keys.filter((key) => cachedValues[key] === undefined);

  if (missingKeys.length === 0) {
    return normalizeMaintenancePayload(cachedValues);
  }

  const cacheKey = signatureForKeys(missingKeys);

  const pending = pendingMaintenanceRequests.get(cacheKey);
  if (pending) {
    await pending;
    return normalizeMaintenancePayload(snapshotMaintenanceValues(keys, Date.now()));
  }

  const pendingPromise = (async () => {
    try {
      const info = await fetchMaintenanceFromServer({ ...options, keys: missingKeys });
      if (info) {
        const expiresAt = Date.now() + ttlMs;
        for (const key of missingKeys) {
          maintenanceCache.set(key, {
            value: info[key] ?? DEFAULT_MAINTENANCE_INFO[key],
            expiresAt,
          });
        }
      }
    } finally {
      pendingMaintenanceRequests.delete(cacheKey);
    }
  })();

  pendingMaintenanceRequests.set(cacheKey, pendingPromise);
  await pendingPromise;

  return normalizeMaintenancePayload(snapshotMaintenanceValues(keys, Date.now()));
}
