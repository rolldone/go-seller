import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type { PaymentMethod, PaymentProvider, PaymentReconciliationItem, PaymentReconciliationSummary } from "./types";

type ProviderListResponse = { data: PaymentProvider[] };
type ProviderItemResponse = { data: PaymentProvider };

type ReportResponse = {
  data: PaymentReconciliationItem[];
  total: number;
  summary: PaymentReconciliationSummary;
};

export type UpsertProviderPayload = {
  business_id?: string;
  name: string;
  provider_key: string;
  is_active: boolean;
  is_used?: boolean;
  config?: Record<string, unknown>;
  credentials_encrypted?: string;
};

export async function listPaymentProviders(includeInactive = true): Promise<PaymentProvider[]> {
  const q = includeInactive ? "?include_inactive=true" : "";
  const res = await adminGet<ProviderListResponse>(`/admin/order/payment-providers${q}`);
  return res.data || [];
}

export async function createPaymentProvider(payload: UpsertProviderPayload): Promise<PaymentProvider> {
  const res = await adminPost<ProviderItemResponse>("/admin/order/payment-providers", payload);
  return res.data;
}

export async function updatePaymentProvider(id: string, payload: UpsertProviderPayload): Promise<PaymentProvider> {
  const res = await adminPut<ProviderItemResponse>(`/admin/order/payment-providers/${id}`, payload);
  return res.data;
}

export async function activatePaymentProvider(id: string): Promise<PaymentProvider> {
  const res = await adminPost<ProviderItemResponse>(`/admin/order/payment-providers/${id}/activate`);
  return res.data;
}

export async function getPaymentReconciliationReport(params: {
  provider_key?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<ReportResponse> {
  const sp = new URLSearchParams();
  if (params.provider_key) sp.set("provider_key", params.provider_key);
  if (params.status) sp.set("status", params.status);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  const query = sp.toString();
  return adminGet<ReportResponse>(`/admin/order/payments/report${query ? `?${query}` : ""}`);
}

// ─── PaymentMethod API ─────────────────────────────────────────────────────────

type MethodListResponse = { data: PaymentMethod[] };
type MethodItemResponse = { data: PaymentMethod };

export type UpsertMethodPayload = {
  business_id?: string;
  provider_id: string;
  name: string;
  code: string;
  category?: string;
  is_active: boolean;
  sort_order?: number;
  icon_url?: string;
};

export async function listPaymentMethods(params?: {
  provider_id?: string;
  category?: string;
  include_inactive?: boolean;
}): Promise<PaymentMethod[]> {
  const sp = new URLSearchParams();
  if (params?.provider_id) sp.set("provider_id", params.provider_id);
  if (params?.category) sp.set("category", params.category);
  if (params?.include_inactive) sp.set("include_inactive", "true");
  const q = sp.toString();
  const res = await adminGet<MethodListResponse>(`/admin/order/payment-methods${q ? `?${q}` : ""}`);
  return res.data || [];
}

export async function createPaymentMethod(payload: UpsertMethodPayload): Promise<PaymentMethod> {
  const res = await adminPost<MethodItemResponse>("/admin/order/payment-methods", payload);
  return res.data;
}

export async function updatePaymentMethod(id: string, payload: UpsertMethodPayload): Promise<PaymentMethod> {
  const res = await adminPut<MethodItemResponse>(`/admin/order/payment-methods/${id}`, payload);
  return res.data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await adminDelete(`/admin/order/payment-methods/${id}`);
}
