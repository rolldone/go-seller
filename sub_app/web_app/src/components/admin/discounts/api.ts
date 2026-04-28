import type { Discount, DiscountListParams, DiscountListResponse, DiscountPayload } from "./types";
import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";

export async function listDiscounts(params: DiscountListParams): Promise<DiscountListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.is_active !== undefined) query.set("is_active", params.is_active);
  if (params.product_id) query.set("product_id", params.product_id);
  if (params.business_id) query.set("business_id", params.business_id);
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));

  return adminGet<DiscountListResponse>(`/admin/catalog/discounts?${query.toString()}`);
}

export async function createDiscount(input: DiscountPayload): Promise<Discount> {
  return adminPost<Discount>("/admin/catalog/discounts", input);
}

export async function updateDiscount(id: string, input: DiscountPayload): Promise<Discount> {
  return adminPut<Discount>(`/admin/catalog/discounts/${id}`, input);
}

export async function deleteDiscount(id: string): Promise<void> {
  await adminDelete(`/admin/catalog/discounts/${id}`);
}
