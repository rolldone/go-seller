import type {
  Product,
  ProductListParams,
  ProductListResponse,
  ProductPayload,
  ProductTranslation,
  ProductTranslationPayload,
} from "./types";
import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from "../entities/adminApi";

export async function listProducts(params: ProductListParams): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.stock_status) query.set("stock_status", params.stock_status);
  if (params.business_id) query.set("business_id", params.business_id);
  if (params.category_id) query.set("category_id", params.category_id);
  if (params.tag_id) query.set("tag_id", params.tag_id);
  if (params.product_type) query.set("product_type", params.product_type);
  if (params.is_visible) query.set("is_visible", params.is_visible);
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));

  return adminGet<ProductListResponse>(`/admin/catalog/products?${query.toString()}`);
}

export async function createProduct(input: ProductPayload): Promise<Product> {
  return adminPost<Product>("/admin/catalog/products", input);
}

export async function updateProduct(id: string, input: ProductPayload): Promise<Product> {
  return adminPut<Product>(`/admin/catalog/products/${id}`, input);
}

export async function deleteProduct(id: string): Promise<void> {
  await adminDelete(`/admin/catalog/products/${id}`);
}

export async function publishProduct(id: string): Promise<void> {
  await adminPatch<{ updated?: number }>(`/admin/catalog/products/${id}/publish`);
}

export async function unpublishProduct(id: string): Promise<void> {
  await adminPatch<{ updated?: number }>(`/admin/catalog/products/${id}/unpublish`);
}

export async function listProductTranslations(productID: string): Promise<ProductTranslation[]> {
  const res = await adminGet<{ data: ProductTranslation[] }>(`/admin/catalog/products/${productID}/translations`);
  return res.data || [];
}

export async function upsertProductTranslation(
  productID: string,
  locale: "id" | "en",
  input: ProductTranslationPayload,
): Promise<ProductTranslation> {
  return adminPut<ProductTranslation>(`/admin/catalog/products/${productID}/translations/${locale}`, input);
}
