export type Customer = {
  id: string;
  name: string;
  email: string;
  locale?: "id" | "en";
  phone?: string | null;
  notes?: string | null;
  is_active: boolean;
  is_banned: boolean;
  banned_at?: string | null;
  banned_until?: string | null;
  ban_reason?: string | null;
  banned_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type CustomerListResponse = {
  data: Customer[];
  total: number;
};

export type CustomerListParams = {
  q?: string;
  email?: string;
  is_active?: "true" | "false" | "";
  is_banned?: "true" | "false" | "";
  with_deleted?: boolean;
  page: number;
  limit: number;
};

export type CustomerPayload = {
  name: string;
  email: string;
  locale?: "id" | "en";
  phone?: string;
  notes?: string;
  is_active: boolean;
};