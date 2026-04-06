import { adminDelete, adminGet, adminPost, adminPut } from "../entities/adminApi";
import type {
  AssignRolePayload,
  Permission,
  Role,
  RoleListResponse,
  RolePayload,
} from "./rolesTypes";

function normalizeRoles(payload: unknown): Role[] {
  if (Array.isArray(payload)) return payload as Role[];
  if (!payload || typeof payload !== "object") return [];

  const maybe = payload as { data?: unknown };
  if (Array.isArray(maybe.data)) return maybe.data as Role[];
  return [];
}

function normalizePermissions(payload: unknown): Permission[] {
  if (Array.isArray(payload)) return payload as Permission[];
  if (!payload || typeof payload !== "object") return [];

  const maybe = payload as { data?: unknown };
  if (Array.isArray(maybe.data)) return maybe.data as Permission[];

  // Support grouped response shape: { data: { Catalog: ["catalog.view"] } }
  if (maybe.data && typeof maybe.data === "object") {
    const groups = maybe.data as Record<string, string[]>;
    const rows: Permission[] = [];
    Object.entries(groups).forEach(([group, names]) => {
      names.forEach((name) => rows.push({ id: name, name, description: group }));
    });
    return rows;
  }

  return [];
}

export async function listRoles(): Promise<Role[]> {
  const payload = await adminGet<RoleListResponse | Role[]>("/admin/roles");
  return normalizeRoles(payload);
}

export async function getRoleByID(roleID: string): Promise<Role> {
  return adminGet<Role>(`/admin/roles/${roleID}`);
}

export async function createRole(payload: RolePayload): Promise<Role> {
  return adminPost<Role>("/admin/roles", payload);
}

export async function updateRole(roleID: string, payload: RolePayload): Promise<Role> {
  return adminPut<Role>(`/admin/roles/${roleID}`, payload);
}

export async function deleteRole(roleID: string): Promise<void> {
  await adminDelete(`/admin/roles/${roleID}`);
}

export async function listPermissions(): Promise<Permission[]> {
  const payload = await adminGet<{ data?: Permission[] | Record<string, string[]> } | Permission[]>("/admin/permissions");
  return normalizePermissions(payload);
}

export async function assignRole(roleID: string, payload: AssignRolePayload): Promise<void> {
  await adminPost(`/admin/roles/${roleID}/assign`, payload);
}

export async function unassignRole(roleID: string, payload: AssignRolePayload): Promise<void> {
  await adminPost(`/admin/roles/${roleID}/unassign`, payload);
}

export async function getRoleAssignments(roleID: string): Promise<{ data: { admin_id: string; username: string; email: string; scope_business_id?: string | null; created_at: string }[] }> {
  return adminGet(`/admin/roles/${roleID}/assignments`);
}