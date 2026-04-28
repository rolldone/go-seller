export type DiscountType = "percentage" | "fixed";

export type Discount = {
	id: string;
	name: string;
	description?: string;
	discount_type: DiscountType;
	discount_value: number;
	product_ids?: string[];
	priority: number;
	max_discount_amount?: number;
	start_at: string;
	end_at?: string;
	product_min_qty?: number;
	product_qty_limit?: number;
	min_order_amount?: number;
	per_user_only: boolean;
	customer_id?: string | null;
	usage_limit?: number;
	usage_limit_per_user?: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

export type DiscountPayload = {
	name: string;
	description?: string;
	discount_type: DiscountType;
	discount_value: number;
	product_ids?: string[];
	priority: number;
	max_discount_amount?: number | null;
	start_at: string;
	end_at?: string | null;
	product_min_qty?: number | null;
	product_qty_limit?: number | null;
	min_order_amount?: number | null;
	per_user_only: boolean;
	customer_id?: string | null;
	usage_limit?: number | null;
	usage_limit_per_user?: number | null;
	is_active: boolean;
};

export type DiscountListParams = {
	q?: string;
	is_active?: "true" | "false" | "";
	page: number;
	limit: number;
};

export type DiscountListResponse = {
	data: Discount[];
	total?: number;
};