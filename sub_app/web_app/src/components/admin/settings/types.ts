export type SettingItem = {
  id: string;
  scope: string;
  key: string;
  value: unknown;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type ListSettingsParams = {
  q?: string;
  scope?: string;
  page?: number;
  limit?: number;
};

export type ListSettingsResponse = {
  data: SettingItem[];
  total: number;
};

export type SettingDetailResponse = {
  data: SettingItem;
};

export type UpsertSettingPayload = {
  scope: string;
  value: unknown;
  description?: string;
};
