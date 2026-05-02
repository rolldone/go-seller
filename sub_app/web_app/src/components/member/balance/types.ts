export interface SellerBalance {
	id: number;
	seller_id: string;
	balance: number; // in cents
	updated_at: string;
}

export interface SellerBalanceMutation {
	id: number;
	seller_id: string;
	mutation_type: "credit" | "debet";
	amount: number; // in cents
	source: string;
	reference_id: string | null;
	reference_type: string | null;
	description: string | null;
	balance_after: number; // in cents
	created_at: string;
}

export interface SellerBalanceMutationListResponse {
	data: SellerBalanceMutation[];
	total: number;
	limit: number;
	page: number;
}

export interface SellerWithdrawal {
	id: number;
	seller_id: string;
	amount: number; // in cents
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

export interface SellerWithdrawalListResponse {
	data: SellerWithdrawal[];
	total: number;
	limit: number;
	page: number;
}

export interface CreateWithdrawalPayload {
	amount: number; // in cents
	bank_name: string;
	bank_account_number: string;
	bank_account_name: string;
	notes?: string;
}
