import { adminDelete, adminGet, adminPut } from "../entities/adminApi";
import type {
  ListSettingsParams,
  ListSettingsResponse,
  SettingDetailResponse,
  UpsertSettingPayload,
} from "./types";

export async function listSettings(params: ListSettingsParams): Promise<ListSettingsResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.scope) query.set("scope", params.scope);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));

  return adminGet<ListSettingsResponse>(`/admin/settings?${query.toString()}`);
}

export async function getSettingByKey(key: string, scope = "global"): Promise<SettingDetailResponse> {
  const query = new URLSearchParams();
  query.set("scope", scope);
  return adminGet<SettingDetailResponse>(`/admin/settings/${encodeURIComponent(key)}?${query.toString()}`);
}

export async function upsertSetting(key: string, payload: UpsertSettingPayload): Promise<SettingDetailResponse> {
  return adminPut<SettingDetailResponse>(`/admin/settings/${encodeURIComponent(key)}`, payload);
}

export async function deleteSetting(key: string, scope = "global"): Promise<void> {
  const query = new URLSearchParams();
  query.set("scope", scope);
  await adminDelete(`/admin/settings/${encodeURIComponent(key)}?${query.toString()}`);
}
