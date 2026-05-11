export interface AdminSellerBalanceSummary {
	total_balance: number;
	seller_count: number;
	positive_balance_seller_count: number;
	settlement_total_count: number;
	settlement_pending_count: number;
	settlement_pending_amount: number;
	settlement_held_count: number;
	settlement_held_amount: number;
	settlement_partially_released_count: number;
	settlement_partially_released_remaining_amount: number;
	settlement_released_count: number;
	settlement_released_amount: number;
	settlement_refunded_count: number;
	settlement_refunded_amount: number;
	settlement_reversed_count: number;
	settlement_reversed_amount: number;
	settlement_locked_amount: number;
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

export interface AdminSellerSettlement {
	id: number;
	seller_id: string;
	order_id: string;
	gross_amount: number;
	released_amount: number;
	release_scope: string;
	status: "pending" | "held" | "partially_released" | "released" | "refunded" | "reversed";
	source: string;
	reference_id: string | null;
	reference_type: string | null;
	metadata?: string | null;
	admin_id: string | null;
	admin_note: string | null;
	decided_at: string | null;
	released_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface AdminSellerSettlementListResponse {
	data: AdminSellerSettlement[];
	total: number;
	limit: number;
	page: number;
}

export interface AdminSellerBalanceMutation {
	id: number;
	seller_id: string;
	mutation_type: "credit" | "debet";
	amount: number;
	source: string;
	reference_id: string | null;
	reference_type: string | null;
	description: string | null;
	balance_after: number;
	created_at: string;
}

export interface AdminSellerSettlementDecisionResponse {
	settlement: AdminSellerSettlement;
	mutation: AdminSellerBalanceMutation | null;
}
