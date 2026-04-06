export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  locale?: string;
};

export type CustomerSession = {
  authenticated: boolean;
  accessToken: string;
  profile: CustomerProfile | null;
  expiresAt: string | null;
};

export const CUSTOMER_ACCESS_TOKEN_KEY = "customer_access_token";
export const CUSTOMER_PROFILE_KEY = "customer_profile";
export const CUSTOMER_AUTH_COOKIE_MAX_AGE_SECONDS = 15 * 60;

export function parseCustomerProfile(value: string | null | undefined): CustomerProfile | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CustomerProfile>;
    if (!parsed || typeof parsed !== "object") return null;
    const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    if (!id || !name || !email) return null;
    return {
      id,
      name,
      email,
      phone: typeof parsed.phone === "string" ? parsed.phone.trim() : undefined,
      locale: typeof parsed.locale === "string" ? parsed.locale.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function buildCustomerSession(
  accessToken: string | null | undefined,
  profile: CustomerProfile | null,
  expiresAt: string | null = null,
): CustomerSession | null {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) return null;
  return {
    authenticated: true,
    accessToken: token,
    profile,
    expiresAt,
  };
}

export function parseMaxAgeFromExpiresAt(expiresAt: string | null | undefined): number {
  if (!expiresAt) return CUSTOMER_AUTH_COOKIE_MAX_AGE_SECONDS;
  const expiresTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresTime)) return CUSTOMER_AUTH_COOKIE_MAX_AGE_SECONDS;
  const seconds = Math.floor((expiresTime - Date.now()) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return CUSTOMER_AUTH_COOKIE_MAX_AGE_SECONDS;
  return seconds;
}

export function readBrowserCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const cookie = part.trim();
    if (!cookie.startsWith(encodedName)) continue;
    return decodeURIComponent(cookie.slice(encodedName.length));
  }
  return "";
}

export function writeBrowserCookie(name: string, value: string, maxAgeSeconds = CUSTOMER_AUTH_COOKIE_MAX_AGE_SECONDS): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

export function clearBrowserCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax`;
}

export function readSessionFromBrowserCookies(): CustomerSession | null {
  const accessToken = readBrowserCookie(CUSTOMER_ACCESS_TOKEN_KEY);
  const profile = parseCustomerProfile(readBrowserCookie(CUSTOMER_PROFILE_KEY));
  return buildCustomerSession(accessToken, profile, null);
}