import { adminGet, adminPost } from "../entities/adminApi";
import type {
	AdminSellerBalanceSummaryResponse,
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
