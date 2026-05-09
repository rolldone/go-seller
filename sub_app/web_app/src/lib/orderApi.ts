import {
  customerApiRequest,
  CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR,
  getCustomerAuthToken,
} from "../components/customer/auth/authApi";
import type { PublicBusiness } from "../components/front/business/types";

export type AppliedCoupon = {
  code: string;
  category: string;
  discount_amount: number;
};

export type OrderExtraCharge = {
  id: string;
  order_id: string;
  name: string;
  amount: number;
  notes?: string | null;
  sort_order: number;
  created_by_admin_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name?: string;
  sku?: string | null;
  discount_name?: string | null;
  qty: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  tax_type?: string;
  tax_rate?: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  provider_id?: string | null;
  provider_key?: string | null;
  provider_transaction_id?: string | null;
  external_reference?: string | null;
  proof_status?: string;
  payment_method?: string | null;
  gateway_name?: string | null;
  gateway_transaction_id?: string | null;
  metadata?: unknown;
  payment_instruction?: PaymentInstruction | null;
  paid_at?: string | null;
  failed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_id?: string | null;
  business_id?: string | null;
  channel: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  fulfillment_type?: string;
  grand_total: number;
  notes?: string | null;
  metadata?: unknown;
  applied_coupons?: AppliedCoupon[] | null;
  extra_charges?: OrderExtraCharge[] | null;
  placed_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  payments?: Payment[];
  customer?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
};

export type OrderPaymentProvider = {
  id: string;
  name: string;
  provider_key: string;
  is_active: boolean;
  config?: {
    bank_name?: string;
    account_number?: string;
    account_holder?: string;
    account_name?: string;
    reference?: string;
    instructions?: string;
  };
};

export type PaymentInstruction = {
  type: "va" | "qris" | "redirect" | "ewallet" | "cash" | "cstore" | string;
  display_name: string;
  virtual_account_number?: string | null;
  bank_code?: string | null;
  qr_string?: string | null;
  redirect_url?: string | null;
  amount: number;
  currency: string;
  expired_at?: string | null;
  steps?: string[];
  extra_info?: Record<string, unknown> | null;
};

export type OrderPaymentMethod = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  provider_id: string;
  business_id?: string | null;
  config?: Record<string, unknown> | null;
  provider?: {
    id: string;
    name: string;
    provider_key: string;
  } | null;
};

export type MyOrderDetailResponse = {
  data: {
    order: Order;
    payments: Payment[];
    providers: OrderPaymentProvider[];
    business?: Pick<PublicBusiness, "id" | "name" | "slug" | "short_description"> | null;
  };
};

export type MyOrderListResponse = {
  data: Order[];
  total: number;
};

export type PaymentProof = {
  id: string;
  payment_id: string;
  order_id: string;
  mime_type: string;
  file_size: number;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type CustomerReview = {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  review_text: string;
  question_text: string;
  seller_reply?: string | null;
  seller_reply_at?: string | null;
  status: string;
  is_visible: boolean;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
};

export type ReviewableOrderItem = {
  order_item_id: string;
  product_id?: string | null;
  product_name: string;
  sku?: string | null;
  can_review: boolean;
  reason?: string;
  review?: CustomerReview | null;
};

export type ProductReviewStats = {
  total_reviews: number;
  average_rating: number;
  rating_count: Record<number, number>;
};

function getApiUrl() {
  return import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";
}

async function customerBlobRequest(path: string): Promise<Blob> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }

  const token = getCustomerAuthToken();
  if (!token) {
    throw new Error(CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new Error(CUSTOMER_UNAUTHORIZED_REDIRECT_ERROR);
    }
    throw new Error(message);
  }

  return response.blob();
}

