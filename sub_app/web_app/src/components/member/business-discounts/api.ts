import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import type { Discount, DiscountListParams, DiscountListResponse, DiscountPayload } from "../../admin/discounts/types";

export async function listMemberBusinessDiscounts(businessID: string, params: DiscountListParams): Promise<DiscountListResponse> {
	const query = new URLSearchParams();
	if (params.q) query.set("q", params.q);
	if (params.is_active !== undefined) query.set("is_active", params.is_active);
	query.set("page", String(params.page));
	query.set("limit", String(params.limit));
	return memberGet<DiscountListResponse>(`/api/member/businesses/${businessID}/discounts?${query.toString()}`);
}

export async function createMemberBusinessDiscount(businessID: string, input: DiscountPayload): Promise<Discount> {
	return memberPost<Discount>(`/api/member/businesses/${businessID}/discounts`, input);
}

export async function updateMemberBusinessDiscount(businessID: string, id: string, input: DiscountPayload): Promise<Discount> {
	return memberPut<Discount>(`/api/member/businesses/${businessID}/discounts/${id}`, input);
}

export async function deleteMemberBusinessDiscount(businessID: string, id: string): Promise<void> {
	await memberDelete(`/api/member/businesses/${businessID}/discounts/${id}`);
}