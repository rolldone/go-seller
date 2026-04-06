import { customerApiRequest } from "../components/customer/auth/authApi";

export type Cart = {
  id: string;
  customer_id: string;
  business_id?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type CartItem = {
  id: string;
  cart_id: string;
  product_id?: string | null;
  product_name?: string;
  business_name?: string;
  variation_id?: string | null;
  sku?: string | null;
  image_url?: string | null;
  qty: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
  updated_at?: string;
};

export type CartResponse = {
  cart: Cart;
  items: CartItem[];
  item?: CartItem | null;
};

export type CartItemPreview = {
  id?: string;
  product_id?: string | null;
  product_name?: string;
  variation_id?: string | null;
  sku?: string | null;
  image_url?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  discount_amount: number;
  net_total: number;
  tax_amount: number;
  tax_type?: string;
  tax_rate?: number;
  payable_total: number;
};

export type AppliedCoupon = {
  code: string;
  category: string;
  discount_amount: number;
};

export type CartPreview = {
  cart: Cart;
  items: CartItemPreview[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  grand_total: number;
  applied_coupons?: AppliedCoupon[];
};

export type CartBusinessSummary = {
  cart_id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  item_count: number;
  total_qty: number;
  total_amount: number;
  updated_at?: string;
};

export type CartItemInput = {
  product_id: string;
  product_name: string;
  business_id?: string | null;
  business_name?: string;
  variation_id?: string | null;
  sku?: string | null;
  image_url?: string | null;
  qty: number;
  unit_price: number;
};

export async function getMyCart(businessID?: string | null): Promise<CartResponse> {
  const query = new URLSearchParams();
  if (businessID && businessID.trim()) {
    query.set("business_id", businessID.trim());
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await customerApiRequest<{ data: CartResponse }>(`/api/order/carts/me${suffix}`, { method: "GET" });
  return payload.data;
}

export async function addMyCartItem(input: CartItemInput): Promise<CartResponse> {
  const payload = await customerApiRequest<{ data: CartResponse }>("/api/order/carts/me/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function updateMyCartItem(itemID: string, qty: number): Promise<CartResponse> {
  const payload = await customerApiRequest<{ data: CartResponse }>(`/api/order/carts/me/items/${encodeURIComponent(itemID)}`, {
    method: "PATCH",
    body: JSON.stringify({ qty }),
  });
  return payload.data;
}

export async function deleteMyCartItem(itemID: string): Promise<CartResponse> {
  const payload = await customerApiRequest<{ data: CartResponse }>(`/api/order/carts/me/items/${encodeURIComponent(itemID)}`, {
    method: "DELETE",
  });
  return payload.data;
}

export async function checkoutMyCart(currency = "IDR", businessID?: string | null, couponCode?: string | null, addressID?: string | null): Promise<unknown> {
  const query = new URLSearchParams();
  if (businessID && businessID.trim()) {
    query.set("business_id", businessID.trim());
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const normalizedCouponCode = couponCode?.trim() || "";
  const payload = await customerApiRequest<{ data: unknown }>(`/api/order/carts/me/checkout${suffix}`, {
    method: "POST",
    body: JSON.stringify({
      currency,
      coupon_code: normalizedCouponCode || undefined,
      address_id: addressID?.trim() || undefined,
    }),
  });
  return payload.data;
}

export async function getCartPreview(businessID?: string | null, couponCode?: string | null): Promise<CartPreview> {
  const query = new URLSearchParams();
  if (businessID && businessID.trim()) {
    query.set("business_id", businessID.trim());
  }
  if (couponCode && couponCode.trim()) {
    query.set("coupon_code", couponCode.trim());
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await customerApiRequest<{ data: CartPreview }>(`/api/order/carts/me/preview${suffix}`, { method: "GET" });
  return payload.data;
}

export async function getMyCartBusinesses(): Promise<CartBusinessSummary[]> {
  const payload = await customerApiRequest<{ data: CartBusinessSummary[] }>("/api/order/carts/me/businesses", { method: "GET" });
  return payload.data || [];
}