/** @jsxRuntime classic */
import React, { useState } from "react";
import SubscribeModal from "./SubscribeModal";
import { ArrowUpRight, Phone, Mail, MoreHorizontal } from "lucide-react";
import type { PublicBusiness, PublicBusinessAsset } from "./types";
import { useTranslations } from "../../../i18n";

type IconProps = { className?: string };

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M14 9h2V6h-2c-2.21 0-4 1.79-4 4v2H8v3h2v7h3v-7h2.2l.8-3H13v-2c0-.55.45-1 1-1Z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

function TiktokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M14 3h2.2c.5 2.5 2.1 4 4.8 4v2.8c-1.8 0-3.5-.5-4.8-1.5V15c0 3.3-2.6 6-5.9 6S4.3 18.2 4.3 15s2.6-6 5.9-6c.3 0 .7 0 1 .1v2.9c-.3-.1-.6-.2-1-.2-1.6 0-2.9 1.3-2.9 3s1.3 3 2.9 3 3-1.3 3-3V3Z" />
    </svg>
  );
}

interface BusinessStoreHeaderProps {
  business: PublicBusiness;
  locale?: string;
}

export default function BusinessStoreHeader({ business, locale }: BusinessStoreHeaderProps) {
  const [imgError, setImgError] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const t = useTranslations("business", locale);

  const pickCover = (assets?: PublicBusinessAsset[]) => {
    if (!assets || assets.length === 0) return null;
    // prefer usage_tag == 'logo'
    console.log("Picking cover from assets:", assets);
    const byUsage = assets.find((a) => a.usage_tag === "logo");
    if (byUsage) return byUsage;
    // prefer is_main
    const byMain = assets.find((a) => a.is_main);
    if (byMain) return byMain;
    // fallback to first
    return assets[0];
  };

  const cover = pickCover(business.assets);
  const coverUrl = cover && cover.public_url ? cover.public_url : null;

  // Social links are expected to be full URLs provided by admin.

  const hasValue = (v?: string | null) => {
    return typeof v === "string" && v.trim().length > 0;
  };
  const initials = business.name
    ? business.name
        .split(" ")
        .filter(Boolean)
        .map((token) => token[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";
  const fallbackLabel = initials || business.name?.at(0)?.toUpperCase() || "?";
  const parseReviewCount = (val: any): number => {
    if (val == null) return 0;
    if (typeof val === "number") return val;
    const s = String(val).trim();
    if (s === "" || s === "-") return 0;
    const lower = s.toLowerCase();
    const k = lower.match(/^([\d.,]+)\s*k/);
    if (k && k[1]) {
      const n = Number(k[1].replace(/,/g, ""));
      return Number.isNaN(n) ? 0 : Math.round(n * 1000);
    }
    const m = lower.match(/^([\d.,]+)\s*m/);
    if (m && m[1]) {
      const n = Number(m[1].replace(/,/g, ""));
      return Number.isNaN(n) ? 0 : Math.round(n * 1000000);
    }
    const digits = s.replace(/[^\d]/g, "");
    if (!digits) return 0;
    const num = Number(digits);
    return Number.isNaN(num) ? 0 : num;
  };

  const businessRating = business.rating ?? "-";
  const businessReviewCount = parseReviewCount((business as any).reviewCount ?? (business as any).review_count ?? 0);
  const businessSoldLabel = business.soldLabel ?? "-";
  return (
    <>
      <header className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-lg font-extrabold text-slate-800">
            {coverUrl && !imgError ? (
              <img
                src={coverUrl}
                alt={`${business.name} cover`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-50 text-lg font-extrabold text-slate-800">{fallbackLabel}</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-[30px]">{business.name}</h1>
            </div>

            <p className="text-sm text-slate-500">{business.short_description || business.description}</p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setShowSubscribe(true)} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                {t("subscribe", "Berlangganan")}
              </button>

              {hasValue(business.whatsapp) ? (
                <a
                  href={`https://wa.me/${business.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  {t("whatsapp", "WhatsApp")}
                </a>
              ) : null}

              {hasValue(business.email) && business.show_contact_email ? (
                <a
                  href={`mailto:${business.email}?subject=${encodeURIComponent(t("contactSubject", "Pertanyaan tentang toko Anda"))}`}
                  className="rounded-lg border border-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {t("email", "Email")}
                </a>
              ) : null}

                {/* social icons (icon-only) */}
                {hasValue(business.facebook) ? (
                  <a
                    href={business.facebook!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <FacebookIcon className="h-4 w-4" />
                  </a>
                ) : null}
                {hasValue(business.instagram) ? (
                  <a
                    href={business.instagram!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <InstagramIcon className="h-4 w-4" />
                  </a>
                ) : null}
                {hasValue(business.x_twitter) ? (
                  <a
                    href={business.x_twitter!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <XIcon className="h-4 w-4" />
                  </a>
                ) : null}
                {hasValue(business.tiktok) ? (
                  <a
                    href={business.tiktok!.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TikTok"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <TiktokIcon className="h-4 w-4" />
                  </a>
                ) : null}

              <button aria-label={t("moreActions", "Lainnya")} title={t("moreActions", "Lainnya")} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100">
                <MoreHorizontal className="h-4.5 w-4.5" />
              </button>
              <button aria-label={t("share", "Bagikan")} title={t("share", "Bagikan")} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100">
                <ArrowUpRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {businessReviewCount >= 50 ? (
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">⭐ {businessRating} ({businessReviewCount.toLocaleString()} {t("reviews", "ulasan")}) {t("separatorDot", "·")} {businessSoldLabel}</p>
            <p className="text-sm text-slate-500">{t("ratingAndReviews", "Rating & Ulasan")}</p>
          </div>
        ) : null}
      </div>
      </header>
      <SubscribeModal open={showSubscribe} onClose={() => setShowSubscribe(false)} businessId={business.id} locale={locale} />
    </>
  );
}
