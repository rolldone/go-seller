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

export type CustomerAddress = {
  id: string;
  customer_id: string;
  label: string;
  receiver_name: string;
  phone_number: string;
  address_line_1: string;
  address_line_2?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  notes?: string | null;
  is_primary: boolean;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type CustomerAddressInput = {
  label?: string;
  receiver_name: string;
  phone_number: string;
  address_line_1: string;
  address_line_2?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  notes?: string | null;
  is_primary?: boolean;
  metadata?: Record<string, unknown>;
};