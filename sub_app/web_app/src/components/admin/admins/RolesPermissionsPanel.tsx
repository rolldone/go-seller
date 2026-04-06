import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { listAdmins } from "./api";
import {
  assignRole,
  createRole,
  deleteRole,
  getRoleByID,
  getRoleAssignments,
  listPermissions,
  listRoles,
  unassignRole,
  updateRole,
} from "./rolesApi";
import type { Admin } from "./types";
import type { Permission, Role } from "./rolesTypes";

function groupPermissions(rows: Permission[]): Record<string, Permission[]> {
  const map: Record<string, Permission[]> = {};
  rows.forEach((perm) => {
    // Prefer explicit group label from backend (`description`), fallback to prefix of id.
    const groupLabel = perm.description && perm.description.trim() !== "" ? perm.description : (perm.id.includes(".") ? perm.id.split(".")[0] : "General");
    if (!map[groupLabel]) map[groupLabel] = [];
    map[groupLabel].push(perm);
  });

  Object.keys(map).forEach((k) => {
    map[k].sort((a, b) => a.name.localeCompare(b.name));
  });

  return map;
}

export default function RolesPermissionsPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedRoleID, setSelectedRoleID] = useState<string>("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [assignAdminID, setAssignAdminID] = useState("");
  const [assignScope, setAssignScope] = useState("");
  const [assignments, setAssignments] = useState<{ admin_id: string; username: string; email: string; scope_business_id?: string | null; created_at: string }[]>([]);

  const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions]);

  const resetRoleForm = () => {
    setSelectedRoleID("");
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissions([]);
    setAssignments([]);
  };

  const fetchAssignments = async (roleID: string) => {
    if (!roleID) {
      setAssignments([]);
      return;
    }
    try {
      const res = await getRoleAssignments(roleID);
      setAssignments(res.data || []);
    } catch {
      setAssignments([]);
    }
  };

  const loadData = async (opts?: { preferredRoleID?: string; silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [rolesRes, permissionsRes, adminsRes] = await Promise.all([
        listRoles(),
        listPermissions(),
        listAdmins({ page: 1, limit: 100 }),
      ]);

      setRoles(rolesRes);
      setPermissions(permissionsRes);
      setAdmins(adminsRes.data || []);

      if (rolesRes.length > 0) {
        const preferredRoleID = opts?.preferredRoleID ?? selectedRoleID;
        const current = rolesRes.find((r) => r.id === preferredRoleID) || rolesRes[0];
        setSelectedRoleID(current.id);
        setRoleName(current.name || "");
        setRoleDescription(current.description || "");
        setSelectedPermissions(current.permissions || []);
        await fetchAssignments(current.id);
      } else {
        resetRoleForm();
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to load roles & permissions");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSelectRole = async (roleID: string) => {
    setSelectedRoleID(roleID);
    if (!roleID) {
      resetRoleForm();
      return;
    }
    try {
      const detail = await getRoleByID(roleID);
      setRoleName(detail.name || "");
      setRoleDescription(detail.description || "");
      setSelectedPermissions(detail.permissions || []);
      await fetchAssignments(roleID);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to load role detail");
    }
  };

  const togglePermission = (name: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const onSaveRole = async () => {
    const name = roleName.trim();
    if (!name) {
      notifyError("Role name wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: roleDescription.trim(),
        permissions: selectedPermissions,
      };

      if (selectedRoleID) {
        await updateRole(selectedRoleID, payload);
        notifySuccess("Role updated");
        await loadData({ preferredRoleID: selectedRoleID, silent: true });
      } else {
        const created = await createRole(payload);
        notifySuccess("Role created");
        await loadData({ preferredRoleID: created.id, silent: true });
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteRole = async () => {
    if (!selectedRoleID) {
      notifyError("Pilih role dulu");
      return;
    }

    const confirmed = window.confirm("Hapus role terpilih?");
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteRole(selectedRoleID);
      notifySuccess("Role deleted");
      await loadData({ silent: true });
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  const onAssign = async () => {
    if (!selectedRoleID) {
      notifyError("Pilih role dulu");
      return;
    }
    if (!assignAdminID) {
      notifyError("Pilih admin dulu");
      return;
    }

    setSaving(true);
    try {
      await assignRole(selectedRoleID, {
        admin_id: assignAdminID,
        scope_business_id: assignScope.trim() ? assignScope.trim() : null,
      });
      notifySuccess("Role assigned");
      await fetchAssignments(selectedRoleID);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setSaving(false);
    }
  };

  const onUnassign = async () => {
    if (!selectedRoleID) {
      notifyError("Pilih role dulu");
      return;
    }
    if (!assignAdminID) {
      notifyError("Pilih admin dulu");
      return;
    }

    setSaving(true);
    try {
      await unassignRole(selectedRoleID, {
        admin_id: assignAdminID,
        scope_business_id: assignScope.trim() ? assignScope.trim() : null,
      });
      notifySuccess("Role unassigned");
      await fetchAssignments(selectedRoleID);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to unassign role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Roles & Permissions</h3>
        <p className="text-sm text-slate-600">Kelola role, permission, dan assignment role ke admin. <a href="/docs/admin-permissions.md" target="_blank" rel="noreferrer" className="ml-2 text-emerald-600 hover:underline">Docs</a></p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading roles and permissions...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Roles</p>
              <button
                type="button"
                onClick={resetRoleForm}
                className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                + New
              </button>
            </div>

            <div className="space-y-1">
              {roles.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada role.</p>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => onSelectRole(role.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedRoleID === role.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <p className="font-medium">{role.name}</p>
                    {role.description ? <p className="text-xs opacity-80">{role.description}</p> : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-700">Role Name</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="contoh: Catalog Manager"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-slate-700">Description</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="opsional"
                  />
                </label>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">Permissions</p>
                <div className="mt-2 max-h-[56vh] overflow-y-auto">
                  {Object.keys(permissionGroups).length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada permission.</p>
                  ) : (
                    Object.entries(permissionGroups)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([group, rows]) => (
                        <div key={group} className="mb-3 rounded-lg border border-slate-200 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {rows.map((perm) => (
                              <label key={perm.id} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.name)}
                                  onChange={() => togglePermission(perm.name)}
                                />
                                <span>{perm.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveRole}
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
                >
                  {saving ? "Saving..." : selectedRoleID ? "Save Changes" : "Create Role"}
                </button>
                <button
                  type="button"
                  disabled={saving || !selectedRoleID}
                  onClick={onDeleteRole}
                  className="rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-60"
                >
                  Delete Role
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Assign / Unassign Role</p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-700">Admin</span>
                  <select
                    value={assignAdminID}
                    onChange={(e) => setAssignAdminID(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select admin</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.username} ({admin.email})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-slate-700">Scope Business ID (optional)</span>
                  <input
                    value={assignScope}
                    onChange={(e) => setAssignScope(e.target.value)}
                    placeholder="kosongkan untuk global"
                    className="w-full rounded border border-slate-300 px-3 py-2 bg-slate-100 text-slate-500 cursor-not-allowed"
                    disabled
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onAssign}
                  className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70"
                >
                  Assign Role
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onUnassign}
                  className="rounded bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-70"
                >
                  Unassign Role
                </button>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">Assignments for this role</p>
                {assignments.length === 0 ? (
                  <p className="text-sm text-slate-500">No assignments.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Admin</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Scope</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Tanggal Assign</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {assignments.map((a) => (
                          <tr key={`${a.admin_id}-${a.scope_business_id || 'global'}`}
                            className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-900">{a.username}</div>
                              <div className="text-xs text-slate-600">{a.email}</div>
                            </td>
                            <td className="px-4 py-2">
                              {a.scope_business_id ? (
                                <span className="inline-block rounded bg-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900 border border-blue-300">{a.scope_business_id}</span>
                              ) : (
                                <span className="inline-block rounded bg-green-200 px-2 py-0.5 text-xs font-bold text-green-900 border border-green-300">global</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                                onClick={async () => {
                                  setAssignAdminID(a.admin_id);
                                  setAssignScope(a.scope_business_id || "");
                                  await onUnassign();
                                }}
                              >
                                Unassign
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}