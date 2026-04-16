/** @jsxRuntime classic */
import React, { useState } from "react";
import SubscribeModal from "./SubscribeModal";
import { ArrowUpRight, MessageSquare, MoreHorizontal } from "lucide-react";
import type { PublicBusiness, PublicBusinessAsset } from "./types";
import { useTranslations } from "../../../i18n";

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
              <button className="rounded-lg border border-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50">
                {t("chatSeller", "Chat Penjual")}
              </button>
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
