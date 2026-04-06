export type Role = {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
};

export type Permission = {
  id: string;
  name: string;
  description?: string;
};

export type RoleListResponse = {
  data: Role[];
};

export type RolePayload = {
  name: string;
  description?: string;
  permissions: string[];
};

export type AssignRolePayload = {
  admin_id: string;
  scope_business_id?: string | null;
};