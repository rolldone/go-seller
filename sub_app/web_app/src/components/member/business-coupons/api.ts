import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import type { Coupon, CouponListParams, CouponListResponse, CouponPayload } from "../../admin/coupons/types";

export async function listMemberBusinessCoupons(businessID: string, params: CouponListParams): Promise<CouponListResponse> {
	const query = new URLSearchParams();
	if (params.q) query.set("q", params.q);
	if (params.is_active !== undefined) query.set("is_active", params.is_active);
	query.set("page", String(params.page));
	query.set("limit", String(params.limit));
	return memberGet<CouponListResponse>(`/api/member/businesses/${businessID}/coupons?${query.toString()}`);
}

export async function createMemberBusinessCoupon(businessID: string, input: CouponPayload): Promise<Coupon> {
	return memberPost<Coupon>(`/api/member/businesses/${businessID}/coupons`, input);
}

export async function updateMemberBusinessCoupon(businessID: string, id: string, input: CouponPayload): Promise<Coupon> {
	return memberPut<Coupon>(`/api/member/businesses/${businessID}/coupons/${id}`, input);
}

export async function deleteMemberBusinessCoupon(businessID: string, id: string): Promise<void> {
	await memberDelete(`/api/member/businesses/${businessID}/coupons/${id}`);
}