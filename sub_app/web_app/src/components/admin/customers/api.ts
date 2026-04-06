import type { Customer, CustomerListParams, CustomerListResponse, CustomerPayload } from "./types";
import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from "../entities/adminApi";

export async function listCustomers(params: CustomerListParams): Promise<CustomerListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.email) query.set("email", params.email);
  if (params.is_active) query.set("is_active", params.is_active);
  if (params.is_banned) query.set("is_banned", params.is_banned);
  if (params.with_deleted) query.set("with_deleted", "true");
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));

  return adminGet<CustomerListResponse>(`/admin/customers?${query.toString()}`);
}

export async function createCustomer(input: CustomerPayload): Promise<Customer> {
  return adminPost<Customer>("/admin/customers", input);
}

export async function updateCustomer(id: string, input: CustomerPayload): Promise<Customer> {
  return adminPut<Customer>(`/admin/customers/${id}`, input);
}

export async function deleteCustomer(id: string): Promise<void> {
  await adminDelete(`/admin/customers/${id}`);
}

export async function restoreCustomer(id: string): Promise<void> {
  await adminPost(`/admin/customers/${id}/restore`);
}

export async function banCustomer(id: string, payload: { reason: string; banned_until?: string }): Promise<void> {
  await adminPost(`/admin/customers/${id}/ban`, payload);
}

export async function unbanCustomer(id: string): Promise<void> {
  await adminPost(`/admin/customers/${id}/unban`);
}