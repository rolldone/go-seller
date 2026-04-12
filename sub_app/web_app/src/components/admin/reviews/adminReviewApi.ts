import { adminGet, adminPost } from "../entities/adminApi";

export type AdminProductReview = {
  id: string;
  product_id: string;
  business_id?: string;
  business_name?: string;
  business_slug?: string;
  customer_id: string;
  order_id: string;
  order_item_id: string;
  rating: number;
  review_text: string;
  question_text: string;
  seller_reply?: string | null;
  seller_reply_at?: string | null;
  status: string;
  is_visible: boolean;
  metadata?: unknown;
  attachments?: Array<{
    publicUrl?: string;
    public_url?: string;
    storageKey?: string;
    storage_key?: string;
    mimeType?: string;
    mime_type?: string;
    name?: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type AdminReviewListResponse = {
  data: AdminProductReview[];
  total: number;
};

export async function listProductReviews(params?: {
  business_id?: string;
  product_id?: string;
  page?: number;
  limit?: number;
  status?: string;
  has_reply?: boolean;
}): Promise<AdminReviewListResponse> {
  const query = new URLSearchParams();
  if (params?.business_id?.trim()) query.set("business_id", params.business_id.trim());
  if (params?.product_id?.trim()) query.set("product_id", params.product_id.trim());
  if (params?.page && params.page > 0) query.set("page", String(params.page));
  if (params?.limit && params.limit > 0) query.set("limit", String(params.limit));
  if (params?.status?.trim()) query.set("status", params.status.trim());
  if (params?.has_reply !== undefined) query.set("has_reply", String(params.has_reply));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return adminGet<AdminReviewListResponse>(`/admin/review${suffix}`);
}

export async function updateReviewSellerReply(reviewID: string, sellerReply: string): Promise<{ data: AdminProductReview }> {
  return adminPost<{ data: AdminProductReview }>(`/admin/review/${encodeURIComponent(reviewID)}/reply`, {
    seller_reply: sellerReply,
  });
}
