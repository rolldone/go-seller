/** @jsxRuntime classic */
import React, { useMemo, useState } from "react";
import type { PublicBusinessProduct, PublicBusinessReview, PublicBusinessReviewSummary } from "../types";

const REVIEW_TOPICS = ["Kualitas Barang", "Pelayanan Penjual", "Kemasan Barang", "Kecepatan Pengiriman"] as const;

interface BusinessReviewTabProps {
  products: PublicBusinessProduct[];
  reviewSummary: PublicBusinessReviewSummary | null;
  reviews: PublicBusinessReview[] | null;
  formatNumber: (value: number) => string;
}

type SortMode = "latest" | "oldest" | "rating_desc" | "rating_asc";

function getReviewTimestamp(review: PublicBusinessReview, index: number): number {
  if (review.createdAt) {
    const parsed = new Date(review.createdAt).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER - index;
}

export default function BusinessReviewTab({ products, reviewSummary, reviews, formatNumber }: BusinessReviewTabProps) {
  const [mediaOnly, setMediaOnly] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const sourceReviews = Array.isArray(reviews) ? reviews : [];
  const breakdown = Array.isArray(reviewSummary?.breakdown) ? reviewSummary.breakdown : [];
  const maxBreakdownCount = breakdown.length ? Math.max(...breakdown.map((item) => item.count || 0)) : 1;
  const productById = new Map((Array.isArray(products) ? products : []).map((item) => [item.id, item]));

  const toggleRating = (rating: number) => {
    setSelectedRatings((current) =>
      current.includes(rating) ? current.filter((item) => item !== rating) : [...current, rating].sort((a, b) => b - a),
    );
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((current) => (current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]));
  };

  const visibleReviews = useMemo(() => {
    const withIndex = sourceReviews.map((review, index) => ({ review, index }));
    const filtered = withIndex.filter(({ review }) => {
      if (mediaOnly && !review.hasMedia) {
        return false;
      }

      if (selectedRatings.length > 0 && !selectedRatings.includes(Number(review.rating || 0))) {
        return false;
      }

      if (selectedTopics.length > 0) {
        const reviewTopics = Array.isArray(review.topics) ? review.topics : [];
        if (!reviewTopics.some((topic) => selectedTopics.includes(topic))) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((left, right) => {
      const leftRating = Number(left.review.rating || 0);
      const rightRating = Number(right.review.rating || 0);
      const leftTime = getReviewTimestamp(left.review, left.index);
      const rightTime = getReviewTimestamp(right.review, right.index);

      switch (sortMode) {
        case "oldest":
          return leftTime - rightTime;
        case "rating_desc":
          return rightRating - leftRating || leftTime - rightTime;
        case "rating_asc":
          return leftRating - rightRating || rightTime - leftTime;
        case "latest":
        default:
          return rightTime - leftTime;
      }
    });

    return filtered.map(({ review }) => review);
  }, [sortMode, selectedRatings, sourceReviews]);

  if (!reviewSummary) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Belum ada data ulasan untuk toko ini.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-5">
            <div>
              <p className="text-4xl font-extrabold text-slate-900">
                {reviewSummary.score.toFixed(1)} <span className="text-xl font-semibold text-slate-400">/ {reviewSummary.outOf.toFixed(1)}</span>
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{reviewSummary.satisfiedPercent}% pembeli merasa puas</p>
              <p className="mt-1 text-sm text-slate-500">{formatNumber(reviewSummary.ratingCount)} rating · {formatNumber(reviewSummary.reviewCount)} ulasan</p>
            </div>
          </div>

          <div className="grid w-full max-w-[540px] gap-2 sm:grid-cols-2">
            {breakdown.map((item) => (
              <div key={item.star} className="flex items-center gap-2 text-xs">
                <span className="min-w-[20px] font-semibold text-amber-500">★ {item.star}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${((item.count || 0) / maxBreakdownCount) * 100}%` }} />
                </div>
                <span className="min-w-[42px] text-slate-500">({item.count})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 text-center text-xs text-slate-500">Diambil dari pengalaman pembeli di toko ini</div>
      </section>

      <section className="flex flex-col gap-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[240px]">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Filter Ulasan</h3>
            </div>

            <div className="space-y-5 p-4 text-sm">
              <div>
                <p className="mb-2 font-semibold text-slate-800">Media</p>
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={mediaOnly}
                    onChange={() => setMediaOnly((current) => !current)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Dengan Foto & Video
                </label>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-800">Rating</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const checked = selectedRatings.includes(star);
                    return (
                      <label key={star} className="flex items-center gap-2 text-slate-600">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRating(star)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-amber-500">★</span> {star}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-800">Topik Ulasan</p>
                <div className="space-y-2 text-slate-600">
                  {REVIEW_TOPICS.map((topic) => (
                    <label key={topic} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={() => toggleTopic(topic)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {topic}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Ulasan Pilihan</h3>
              <p className="mt-1 text-xs text-slate-500">
                Menampilkan {visibleReviews.length} dari {formatNumber(Number(reviewSummary.reviewCount || 0))} ulasan
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700">Urutkan</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none ring-emerald-500 focus:ring-1"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="latest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="rating_desc">Rating Tertinggi</option>
                <option value="rating_asc">Rating Terendah</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {visibleReviews.length > 0 ? (
              visibleReviews.map((review) => {
                const productRef = productById.get(review.productId);
                const ratingValue = Number(review.rating || 0);
                const stars = "★".repeat(Math.max(0, Math.min(5, ratingValue))) + "☆".repeat(Math.max(0, 5 - ratingValue));

                return (
                  <article key={review.id} className="border-b border-slate-100 pb-6 last:border-none last:pb-0">
                    <div className="grid gap-4 md:grid-cols-[170px_1fr]">
                      <div className="flex gap-3 md:flex-col">
                        <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200" />
                        <div>
                          <p className="line-clamp-3 text-sm font-semibold text-slate-900">{review.productTitle || productRef?.title}</p>
                          <p className="mt-1 text-xs text-slate-500">Varian: {review.productVariant}</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-amber-500">{stars}</span>
                          <span className="text-slate-500">{review.createdAtLabel}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{review.usernameMasked}</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.content}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                          {review.hasMedia ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Foto/Video</span>
                          ) : null}
                          {Array.isArray(review.topics) && review.topics.length > 0
                            ? review.topics.map((topic) => (
                                <span key={topic} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                  {topic}
                                </span>
                              ))
                            : null}
                        </div>
                        <button type="button" className="mt-3 text-sm font-semibold text-slate-600 hover:text-emerald-600">
                          Membantu ({review.helpfulCount})
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Belum ada ulasan untuk filter yang dipilih.
              </div>
            )}
          </div>
        </main>
      </section>
    </div>
  );
}