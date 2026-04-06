export type Business = {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  description_html?: string | null;
  description_plain?: string | null;
  description_blocks?: unknown;
  highlights?: string[];
  owner_name?: string | null;
  owner_role?: string | null;
  founded_year?: number | null;
  address?: string | null;
  operational_hours?: Record<string, string> | null;
  chat_response_time?: string | null;
  email?: string | null;
  phone?: string | null;
  show_contact_email: boolean;
  show_phone: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessPayload = {
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  description_html?: string;
  description_plain?: string;
  description_blocks?: unknown;
  highlights?: string[];
  owner_name?: string | null;
  owner_role?: string | null;
  founded_year?: number | null;
  address?: string | null;
  operational_hours?: unknown;
  chat_response_time?: string | null;
  email?: string | null;
  phone?: string | null;
  show_contact_email?: boolean;
  show_phone?: boolean;
};

export type BusinessListResponse = { data: Business[]; total: number };
