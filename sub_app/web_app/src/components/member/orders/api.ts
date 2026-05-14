import { getMemberAuthToken } from "../../../lib/memberSession";
import { memberDelete, memberGet, memberPost, memberPatch, memberPut } from "../businesses/api";
import type {
	MemberCreateShipmentPayload,
	MemberOrderDetailResponse,
	MemberOrderListParams,
	MemberOrderListResponse,
	MemberReplaceExtraChargesPayload,
	MemberShipmentListResponse,
	MemberShippableItemsResponse,
	MemberUpdateShipmentPayload,
	MemberUpdateShippingAddressPayload,
	MemberUpdateShippingQuotePayload,
	Order,
	OrderShipment,
	PaymentProof,
} from "./types";

function getApiUrl() {
	return import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";
}

function buildQuery(params: MemberOrderListParams): string {
	const query = new URLSearchParams();
	if (params.q?.trim()) query.set("q", params.q.trim());
	if (params.status?.trim()) query.set("status", params.status.trim());
	if (params.payment_status?.trim()) query.set("payment_status", params.payment_status.trim());
	if (params.channel?.trim()) query.set("channel", params.channel.trim());
	if (params.sort?.trim()) query.set("sort", params.sort.trim());
	query.set("page", String(params.page ?? 1));
	query.set("limit", String(params.limit ?? 20));
	return query.toString();
}

async function memberGetBlob(path: string): Promise<Blob> {
	const apiUrl = getApiUrl();
	if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");
	const token = getMemberAuthToken();
	const headers: HeadersInit = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	const response = await fetch(`${apiUrl}${path}`, {
		method: "GET",
		credentials: "include",
		headers,
	});
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
	}
	return response.blob();
}

export async function listMemberOrderPaymentProofs(businessID: string, orderID: string, paymentID: string): Promise<{ data: PaymentProof[] }> {
	return memberGet<{ data: PaymentProof[] }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/payments/${encodeURIComponent(paymentID)}/proofs`,
	);
}

export async function getMemberOrderPaymentProofBlob(businessID: string, orderID: string, paymentID: string, proofID: string): Promise<Blob> {
	return memberGetBlob(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/payments/${encodeURIComponent(paymentID)}/proofs/${encodeURIComponent(proofID)}/access`,
	);
}

export async function validateMemberOrderPaymentFromHistory(
	businessID: string,
	orderID: string,
	paymentID: string,
	payload: { note?: string },
): Promise<{ data: Order }> {
	return memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/payments/${encodeURIComponent(paymentID)}/validate`,
		payload,
	);
}

export async function listMemberOrders(businessID: string, params: MemberOrderListParams): Promise<MemberOrderListResponse> {
	const query = buildQuery(params);
	return memberGet<MemberOrderListResponse>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders?${query}`);
}

export async function getMemberOrderByID(businessID: string, orderID: string): Promise<MemberOrderDetailResponse> {
	return memberGet<MemberOrderDetailResponse>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}`);
}

export async function downloadMemberOrderInvoice(businessID: string, orderID: string): Promise<Blob> {
	return memberGetBlob(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/invoice`);
}

export async function updateMemberOrderShippingQuote(
	businessID: string,
	orderID: string,
	payload: MemberUpdateShippingQuotePayload,
): Promise<{ data: Order }> {
	return memberPut<{ data: Order }>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipping`, payload);
}

export async function updateMemberOrderShippingAddress(
	businessID: string,
	orderID: string,
	payload: MemberUpdateShippingAddressPayload,
): Promise<{ data: Order }> {
	return memberPost<{ data: Order }>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipping-address`, payload);
}

export async function replaceMemberOrderExtraCharges(
	businessID: string,
	orderID: string,
	payload: MemberReplaceExtraChargesPayload,
): Promise<{ data: Order }> {
	return memberPut<{ data: Order }>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/extra-charges`, payload);
}

export async function listMemberOrderShipments(businessID: string, orderID: string): Promise<MemberShipmentListResponse> {
	return memberGet<MemberShipmentListResponse>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipments`);
}

export async function listMemberShippableItems(businessID: string, orderID: string): Promise<MemberShippableItemsResponse> {
	return memberGet<MemberShippableItemsResponse>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shippable-items`);
}

export async function createMemberOrderShipment(
	businessID: string,
	orderID: string,
	payload: MemberCreateShipmentPayload,
): Promise<OrderShipment> {
	return memberPost<OrderShipment>(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipments`, payload);
}

export async function updateMemberOrderShipment(
	businessID: string,
	orderID: string,
	shipmentID: string,
	payload: MemberUpdateShipmentPayload,
): Promise<OrderShipment> {
	return memberPatch<OrderShipment>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipments/${encodeURIComponent(shipmentID)}`,
		payload,
	);
}

export async function deleteMemberOrderShipment(businessID: string, orderID: string, shipmentID: string): Promise<void> {
	await memberDelete(`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/shipments/${encodeURIComponent(shipmentID)}`);
}

export async function requestMemberOrderCustomerConfirmation(
	businessID: string,
	orderID: string,
	payload: { message?: string },
): Promise<{ data: Order }> {
	return memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/customer-confirmation`,
		payload,
	);
}

export async function upsertMemberOrderDisputeNote(
	businessID: string,
	orderID: string,
	payload: { note: string },
): Promise<{ data: Order }> {
	return memberPost<{ data: Order }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/orders/${encodeURIComponent(orderID)}/dispute/note`,
		payload,
	);
}