import { useState } from "react";
import AdminUsersPanel from "./AdminUsersPanel";
import RolesPermissionsPanel from "./RolesPermissionsPanel";

export default function AdminsPage() {
  const [tab, setTab] = useState<"admins" | "roles">("admins");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("admins")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "admins" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Admin Users
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "roles" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Roles & Permissions
        </button>
      </div>

      {tab === "admins" ? <AdminUsersPanel /> : <RolesPermissionsPanel />}
    </div>
  );
}
