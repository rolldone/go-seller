import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import { getMemberOrderByID } from "../orders/api";
import type { Order } from "../orders/types";

export type MemberPosBusiness = {
	id: string;
	name: string;
	slug: string;
	short_description?: string | null;
};

export type MemberPosCreateDraftPayload = {
	user_id?: string;
	customer_id?: string;
	fulfillment_type?: string;
	currency?: string;
};

export type MemberPosCustomerHistoryItem = {
	id: string;
	name: string;
	email: string;
	phone: string;
	locale: string;
	is_active: boolean;
	is_banned: boolean;
	order_count: number;
	last_order_at?: string | null;
};

export type MemberPosCustomerHistoryResponse = {
	data: MemberPosCustomerHistoryItem[];
	total: number;
};

export type MemberPosOrderDetailResponse = Awaited<ReturnType<typeof getMemberOrderByID>>;

export async function listMemberPosBusinesses(): Promise<MemberPosBusiness[]> {
	const res = await memberGet<{ data: MemberPosBusiness[] }>("/api/member/businesses?page=1&limit=500");
	return res.data || [];
}

export const listMemberBusinesses = listMemberPosBusinesses;

export async function getMemberPosOrder(businessID: string, orderID: string): Promise<MemberPosOrderDetailResponse> {
	return getMemberOrderByID(businessID, orderID);
}

export async function listMemberPosCustomers(
	businessID: string,
	params: { q?: string; page?: number; limit?: number } = {},
): Promise<MemberPosCustomerHistoryResponse> {
	const query = new URLSearchParams();
	if (params.q?.trim()) query.set("q", params.q.trim());
	query.set("page", String(params.page ?? 1));
	query.set("limit", String(params.limit ?? 20));
	return memberGet<MemberPosCustomerHistoryResponse>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/customers?${query.toString()}`,
	);
}

export async function createMemberPosDraftOrder(businessID: string, payload: MemberPosCreateDraftPayload): Promise<Order> {
	const res = await memberPost<{ data: Order }>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders`, payload);
	return res.data;
}

export async function updateMemberPosOrder(
	businessID: string,
	orderID: string,
	payload: { customer_id?: string | null; fulfillment_type?: string | null },
): Promise<Order> {
	const res = await memberPut<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}`,
		payload,
	);
	return res.data;
}

export async function addMemberPosOrderItem(
	businessID: string,
	orderID: string,
	payload: { product_id?: string | null; product_name?: string; sku?: string | null; qty: number; unit_price: number; discount_amount?: number },
): Promise<void> {
	await memberPost(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/items`,
		payload,
	);
}

export async function removeMemberPosOrderItem(businessID: string, orderID: string, itemID: string): Promise<void> {
	await memberDelete(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/items/${encodeURIComponent(itemID)}`);
}

export async function applyMemberPosItemDiscount(
	businessID: string,
	orderID: string,
	itemID: string,
	discountID: string,
): Promise<Order> {
	const res = await memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/items/${encodeURIComponent(itemID)}/discount`,
		{ discount_id: discountID },
	);
	return res.data;
}

export async function removeMemberPosItemDiscount(businessID: string, orderID: string, itemID: string): Promise<void> {
	await memberDelete(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/items/${encodeURIComponent(itemID)}/discount`,
	);
}

export async function applyMemberPosCoupon(businessID: string, orderID: string, couponCode: string): Promise<Order> {
	const res = await memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/coupon`,
		{ coupon_code: couponCode },
	);
	return res.data;
}

export async function removeMemberPosCoupon(businessID: string, orderID: string, code: string): Promise<void> {
	await memberDelete(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/coupon/${encodeURIComponent(code)}`,
	);
}

export async function replaceMemberPosExtraCharges(
	businessID: string,
	orderID: string,
	payload: { charges: Array<{ name: string; amount: number; notes?: string; sort_order?: number }> },
): Promise<Order> {
	const res = await memberPut<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/extra-charges`,
		payload,
	);
	return res.data;
}

export async function finalizeMemberPosOrder(businessID: string, orderID: string): Promise<Order> {
	const res = await memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/finalize`,
		{},
	);
	return res.data;
}
