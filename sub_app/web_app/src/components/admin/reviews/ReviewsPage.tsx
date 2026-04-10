import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listProductReviews, updateReviewSellerReply } from "./adminReviewApi";
import type { AdminProductReview } from "./adminReviewApi";

export default function ReviewsPage() {
  const [items, setItems] = useState<AdminProductReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [productID, setProductID] = useState("");
  const [filterUnreplied, setFilterUnreplied] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProductReviews({
        product_id: productID || undefined,
        page,
        limit,
        has_reply: filterUnreplied ? false : undefined,
      });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat review";
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, limit, productID, filterUnreplied]);

  const handleReplySubmit = async (reviewID: string) => {
    if (!replyText.trim()) {
      notifyError("Balasan tidak boleh kosong");
      return;
    }

    setReplySubmitting(true);
    try {
      await updateReviewSellerReply(reviewID, replyText.trim());
      notifySuccess("Balasan berhasil disimpan");
      setReplyingTo(null);
      setReplyText("");
      await loadData();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan balasan");
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Manajemen Review</h1>
        <p className="mt-2 text-slate-600">Lihat dan balas review produk dari pembeli</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Filter Product ID</label>
            <input
              type="text"
              placeholder="Kosongkan untuk semua produk"
              value={productID}
              onChange={(e) => {
                setProductID(e.target.value);
                setPage(1);
              }}
              className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterUnreplied}
                onChange={(e) => {
                  setFilterUnreplied(e.target.checked);
                  setPage(1);
                }}
                className="rounded border border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Belum dibalas</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Items per halaman</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">Tidak ada review</p>
          </div>
        ) : (
          items.map((review) => (
            <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Product ID</p>
                  <p className="mt-1 font-mono text-sm text-slate-900">{review.product_id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Rating</p>
                  <p className="mt-1 text-lg font-bold text-amber-600">
                    {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                  </p>
                </div>
              </div>

              {review.review_text && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Review</p>
                  <p className="mt-2 text-sm text-slate-700">{review.review_text}</p>
                </div>
              )}

              {review.question_text && (
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold uppercase text-sky-700">Pertanyaan Pembeli</p>
                  <p className="mt-2 text-sm text-sky-800">{review.question_text}</p>
                </div>
              )}

              {/* Seller Reply Section */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                {review.seller_reply ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase text-emerald-700">Balasan Penjual</p>
                    <p className="mt-2 text-sm text-emerald-800">{review.seller_reply}</p>
                    <p className="mt-2 text-xs text-emerald-600">
                      {new Date(review.seller_reply_at || "").toLocaleDateString("id-ID")}
                    </p>
                  </div>
                ) : replyingTo === review.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Tulis balasan untuk pertanyaan ini..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReplySubmit(review.id)}
                        disabled={replySubmitting}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {replySubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Simpan Balasan
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setReplyingTo(review.id);
                      setReplyText("");
                    }}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Balas Review
                  </button>
                )}
              </div>

              <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                <span>ID: {review.id}</span>
                <span>{new Date(review.created_at).toLocaleDateString("id-ID")}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
