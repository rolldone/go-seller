import { adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { PaymentGatewayProvider, ValidateGatewayPayload, ValidateGatewayResult, LogListResponse } from "./types";

type ListResponse = { data: PaymentGatewayProvider[] };
type ItemResponse = { data: PaymentGatewayProvider };

export type UpsertGatewayPayload = {
  name: string;
  provider_key: string;
  is_active: boolean;
  config?: Record<string, unknown>;
};

export async function listGateways(): Promise<PaymentGatewayProvider[]> {
  const res = await adminGet<ListResponse>("/admin/payment-gateways");
  return res.data || [];
}

export async function createGateway(payload: UpsertGatewayPayload): Promise<PaymentGatewayProvider> {
  const res = await adminPost<ItemResponse>("/admin/payment-gateways", payload);
  return res.data;
}

export async function updateGateway(id: string, payload: UpsertGatewayPayload): Promise<PaymentGatewayProvider> {
  const res = await adminPut<ItemResponse>(`/admin/payment-gateways/${id}`, payload);
  return res.data;
}

export async function activateGateway(id: string): Promise<PaymentGatewayProvider> {
  const res = await adminPost<ItemResponse>(`/admin/payment-gateways/${id}/activate`);
  return res.data;
}

export async function deactivateGateway(id: string): Promise<PaymentGatewayProvider> {
  const res = await adminPost<ItemResponse>(`/admin/payment-gateways/${id}/deactivate`);
  return res.data;
}

export async function validateGateway(payload: ValidateGatewayPayload): Promise<ValidateGatewayResult> {
  return adminPost<ValidateGatewayResult>("/admin/payment-gateways/validate", payload);
}

export type LogListParams = {
  provider_key?: string;
  direction?: string;
  event_type?: string;
  reference_id?: string;
  page?: number;
  per_page?: number;
};

export async function listLogs(params: LogListParams = {}): Promise<LogListResponse> {
  const qs = new URLSearchParams();
  if (params.provider_key) qs.set("provider_key", params.provider_key);
  if (params.direction) qs.set("direction", params.direction);
  if (params.event_type) qs.set("event_type", params.event_type);
  if (params.reference_id) qs.set("reference_id", params.reference_id);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return adminGet<LogListResponse>(`/admin/payment-gateways/logs${query}`);
}

