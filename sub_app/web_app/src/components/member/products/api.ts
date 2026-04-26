import { memberDelete, memberGet, memberPatch, memberPost, memberPut } from "../businesses/api";
import type { BusinessOption, Product, ProductListParams, ProductListResponse, ProductPayload, ProductTranslation, ProductTranslationPayload } from "./types";

export async function listMemberProducts(params: ProductListParams): Promise<ProductListResponse> {
	const query = new URLSearchParams();
	if (params.q) query.set("q", params.q);
	if (params.status) query.set("status", params.status);
	if (params.stock_status) query.set("stock_status", params.stock_status);
	if (params.business_id) query.set("business_id", params.business_id);
	if (params.product_type) query.set("product_type", params.product_type);
	if (params.is_visible) query.set("is_visible", params.is_visible);
	query.set("page", String(params.page));
	query.set("limit", String(params.limit));
	return memberGet<ProductListResponse>(`/api/member/products?${query.toString()}`);
}

export async function listMemberBusinesses(): Promise<BusinessOption[]> {
	const res = await memberGet<{ data: BusinessOption[] }>("/api/member/businesses?page=1&limit=500");
	return res.data || [];
}

export async function createMemberProduct(input: ProductPayload): Promise<Product> {
	return memberPost<Product>("/api/member/products", input);
}

export async function updateMemberProduct(id: string, input: ProductPayload): Promise<Product> {
	return memberPut<Product>(`/api/member/products/${id}`, input);
}

export async function deleteMemberProduct(id: string): Promise<void> {
	await memberDelete(`/api/member/products/${id}`);
}

export async function publishMemberProduct(id: string): Promise<void> {
	await memberPatch(`/api/member/products/${id}/publish`);
}

export async function unpublishMemberProduct(id: string): Promise<void> {
	await memberPatch(`/api/member/products/${id}/unpublish`);
}

export async function listMemberProductTranslations(productID: string): Promise<ProductTranslation[]> {
	const res = await memberGet<{ data: ProductTranslation[] }>(`/api/member/products/${productID}/translations`);
	return res.data || [];
}

export async function upsertMemberProductTranslation(productID: string, locale: "id" | "en", input: ProductTranslationPayload): Promise<ProductTranslation> {
	return memberPut<ProductTranslation>(`/api/member/products/${productID}/translations/${locale}`, input);
}