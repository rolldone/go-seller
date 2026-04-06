/** @jsxRuntime classic */
import React from "react";
import type { PublicBusinessProduct, PublicBusinessReview, PublicBusinessReviewSummary } from "../types";

interface BusinessReviewTabProps {
  products: PublicBusinessProduct[];
  reviewSummary: PublicBusinessReviewSummary | null;
  reviews: PublicBusinessReview[] | null;
  formatNumber: (value: number) => string;
}

export default function BusinessReviewTab({
  products,
  reviewSummary,
  reviews,
  formatNumber,
}: BusinessReviewTabProps) {
  if (!reviewSummary) return null;

  const breakdown = Array.isArray(reviewSummary.breakdown) ? reviewSummary.breakdown : [];
  const maxBreakdownCount = breakdown.length ? Math.max(...breakdown.map((item) => item.count || 0)) : 1;
  const visibleReviews = Array.isArray(reviews) ? reviews.slice(0, 10) : [];
  const productById = new Map((Array.isArray(products) ? products : []).map((item) => [item.id, item]));

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
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${((item.count || 0) / maxBreakdownCount) * 100}%` }}
                  />
                </div>
                <span className="min-w-[42px] text-slate-500">({item.count})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
          Diambil dari pengalaman pembeli di toko ini
        </div>
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
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  Dengan Foto & Video
                </label>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-800">Rating</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <label key={star} className="flex items-center gap-2 text-slate-600">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-amber-500">★</span> {star}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-800">Topik Ulasan</p>
                <div className="space-y-2 text-slate-600">
                  {[
                    "Kualitas Barang",
                    "Pelayanan Penjual",
                    "Kemasan Barang",
                    "Kecepatan Pengiriman",
                  ].map((topic) => (
                    <label key={topic} className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
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
              <p className="mt-1 text-xs text-slate-500">Menampilkan {visibleReviews.length} dari {formatNumber(Number(reviewSummary.reviewCount || 0))} ulasan</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700">Urutkan</span>
              <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none ring-emerald-500 focus:ring-1">
                <option>Terbaru</option>
                <option>Terlama</option>
                <option>Rating Tertinggi</option>
                <option>Rating Terendah</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {visibleReviews.map((review) => {
              const productRef = productById.get(review.productId);
              const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

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
                      <button className="mt-3 text-sm font-semibold text-slate-600 hover:text-emerald-600">
                        Membantu ({review.helpfulCount})
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </section>
    </div>
  );
}
