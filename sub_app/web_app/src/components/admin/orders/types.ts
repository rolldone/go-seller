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
  product_type?: string;
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
  paid_at?: string | null;
  failed_at?: string | null;
  created_at: string;
  updated_at: string;
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

export type Order = {
  id: string;
  order_number: string;
  user_id?: string | null;
  customer_id?: string | null;
  business_id?: string | null;
  channel: string;
  created_by_admin_id?: string | null;
  status: string;
  payment_status: string;
  delivery_status: string;
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
  shipments?: OrderShipment[];
  customer?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
};

export type OrderShipmentItem = {
  id: string;
  shipment_id: string;
  order_item_id: string;
  qty: number;
  created_at: string;
};

export type OrderShipment = {
  id: string;
  order_id: string;
  carrier_name: string;
  service_name: string;
  tracking_number: string;
  shipping_amount: number;
  estimated_delivery: string;
  description: string;
  notes: string;
  status: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderShipmentItem[];
};

export type ListOrdersParams = {
  q?: string;
  business_id?: string;
  user_id?: string;
  status?: string;
  payment_status?: string;
  dispute_decision?: string;
  channel?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export type OrderListResponse = {
  data: Order[];
  total: number;
};

export type OrderDetailResponse = {
  data: {
    order: Order;
    payments: Payment[];
  };
};

export type GenerateCheckoutLinkResponse = {
  data: {
    token: string;
    order_id: string;
    customer_id: string;
    issued_at: string;
    expires_at: string;
    checkout_url: string;
  };
};

export type PaymentProofListResponse = {
  data: PaymentProof[];
};

export type ShipmentListResponse = {
  data: OrderShipment[];
};

export type ShippableItemsResponse = {
  data: OrderItem[];
};
