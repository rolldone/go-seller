import { buildLocalizedPath, getLocaleFromPathname, normalizeLocale, stripLocalePrefix } from "../lib/siteLocale";
import { defaultLang, ui, type SiteLocale, type TranslationNamespace } from "./ui";

function isTranslationNamespace(value: string): value is TranslationNamespace {
  return Object.prototype.hasOwnProperty.call(ui[defaultLang], value);
}

function resolveLang(input?: string | null): SiteLocale {
  const normalized = normalizeLocale(input);
  return normalized === "en" ? "en" : defaultLang;
}

function detectLang(namespaceOrLang?: TranslationNamespace | SiteLocale, lang?: string | null): {
  namespace: TranslationNamespace;
  lang: SiteLocale;
} {
  const isNamespace = typeof namespaceOrLang === "string" && isTranslationNamespace(namespaceOrLang);

  if (isNamespace) {
    return {
      namespace: namespaceOrLang,
      lang: resolveLang(lang),
    };
  }

  return {
    namespace: "common",
    lang: resolveLang(namespaceOrLang || lang),
  };
}

export function getLang(): SiteLocale {
  if (typeof window !== "undefined") {
    return resolveLang(document.documentElement.lang);
  }

  const globalLang = (globalThis as typeof globalThis & { lang?: string }).lang;
  return resolveLang(globalLang);
}

export function getLangFromUrl(url: URL): SiteLocale | null {
  const locale = getLocaleFromPathname(url.pathname);
  return locale === defaultLang ? null : locale;
}

export function linkI18n(url: string, lang?: string | null): string {
  return buildLocalizedPath(stripLocalePrefix(url), resolveLang(lang));
}

type Translator = (key: string, alternative?: string) => string;

export function useTranslations(namespaceOrLang?: TranslationNamespace | SiteLocale, lang?: string | null): Translator {
  const resolved = detectLang(namespaceOrLang, lang);

  return function t(key: string, alternative?: string): string {
    const dictionaries = ui as Record<SiteLocale, Record<TranslationNamespace, Record<string, unknown>>>;
    const current = dictionaries[resolved.lang]?.[resolved.namespace]?.[key];
    if (typeof current === "string" && current.trim()) {
      return current;
    }

    const fallback = dictionaries[defaultLang]?.[resolved.namespace]?.[key];
    if (typeof fallback === "string" && fallback.trim()) {
      return fallback;
    }

    if (alternative != null && alternative !== "") {
      return alternative;
    }

    return String(key);
  };
}

export { defaultLang, ui } from "./ui";