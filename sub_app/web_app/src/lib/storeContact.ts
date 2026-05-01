export type StoreContactInfo = {
  storeName: string;
  address: string;
  phone: string;
  email: string;
};

type ContactResponse = {
  data?: {
    store_name?: unknown;
    address?: unknown;
    phone?: unknown;
    email?: unknown;
  };
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildUrl(path: string, baseUrl?: string): string {
  const base = String(baseUrl || "").trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

export async function fetchStoreContactInfo(options: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<StoreContactInfo> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 1500;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchImpl(buildUrl("/api/settings/contact", options.baseUrl), {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    if (!response.ok) {
      return { storeName: "", address: "", phone: "", email: "" };
    }

    const payload = (await response.json().catch(() => ({}))) as ContactResponse;
    const data = payload.data || {};

    return {
      storeName: normalizeString(data.store_name),
      address: normalizeString(data.address),
      phone: normalizeString(data.phone),
      email: normalizeString(data.email),
    };
  } catch {
    return { storeName: "", address: "", phone: "", email: "" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}