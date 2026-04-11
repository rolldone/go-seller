interface CarouselCardProps {
  title?: string;
  subtitle?: string;
  image?: string;
  href?: string;
  variant?: "large" | "medium";
}

export default function CarouselCard({ title, subtitle, image, href, variant = "large" }: CarouselCardProps) {
  const isLarge = variant === "large";
  const titleText = title?.trim() || "";
  const subtitleText = subtitle?.trim() || "";
  const hasCopy = Boolean(titleText || subtitleText);
  const ariaLabel = titleText || subtitleText || "Carousel banner";
  const content = (
    <div
      className={
        "group relative flex h-full min-h-[320px] w-full flex-col justify-between overflow-hidden rounded-[32px] border shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(15,23,42,0.16)] sm:min-h-[380px]" +
        (isLarge ? " border-white/30 bg-slate-900" : " border-slate-200 bg-slate-900")
      }
      aria-label={ariaLabel}
      style={{
        backgroundImage: image ? `url(${image})` : undefined,
        backgroundSize: image ? "cover" : undefined,
        backgroundPosition: image ? "center" : undefined,
      }}
    >
      <div className={`absolute inset-0 ${hasCopy ? "bg-gradient-to-r from-slate-950/85 via-slate-900/45 to-slate-900/10" : "bg-gradient-to-t from-slate-950/20 via-slate-950/10 to-transparent"}`} />
      {hasCopy ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.28),transparent_35%),radial-gradient(circle_at_70%_75%,rgba(59,130,246,0.18),transparent_30%)]" />
      ) : null}
      {hasCopy ? (
        <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-7 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur-md">
              Featured Promo
            </div>
            {isLarge && (
              <div className="rounded-full border border-white/15 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
                GoSeller
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="max-w-2xl">
              {titleText ? <h3 className="text-3xl font-black leading-tight text-white sm:text-5xl">{titleText}</h3> : null}
              {subtitleText ? <p className={`max-w-xl text-sm leading-7 text-white/85 sm:text-base ${titleText ? "mt-4" : "mt-2 text-base sm:text-lg"}`}>{subtitleText}</p> : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-900 shadow-sm">
                  Lihat Promo Lainnya
                </span>
                <span className="text-xs font-medium text-white/70">Klik banner untuk detail</span>
              </div>
            </div>

            <div className="flex justify-start lg:justify-end">
              <span className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800">
                Lihat Promo Lainnya
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {content}
      </a>
    );
  }

  return content;
}
