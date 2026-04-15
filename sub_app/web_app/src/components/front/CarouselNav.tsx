import { useTranslations } from "../../i18n";

export default function CarouselNav({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={t("previous", "Previous")}
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-emerald-600"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t("next", "Next")}
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-emerald-600"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
