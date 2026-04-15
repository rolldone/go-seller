import { getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";

interface HeroChatComposerProps {
  locale?: string;
}

export default function HeroChatComposer({ locale }: HeroChatComposerProps) {
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
        <p className="text-left text-lg text-slate-400">{t("start", "Start")}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            aria-label={t("add", "Add")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            +
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("voice", "Voice")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <span className="text-sm">{t("mic", "mic")}</span>
            </button>
            <button
              type="button"
              aria-label={t("send", "Send")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 bg-emerald-600 text-white transition hover:bg-emerald-500"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
