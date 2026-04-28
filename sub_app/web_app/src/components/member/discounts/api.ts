import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import type { Discount, DiscountListParams, DiscountListResponse, DiscountPayload } from "./types";

export async function listMemberDiscounts(productID: string, params: DiscountListParams): Promise<DiscountListResponse> {
	const query = new URLSearchParams();
	if (params.q) query.set("q", params.q);
	if (params.is_active !== undefined) query.set("is_active", params.is_active);
	query.set("page", String(params.page));
	query.set("limit", String(params.limit));
	return memberGet<DiscountListResponse>(`/api/member/product-discounts/${productID}?${query.toString()}`);
}

export async function createMemberDiscount(productID: string, input: DiscountPayload): Promise<Discount> {
	return memberPost<Discount>(`/api/member/product-discounts/${productID}`, input);
}

export async function updateMemberDiscount(productID: string, id: string, input: DiscountPayload): Promise<Discount> {
	return memberPut<Discount>(`/api/member/product-discounts/${productID}/${id}`, input);
}

export async function deleteMemberDiscount(productID: string, id: string): Promise<void> {
	await memberDelete(`/api/member/product-discounts/${productID}/${id}`);
}