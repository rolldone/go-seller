import { adminGet, adminGetBlob, adminPatch, adminPost, adminPut } from "../entities/adminApi";
import type {
  GenerateCheckoutLinkResponse,
  ListOrdersParams,
  Order,
  OrderDetailResponse,
  OrderListResponse,
  PaymentProofListResponse,
  ShipmentListResponse,
  ShippableItemsResponse,
  OrderShipment,
} from "./types";

const toQuery = (params: ListOrdersParams): string => {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.business_id) q.set("business_id", params.business_id);
  if (params.user_id) q.set("user_id", params.user_id);
  if (params.status) q.set("status", params.status);
  if (params.payment_status) q.set("payment_status", params.payment_status);
  if (params.dispute_decision) q.set("dispute_decision", params.dispute_decision);
  if (params.channel) q.set("channel", params.channel);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.sort) q.set("sort", params.sort);
  q.set("page", String(params.page ?? 1));
  q.set("limit", String(params.limit ?? 20));
  return q.toString();
};

export async function listOrders(params: ListOrdersParams): Promise<OrderListResponse> {
  const query = toQuery(params);
  return adminGet<OrderListResponse>(`/admin/order/orders?${query}`);
}

export async function getOrderByID(orderID: string): Promise<OrderDetailResponse> {
  return adminGet<OrderDetailResponse>(`/admin/order/orders/${orderID}`);
}

export async function generateCheckoutLink(orderID: string, ttlSeconds = 3600): Promise<GenerateCheckoutLinkResponse> {
  return adminPost<GenerateCheckoutLinkResponse>(`/admin/order/orders/${orderID}/guest-token`, { ttl_seconds: ttlSeconds });
}

export async function updateShippingQuote(
  orderID: string,
  input: {
    shipping_amount: number;
    carrier_name?: string;
    service_name?: string;
    estimated_delivery?: string;
    description?: string;
    notes?: string;
  },
): Promise<{ data: Order }> {
  return adminPut<{ data: Order }>(`/admin/order/orders/${orderID}/shipping`, input);
}

export async function updateOrderShippingAddress(
  orderID: string,
  payload: { address_id: string },
): Promise<{ data: Order }> {
  return adminPost<{ data: Order }>(`/admin/order/orders/${orderID}/shipping-address`, payload);
}

export async function listPaymentProofs(paymentID: string): Promise<PaymentProofListResponse> {
  return adminGet<PaymentProofListResponse>(`/admin/order/payments/${paymentID}/proofs`);
}

export async function validateOrderPaymentFromHistory(
  orderID: string,
  paymentID: string,
  payload: { note?: string },
): Promise<{ data: Order }> {
  return adminPost<{ data: Order }>(`/admin/order/orders/${orderID}/payments/${paymentID}/validate`, payload);
}

export async function downloadOrderInvoice(orderID: string): Promise<Blob> {
  return adminGetBlob(`/admin/order/orders/${orderID}/invoice`);
}

export async function listOrderShipments(orderID: string): Promise<ShipmentListResponse> {
  return adminGet<ShipmentListResponse>(`/admin/order/orders/${orderID}/shipments`);
}

export async function listShippableItems(orderID: string): Promise<ShippableItemsResponse> {
  return adminGet<ShippableItemsResponse>(`/admin/order/orders/${orderID}/shippable-items`);
}

export async function createOrderShipment(
  orderID: string,
  payload: {
    carrier_name?: string;
    service_name?: string;
    tracking_number?: string;
    shipping_amount?: number;
    estimated_delivery?: string;
    description?: string;
    notes?: string;
    item_ids?: string[];
  },
): Promise<OrderShipment> {
  return adminPost<OrderShipment>(`/admin/order/orders/${orderID}/shipments`, payload);
}

export type ShipmentStatus =
  | "pending"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled";

export async function updateOrderShipmentStatus(
  shipmentID: string,
  status: ShipmentStatus,
): Promise<OrderShipment> {
  return adminPatch<OrderShipment>(`/admin/order/shipments/${shipmentID}`, { status });
}

export async function updateOrderShipment(
  shipmentID: string,
  payload: {
    carrier_name?: string;
    service_name?: string;
    tracking_number?: string;
    shipping_amount?: number;
    estimated_delivery?: string;
    description?: string;
    notes?: string;
    status?: ShipmentStatus;
  },
): Promise<OrderShipment> {
  return adminPatch<OrderShipment>(`/admin/order/shipments/${shipmentID}`, payload);
}

export async function resolveOrderDisputeForSeller(orderID: string, note: string): Promise<{ data: Order }> {
  return adminPost<{ data: Order }>(`/admin/order/orders/${orderID}/dispute/resolve-seller`, { note });
}

export async function resolveOrderDisputeForCustomer(orderID: string, note: string): Promise<{ data: Order }> {
  return adminPost<{ data: Order }>(`/admin/order/orders/${orderID}/dispute/resolve-customer`, { note });
}

export async function markOrderDisputeRefundCompleted(orderID: string, note: string): Promise<{ data: Order }> {
  return adminPost<{ data: Order }>(`/admin/order/orders/${orderID}/dispute/refund-completed`, { note });
}
