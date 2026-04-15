import { getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";

interface HeroBrandingProps {
  locale?: string;
}

export default function HeroBranding({ locale }: HeroBrandingProps) {
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-center">
      <h1 className="text-5xl font-black leading-[0.95] tracking-tight text-slate-900 sm:text-6xl">
        {t("whereTheInternet", "Where the internet")}
        <br />
        {t("doesBusiness", "does business.")}
      </h1>
      <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
        {t("buildYourBusiness", "Build your business and get discovered by over 21M+ customers.")}
      </p>
    </div>
  );
}
