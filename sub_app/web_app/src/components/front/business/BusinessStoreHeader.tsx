/** @jsxRuntime classic */
import React, { useState } from "react";
import type { PublicBusiness, PublicBusinessAsset } from "./types";

interface BusinessStoreHeaderProps {
  business: PublicBusiness;
}

export default function BusinessStoreHeader({ business }: BusinessStoreHeaderProps) {
  const [imgError, setImgError] = useState(false);

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
  // Mock rating data (display-only)
  const MOCK_RATING = "4.8";
  const MOCK_REVIEW_COUNT = "7.456";
  const MOCK_SOLD_LABEL = "Terjual 1.2k+";
  return (
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
              <button className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                Subscribe
              </button>
              <button className="rounded-lg border border-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50">
                Chat Penjual
              </button>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100">⋯</button>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-slate-500 hover:bg-slate-100">↗</button>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">⭐ {MOCK_RATING} ({MOCK_REVIEW_COUNT}) · {MOCK_SOLD_LABEL}</p>
          <p className="text-sm text-slate-500">Rating & Ulasan</p>

        
        </div>
      </div>
    </header>
  );
}
