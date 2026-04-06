import {
  clearBrowserCookie,
  CUSTOMER_ACCESS_TOKEN_KEY,
  CUSTOMER_PROFILE_KEY,
  parseCustomerProfile,
  parseMaxAgeFromExpiresAt,
  readBrowserCookie,
  writeBrowserCookie,
  type CustomerProfile,
} from "../../../lib/customerSession";
import { rememberCustomerAuthNextPath } from "../../../lib/customerAuthRedirect";
import { notifyWithAction } from "../../../lib/notification";

const CUSTOMER_REFRESH_TOKEN_KEY = "customer_refresh_token";
export const CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR = "customer_unauthorized_redirect";
let isHandlingCustomerUnauthorized = false;
let customerUnauthorizedRedirectTimer: number | null = null;

export type CustomerSessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  customer?: CustomerProfile | null;
};

export type CustomerMeResponse = {
  data?: {
    authenticated?: boolean;
    customer?: CustomerProfile | null;
  };
};

export type CustomerAddress = {
  id: string;
  customer_id: string;
  label: string;
  receiver_name: string;
  phone_number: string;
  address_line_1: string;
  address_line_2?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  notes?: string | null;
  is_primary: boolean;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
};

export type CustomerAddressInput = {
  label?: string;
  receiver_name: string;
  phone_number: string;
  address_line_1: string;
  address_line_2?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  notes?: string | null;
  is_primary?: boolean;
  metadata?: Record<string, unknown>;
};

type CustomerApiRequestOptions = {
  redirectOnUnauthorized?: boolean;
};

const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

function buildCurrentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function shouldHandleUnauthorized(status: number, payload: any): boolean {
  if (status === 401) return true;
  const message = String(payload?.error || payload?.message || "").toLowerCase();
  return status === 403 && (message.includes("invalid token") || message.includes("missing bearer token"));
}

function handleCustomerUnauthorized(message?: string): void {
  clearCustomerSession();
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/customer/auth/")) return;
  if (isHandlingCustomerUnauthorized) return;

  isHandlingCustomerUnauthorized = true;
  const text = message?.trim() || "Sesi login berakhir. Silakan login ulang.";
  const loginUrl = rememberCustomerAuthNextPath(buildCurrentPath());
  notifyWithAction("info", text, { label: "Login ulang", href: loginUrl });

  if (customerUnauthorizedRedirectTimer) {
    window.clearTimeout(customerUnauthorizedRedirectTimer);
  }

  customerUnauthorizedRedirectTimer = window.setTimeout(() => {
    window.location.replace(loginUrl);
  }, 2500);
}

export function getCustomerAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CUSTOMER_ACCESS_TOKEN_KEY) || readBrowserCookie(CUSTOMER_ACCESS_TOKEN_KEY) || "";
}

export function getCustomerProfile() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
  if (raw) return parseCustomerProfile(raw);
  return parseCustomerProfile(readBrowserCookie(CUSTOMER_PROFILE_KEY));
}

export function saveCustomerSession(payload: CustomerSessionPayload) {
  if (typeof window === "undefined") return;
  if (payload.access_token) localStorage.setItem(CUSTOMER_ACCESS_TOKEN_KEY, payload.access_token);
  if (payload.refresh_token) localStorage.setItem(CUSTOMER_REFRESH_TOKEN_KEY, payload.refresh_token);
  if (payload.customer) localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(payload.customer));

  const maxAge = parseMaxAgeFromExpiresAt(payload.expires_at || null);
  if (payload.access_token) {
    writeBrowserCookie(CUSTOMER_ACCESS_TOKEN_KEY, payload.access_token, maxAge);
  }
  if (payload.customer) {
    writeBrowserCookie(CUSTOMER_PROFILE_KEY, JSON.stringify(payload.customer), maxAge);
  }
}

export function clearCustomerSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_ACCESS_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_REFRESH_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  clearBrowserCookie(CUSTOMER_ACCESS_TOKEN_KEY);
  clearBrowserCookie(CUSTOMER_PROFILE_KEY);
}

export async function customerApiRequest<T>(path: string, init?: RequestInit, options?: CustomerApiRequestOptions): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }

  const token = getCustomerAuthToken();
  if (!token) {
    if (options?.redirectOnUnauthorized !== false) {
      handleCustomerUnauthorized("Sesi login tidak ditemukan. Silakan login ulang.");
      throw new Error(CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR);
    }
    throw new Error("customer auth required");
  }

  const headers = new Headers(init?.headers || {});
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.error || payload?.message || `HTTP ${res.status}`;
    if (shouldHandleUnauthorized(res.status, payload)) {
      if (options?.redirectOnUnauthorized !== false) {
        handleCustomerUnauthorized(message);
        throw new Error(CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR);
      }
      clearCustomerSession();
      throw new Error("invalid token");
    }
    throw new Error(message);
  }

  return payload as T;
}

export async function getCustomerMe(options?: CustomerApiRequestOptions): Promise<CustomerMeResponse> {
  return customerApiRequest<CustomerMeResponse>("/api/customer/auth/me", { method: "GET" }, options);
}

export async function listMyCustomerAddresses(): Promise<CustomerAddress[]> {
  const payload = await customerApiRequest<{ data: CustomerAddress[] }>("/api/customer/auth/addresses", { method: "GET" });
  return payload.data || [];
}

export async function createMyCustomerAddress(input: CustomerAddressInput): Promise<CustomerAddress> {
  const payload = await customerApiRequest<{ data: CustomerAddress }>("/api/customer/auth/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function updateMyCustomerAddress(addressID: string, input: CustomerAddressInput): Promise<CustomerAddress> {
  const payload = await customerApiRequest<{ data: CustomerAddress }>(`/api/customer/auth/addresses/${encodeURIComponent(addressID)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function deleteMyCustomerAddress(addressID: string): Promise<void> {
  await customerApiRequest(`/api/customer/auth/addresses/${encodeURIComponent(addressID)}`, {
    method: "DELETE",
  });
}

export async function setPrimaryMyCustomerAddress(addressID: string): Promise<CustomerAddress> {
  const payload = await customerApiRequest<{ data: CustomerAddress }>(
    `/api/customer/auth/addresses/${encodeURIComponent(addressID)}/set-primary`,
    { method: "POST" },
  );
  return payload.data;
}

export async function customerAuthRequest<T>(path: string, body: unknown): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }

  const res = await fetch(`${apiUrl}/api/customer/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || "Request customer auth gagal");
  }

  return payload as T;
}
