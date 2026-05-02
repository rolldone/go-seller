export interface AdminSellerBalanceSummary {
	total_balance: number;
	seller_count: number;
	positive_balance_seller_count: number;
}

export interface AdminSellerBalanceSummaryResponse {
	summary: AdminSellerBalanceSummary;
}

export interface AdminSellerWithdrawal {
	id: number;
	seller_id: string;
	amount: number;
	status: "pending" | "approved" | "rejected" | "processed";
	bank_name: string;
	bank_account_number: string;
	bank_account_name: string;
	notes: string | null;
	admin_notes: string | null;
	reviewed_by_admin_id: string | null;
	reviewed_at: string | null;
	processed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface AdminSellerWithdrawalListResponse {
	data: AdminSellerWithdrawal[];
	total: number;
	limit: number;
	page: number;
}

export interface AdminSellerWithdrawalAudit {
	id: number;
	withdrawal_id: number;
	seller_id: string;
	action: "requested" | "approved" | "rejected" | "processed";
	actor_type: string;
	actor_id: string | null;
	status_from: string | null;
	status_to: string;
	notes: string | null;
	created_at: string;
}

export interface AdminSellerWithdrawalAuditListResponse {
	data: AdminSellerWithdrawalAudit[];
}
