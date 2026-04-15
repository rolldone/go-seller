import { getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";

interface HeroIntroProps {
  locale?: string;
}

export default function HeroIntro({ locale }: HeroIntroProps) {
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  return (
    <div className="space-y-6 text-slate-900">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
        {t("storefrontTag", "Storefront")}
      </div>

      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
          {t("storefrontHeadline", "Where digital products become real revenue.")}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          {t("storefrontDescription", "Sell templates, tools, and services from one polished storefront. Launch fast, build trust, and keep your buyer journey frictionless.")}
        </p>
      </div>

      <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("activeSellers", "Active Sellers")}</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{t("activeSellersValue", "1.2K+")}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("productsCount", "Products")}</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{t("productsCountValue", "8.4K")}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 sm:col-span-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("avgConversion", "Avg. Conversion")}</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">{t("avgConversionValue", "4.7%")}</p>
        </div>
      </div>
    </div>
  );
}
