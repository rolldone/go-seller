import { memberGet, memberPost } from "../businesses/api";
import type {
	SellerBalance,
	SellerBalanceMutation,
	SellerBalanceMutationListResponse,
	SellerSettlementListResponse,
	SellerSettlementSummary,
	SellerWithdrawal,
	SellerWithdrawalListResponse,
	CreateWithdrawalPayload,
} from "./types";

export async function getSellerBalance(businessID: string): Promise<SellerBalance> {
	return memberGet<SellerBalance>(`/api/member/businesses/${businessID}/balance`);
}

export async function listSellerMutations(
	businessID: string,
	page = 1,
	limit = 20,
): Promise<SellerBalanceMutationListResponse> {
	return memberGet<SellerBalanceMutationListResponse>(
		`/api/member/businesses/${businessID}/balance/mutations?page=${page}&limit=${limit}`,
	);
}

export async function getSellerSettlementSummary(businessID: string): Promise<SellerSettlementSummary> {
	return memberGet<SellerSettlementSummary>(`/api/member/businesses/${businessID}/balance/settlements/summary`);
}

export async function listSellerSettlements(
	businessID: string,
	status = "",
	page = 1,
	limit = 20,
): Promise<SellerSettlementListResponse> {
	const params = new URLSearchParams({ page: String(page), limit: String(limit) });
	if (status) params.set("status", status);
	return memberGet<SellerSettlementListResponse>(
		`/api/member/businesses/${businessID}/balance/settlements?${params.toString()}`,
	);
}

export async function listSellerWithdrawals(
	businessID: string,
	status = "",
	page = 1,
	limit = 20,
): Promise<SellerWithdrawalListResponse> {
	const params = new URLSearchParams({ page: String(page), limit: String(limit) });
	if (status) params.set("status", status);
	return memberGet<SellerWithdrawalListResponse>(
		`/api/member/businesses/${businessID}/balance/withdrawals?${params.toString()}`,
	);
}

export async function createWithdrawal(
	businessID: string,
	payload: CreateWithdrawalPayload,
): Promise<SellerWithdrawal> {
	return memberPost<SellerWithdrawal>(
		`/api/member/businesses/${businessID}/balance/withdrawals`,
		payload,
	);
}

export async function getWithdrawal(businessID: string, id: number): Promise<SellerWithdrawal> {
	return memberGet<SellerWithdrawal>(
		`/api/member/businesses/${businessID}/balance/withdrawals/${id}`,
	);
}
