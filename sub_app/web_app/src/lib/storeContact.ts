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
} = {}): Promise<StoreContactInfo> {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(buildUrl("/api/settings/contact", options.baseUrl), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch store contact: HTTP ${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as ContactResponse;
  const data = payload.data || {};

  return {
    storeName: normalizeString(data.store_name),
    address: normalizeString(data.address),
    phone: normalizeString(data.phone),
    email: normalizeString(data.email),
  };
}