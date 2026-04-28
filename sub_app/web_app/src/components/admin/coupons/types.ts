export type CouponType = "percentage" | "fixed";
export type CouponCategory = "product_discount" | "total_discount" | "shipping_discount" | "cashback";

export type Coupon = {
  id: string;
  code: string;
  name: string;
  business_id?: string | null;
  category: CouponCategory;
  description?: string | null;
  discount_type: CouponType;
  discount_value: number;
  max_discount_amount?: number | null;
  start_at: string;
  end_at?: string | null;
  product_ids?: string[];
  product_min_qty?: number | null;
  product_qty_limit?: number | null;
  min_order_amount?: number | null;
  per_user_only: boolean;
  customer_id?: string | null;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponListResponse = {
  data: Coupon[];
  total: number;
};

export type CouponListParams = {
  q?: string;
  product_id?: string;
  customer_id?: string;
  business_id?: string;
  is_active?: "true" | "false" | "";
  page: number;
  limit: number;
};

export type CouponPayload = {
  code: string;
  name: string;
  business_id?: string | null;
  category: CouponCategory;
  description?: string;
  discount_type: CouponType;
  discount_value: number;
  max_discount_amount?: number | null;
  start_at: string;
  end_at?: string | null;
  product_ids?: string[];
  product_min_qty?: number | null;
  product_qty_limit?: number | null;
  min_order_amount?: number | null;
  per_user_only: boolean;
  customer_id?: string | null;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  is_active: boolean;
};
