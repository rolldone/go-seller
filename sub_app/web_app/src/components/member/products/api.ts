import { memberDelete, memberGet, memberPatch, memberPost, memberPostForm, memberPut } from "../businesses/api";
import type { BusinessOption, CategoryOption, Product, ProductAsset, ProductDigitalFile, ProductListParams, ProductListResponse, ProductPayload, ProductTranslation, ProductTranslationPayload, TagOption } from "./types";

export async function listMemberProducts(params: ProductListParams): Promise<ProductListResponse> {
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
	return memberGet<ProductListResponse>(`/api/member/products?${query.toString()}`);
}

export async function listMemberBusinesses(): Promise<BusinessOption[]> {
	const res = await memberGet<{ data: BusinessOption[] }>("/api/member/businesses?page=1&limit=500");
	return res.data || [];
}

export async function listMemberCategories(): Promise<CategoryOption[]> {
	const res = await memberGet<{ data: CategoryOption[] }>("/api/catalog/categories?page=1&limit=500");
	return res.data || [];
}

export async function listMemberTags(): Promise<TagOption[]> {
	const res = await memberGet<{ data: TagOption[] }>("/api/catalog/tags?page=1&limit=500");
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

export async function listMemberProductAssets(productID: string): Promise<ProductAsset[]> {
	const res = await memberGet<{ data: ProductAsset[] }>(`/api/member/product-assets/${productID}`);
	return res.data || [];
}

export async function uploadMemberProductAsset(productID: string, formData: FormData): Promise<ProductAsset> {
	return memberPostForm<ProductAsset>(`/api/member/product-assets/${productID}/upload`, formData);
}

export async function deleteMemberProductAsset(productID: string, assetID: string): Promise<void> {
	await memberDelete(`/api/member/product-assets/${productID}/${assetID}`);
}

export async function updateMemberProductAsset(
	productID: string,
	assetID: string,
	patch: { is_main?: boolean; display_order?: number; usage_tag?: string },
): Promise<void> {
	await memberPut(`/api/member/product-assets/${productID}/${assetID}`, patch);
}

export async function listMemberDigitalFiles(productID: string): Promise<ProductDigitalFile[]> {
	const res = await memberGet<{ data: ProductDigitalFile[] }>(`/api/member/product-digital-files/${productID}`);
	return res.data || [];
}

export async function uploadMemberDigitalFile(productID: string, formData: FormData): Promise<ProductDigitalFile> {
	return memberPostForm<ProductDigitalFile>(`/api/member/product-digital-files/${productID}/upload`, formData);
}

export async function deleteMemberDigitalFile(productID: string, fileID: string): Promise<void> {
	await memberDelete(`/api/member/product-digital-files/${productID}/${fileID}`);
}

export async function updateMemberDigitalFile(
	productID: string,
	fileID: string,
	patch: { file_name?: string; is_active?: boolean; download_limit?: number; sort_order?: number },
): Promise<void> {
	await memberPut(`/api/member/product-digital-files/${productID}/${fileID}`, patch);
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