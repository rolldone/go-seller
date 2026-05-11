import { adminGet, adminPost } from "../entities/adminApi";
import type {
	AdminSellerBalanceSummaryResponse,
	AdminSellerSettlementDecisionResponse,
	AdminSellerSettlementListResponse,
	AdminSellerWithdrawalAuditListResponse,
	AdminSellerWithdrawal,
	AdminSellerWithdrawalListResponse,
} from "./types";

export async function getAdminSellerBalanceSummary(): Promise<AdminSellerBalanceSummaryResponse> {
	return adminGet<AdminSellerBalanceSummaryResponse>("/admin/order/seller-balance/summary");
}

export async function listAdminWithdrawals(
	status = "",
	page = 1,
	limit = 20,
): Promise<AdminSellerWithdrawalListResponse> {
	const params = new URLSearchParams({ page: String(page), limit: String(limit) });
	if (status) params.set("status", status);
	return adminGet<AdminSellerWithdrawalListResponse>(`/admin/order/withdrawals?${params.toString()}`);
}

export async function approveAdminWithdrawal(id: number, adminNotes?: string): Promise<AdminSellerWithdrawal> {
	return adminPost<AdminSellerWithdrawal>(`/admin/order/withdrawals/${id}/approve`, { admin_notes: adminNotes || undefined });
}

export async function rejectAdminWithdrawal(id: number, adminNotes?: string): Promise<AdminSellerWithdrawal> {
	return adminPost<AdminSellerWithdrawal>(`/admin/order/withdrawals/${id}/reject`, { admin_notes: adminNotes || undefined });
}

export async function processAdminWithdrawal(id: number, adminNotes?: string): Promise<AdminSellerWithdrawal> {
	return adminPost<AdminSellerWithdrawal>(`/admin/order/withdrawals/${id}/process`, { admin_notes: adminNotes || undefined });
}

export async function listAdminWithdrawalAudits(id: number): Promise<AdminSellerWithdrawalAuditListResponse> {
	return adminGet<AdminSellerWithdrawalAuditListResponse>(`/admin/order/withdrawals/${id}/audit`);
}

export async function listAdminSettlements(
	status = "",
	page = 1,
	limit = 20,
	filters?: {
		sellerID?: string;
		orderID?: string;
		dateFrom?: string;
		dateTo?: string;
	},
): Promise<AdminSellerSettlementListResponse> {
	const params = new URLSearchParams({ page: String(page), limit: String(limit) });
	if (status) params.set("status", status);
	if (filters?.sellerID) params.set("seller_id", filters.sellerID);
	if (filters?.orderID) params.set("order_id", filters.orderID);
	if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
	if (filters?.dateTo) params.set("date_to", filters.dateTo);
	return adminGet<AdminSellerSettlementListResponse>(`/admin/order/seller-balance/settlements?${params.toString()}`);
}

export async function decideAdminSettlement(
	id: number,
	body: { decision: string; release_amount?: number; admin_note?: string; metadata?: unknown },
): Promise<AdminSellerSettlementDecisionResponse> {
	return adminPost<AdminSellerSettlementDecisionResponse>(`/admin/order/seller-balance/settlements/${id}/decision`, body);
}
