export type SiteLocale = "id" | "en";

export const ORIGINAL_LOCALE: SiteLocale = "id";
export const SUPPORTED_LOCALES: readonly SiteLocale[] = ["id", "en"] as const;

export const LOCALE_LABELS: Record<SiteLocale, string> = {
  id: "Indonesia (id)",
  en: "English (en)",
};

export const LOCALE_OPTIONS: Array<{ value: SiteLocale; label: string }> = SUPPORTED_LOCALES.map((l) => ({
  value: l,
  label: LOCALE_LABELS[l],
}));

export function normalizeLocale(value?: string | null): SiteLocale {
  const locale = String(value || "").trim().toLowerCase();
  return locale === "en" ? "en" : ORIGINAL_LOCALE;
}

export function getLocaleFromPathname(pathname?: string | null): SiteLocale {
  const parts = String(pathname || "").split("/").filter(Boolean);
  const firstPart = String(parts[0] || "").trim().toLowerCase();
  return firstPart === "en" ? "en" : ORIGINAL_LOCALE;
}

export function stripLocalePrefix(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return "/";
  }

  const firstPart = String(parts[0] || "").trim().toLowerCase();
  if (firstPart === "id" || firstPart === "en") {
    const nextPath = `/${parts.slice(1).join("/")}`;
    return nextPath === "" ? "/" : nextPath;
  }

  return normalized;
}

export function buildLocalizedPath(pathname: string, locale?: string | null): string {
  const targetLocale = normalizeLocale(locale);
  const normalizedPath = stripLocalePrefix(pathname);

  if (targetLocale === ORIGINAL_LOCALE) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return `/${targetLocale}`;
  }

  return `/${targetLocale}${normalizedPath}`;
}

export function isCustomerAuthPathname(pathname?: string | null): boolean {
  const normalized = stripLocalePrefix(String(pathname || ""));
  return normalized === "/customer/auth" || normalized.startsWith("/customer/auth/");
}