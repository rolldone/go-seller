export type Admin = {
  id: string;
  username: string;
  email: string;
  is_activated_at?: string | null;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
  roles?: { id: string; name: string; description?: string | null }[];
};

export type AdminListResponse = {
  data: Admin[];
  total: number;
  page: number;
  limit: number;
};

export type AdminListParams = {
  q?: string;
  is_banned?: "" | "true" | "false";
  page: number;
  limit: number;
};

export type CreateAdminPayload = {
  username: string;
  email: string;
  password: string;
  activated: boolean;
};

export type UpdateAdminPayload = {
  username: string;
  email: string;
};
