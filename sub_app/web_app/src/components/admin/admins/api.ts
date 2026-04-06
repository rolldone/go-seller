import type {
  Admin,
  AdminListParams,
  AdminListResponse,
  CreateAdminPayload,
  UpdateAdminPayload,
} from "./types";
import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from "../entities/adminApi";

export async function listAdmins(params: AdminListParams): Promise<AdminListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.is_banned) query.set("is_banned", params.is_banned);
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));

  return adminGet<AdminListResponse>(`/admin/admins?${query.toString()}`);
}

export async function createAdmin(payload: CreateAdminPayload): Promise<Admin> {
  return adminPost<Admin>("/admin/admins", payload);
}

export async function updateAdmin(id: string, payload: UpdateAdminPayload): Promise<Admin> {
  return adminPut<Admin>(`/admin/admins/${id}`, payload);
}

export async function deleteAdmin(id: string): Promise<void> {
  await adminDelete(`/admin/admins/${id}`);
}

export async function restoreAdmin(id: string): Promise<void> {
  await adminPost<unknown>(`/admin/admins/${id}/restore`);
}

export async function changeAdminPassword(id: string, password: string): Promise<void> {
  await adminPatch<unknown>(`/admin/admins/${id}/change-password`, { password });
}
