export const CUSTOMER_AUTH_NEXT_KEY = "customer_auth_next";
const CUSTOMER_AUTH_NEXT_TTL_MS = 30 * 60 * 1000;

type StoredCustomerAuthNext = {
  path: string;
  savedAt: number;
};

function hasBrowserSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function getLocaleFromPathname(pathname?: string | null): string | null {
  const parts = String(pathname || "").split("/").filter(Boolean);
  const firstPart = String(parts[0] || "").trim().toLowerCase();
  return firstPart === "en" ? "en" : "id";
}

function stripLocalePrefix(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const parts = normalized.split("/").filter(Boolean);
  const firstPart = String(parts[0] || "").trim().toLowerCase();
  if (firstPart === "id" || firstPart === "en") {
    const nextPath = `/${parts.slice(1).join("/")}`;
    return nextPath === "" ? "/" : nextPath;
  }
  return normalized;
}

function buildLocalizedPath(pathname: string, locale?: string | null): string {
  const normalizedLocale = locale === "en" ? "en" : "id";
  const normalizedPath = stripLocalePrefix(pathname);

  if (normalizedLocale === "id") {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return "/en";
  }

  return `/en${normalizedPath}`;
}

export function normalizeCustomerAuthNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (typeof window === "undefined") return null;
    try {
      const url = new URL(trimmed);
      if (url.origin !== window.location.origin) return null;
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return null;
    }
  }

  if (!trimmed.startsWith("/")) return null;
  return trimmed;
}

export function buildCustomerAuthLoginUrl(nextPath?: string | null): string {
  const normalized = normalizeCustomerAuthNextPath(nextPath);
  const locale = getLocaleFromPathname(normalized || (typeof window !== "undefined" ? window.location.pathname : null));
  const loginPath = buildLocalizedPath("/customer/auth/login", locale);
  if (!normalized) return loginPath;
  return `${loginPath}?next=${encodeURIComponent(normalized)}`;
}

export function buildCustomerAuthRegisterUrl(nextPath?: string | null): string {
  const normalized = normalizeCustomerAuthNextPath(nextPath);
  const locale = getLocaleFromPathname(normalized || (typeof window !== "undefined" ? window.location.pathname : null));
  const registerPath = buildLocalizedPath("/customer/auth/register", locale);
  if (!normalized) return registerPath;
  return `${registerPath}?next=${encodeURIComponent(normalized)}`;
}

export function saveCustomerAuthNextPath(nextPath: string): void {
  if (!hasBrowserSessionStorage()) return;
  const normalized = normalizeCustomerAuthNextPath(nextPath);
  if (!normalized) return;

  const payload: StoredCustomerAuthNext = {
    path: normalized,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(CUSTOMER_AUTH_NEXT_KEY, JSON.stringify(payload));
}

export function readCustomerAuthNextPath(): string | null {
  if (!hasBrowserSessionStorage()) return null;

  const raw = sessionStorage.getItem(CUSTOMER_AUTH_NEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCustomerAuthNext>;
    const path = normalizeCustomerAuthNextPath(typeof parsed.path === "string" ? parsed.path : null);
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (!path || !savedAt || Date.now() - savedAt > CUSTOMER_AUTH_NEXT_TTL_MS) {
      sessionStorage.removeItem(CUSTOMER_AUTH_NEXT_KEY);
      return null;
    }
    return path;
  } catch {
    sessionStorage.removeItem(CUSTOMER_AUTH_NEXT_KEY);
    return null;
  }
}

export function clearCustomerAuthNextPath(): void {
  if (!hasBrowserSessionStorage()) return;
  sessionStorage.removeItem(CUSTOMER_AUTH_NEXT_KEY);
}

export function resolveCustomerAuthNextPath(search?: string | null): string | null {
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(search ?? window.location.search).get("next");
    const normalizedQuery = normalizeCustomerAuthNextPath(query);
    if (normalizedQuery) return normalizedQuery;
  }

  return readCustomerAuthNextPath();
}

export function rememberCustomerAuthNextPath(nextPath: string): string {
  const normalized = normalizeCustomerAuthNextPath(nextPath);
  if (!normalized) return "/customer/auth/login";

  saveCustomerAuthNextPath(normalized);
  return buildCustomerAuthLoginUrl(normalized);
}

export function consumeCustomerAuthNextPath(search?: string | null): string | null {
  const nextPath = resolveCustomerAuthNextPath(search);
  clearCustomerAuthNextPath();
  return nextPath;
}