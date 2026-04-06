import type { Coupon, CouponListParams, CouponListResponse, CouponPayload } from "./types";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";

export async function listCoupons(params: CouponListParams): Promise<CouponListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.product_id) query.set("product_id", params.product_id);
  if (params.customer_id) query.set("customer_id", params.customer_id);
  if (params.is_active) query.set("is_active", params.is_active);
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));
  return adminGet<CouponListResponse>(`/admin/catalog/coupons?${query.toString()}`);
}

export async function createCoupon(input: CouponPayload): Promise<Coupon> {
  return adminPost<Coupon>("/admin/catalog/coupons", input);
}

export async function updateCoupon(id: string, input: CouponPayload): Promise<Coupon> {
  return adminPut<Coupon>(`/admin/catalog/coupons/${id}`, input);
}

export async function deleteCoupon(id: string): Promise<void> {
  await adminDelete(`/admin/catalog/coupons/${id}`);
}