export async function listMyOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  payment_status?: string;
  q?: string;
}): Promise<MyOrderListResponse> {
  const query = new URLSearchParams();
  if (params?.page && params.page > 0) query.set("page", String(params.page));
  if (params?.limit && params.limit > 0) query.set("limit", String(params.limit));
  if (params?.status?.trim()) query.set("status", params.status.trim());
  if (params?.payment_status?.trim()) query.set("payment_status", params.payment_status.trim());
  if (params?.q?.trim()) query.set("q", params.q.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return customerApiRequest<MyOrderListResponse>(`/api/order/orders/me${suffix}`, { method: "GET" });
}

export async function getMyOrderByID(orderID: string): Promise<MyOrderDetailResponse> {
  return customerApiRequest<MyOrderDetailResponse>(`/api/order/orders/me/${encodeURIComponent(orderID)}`, { method: "GET" });
}

export async function listOrderPaymentMethods(businessID: string): Promise<{ data: OrderPaymentMethod[] }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  const qs = businessID ? `?business_id=${encodeURIComponent(businessID)}` : "";
  const response = await fetch(`${apiUrl}/api/order/payment-methods${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string; message?: string })?.error || (payload as { error?: string; message?: string })?.message || `HTTP ${response.status}`);
  }
  return response.json() as Promise<{ data: OrderPaymentMethod[] }>;
}

export async function updateMyOrderShippingAddress(orderID: string, addressID: string): Promise<{ data: Order }> {
  return customerApiRequest<{ data: Order }>(`/api/order/orders/me/${encodeURIComponent(orderID)}/shipping-address`, {
    method: "POST",
    body: JSON.stringify({ address_id: addressID }),
  });
}

export async function startMyOrderPayment(orderID: string, payload: FormData | Record<string, unknown>): Promise<{ data: Payment; payment_instruction?: PaymentInstruction }> {
  const init: RequestInit = {
    method: "POST",
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  };
  return customerApiRequest<{ data: Payment; payment_instruction?: PaymentInstruction }>(`/api/order/orders/me/${encodeURIComponent(orderID)}/start-payment`, init);
}

export async function listMyOrderPaymentProofs(orderID: string, paymentID: string): Promise<{ data: PaymentProof[] }> {
  return customerApiRequest<{ data: PaymentProof[] }>(
    `/api/order/orders/me/${encodeURIComponent(orderID)}/payments/${encodeURIComponent(paymentID)}/proofs`,
    { method: "GET" },
  );
}

export async function downloadMyOrderInvoice(orderID: string): Promise<Blob> {
  return customerBlobRequest(`/api/order/orders/me/${encodeURIComponent(orderID)}/invoice`);
}

export async function getMyOrderPaymentProofBlob(orderID: string, paymentID: string, proofID: string): Promise<Blob> {
  return customerBlobRequest(
    `/api/order/orders/me/${encodeURIComponent(orderID)}/payments/${encodeURIComponent(paymentID)}/proofs/${encodeURIComponent(proofID)}/access`,
  );
}

export async function listMyOrderReviewableItems(orderID: string): Promise<{ data: ReviewableOrderItem[] }> {
  return customerApiRequest<{ data: ReviewableOrderItem[] }>(
    `/api/review/my/orders/${encodeURIComponent(orderID)}/items`,
    { method: "GET" },
  );
}

export async function upsertMyOrderItemReview(
  orderID: string,
  orderItemID: string,
  payload: { rating: number; review_text?: string; question_text?: string } | FormData,
): Promise<{ data: CustomerReview }> {
  return customerApiRequest<{ data: CustomerReview }>(
    `/api/review/my/orders/${encodeURIComponent(orderID)}/items/${encodeURIComponent(orderItemID)}`,
    {
      method: "POST",
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    },
  );
}

export async function getProductReviewStats(productID: string): Promise<{ data: ProductReviewStats }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("PUBLIC_API_URL belum dikonfigurasi");
  }
  const response = await fetch(
    `${apiUrl}/api/review/products/${encodeURIComponent(productID)}/stats`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch review stats: ${response.status}`);
  }
  return response.json();
}