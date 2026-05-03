/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import { adminGet, adminPost } from "../entities/adminApi";
import AdminModal from "../ui/AdminModal";
import type { Business } from "./types";

type InviteRole = "owner" | "fulfillment" | "finance" | "cs";

type InviteRoleOption = {
  value: InviteRole;
  label: string;
  description?: string;
};

type InviteContext = {
  business_id: string;
  business_name: string;
  business_slug: string;
  has_owner: boolean;
  role_options: InviteRoleOption[];
};

type InviteContextResponse = {
  data?: InviteContext;
  error?: string;
};

type CandidateUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string | null;
  is_active: boolean;
  is_banned: boolean;
  created_at: string;
};

type CandidateResponse = {
  data?: CandidateUser[];
  total?: number;
  error?: string;
};

type InviteMode = "existing" | "email";

type Props = {
  open: boolean;
  business: Business | null;
  onClose: () => void;
  onSaved?: () => void;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default function BusinessInviteModal({ open, business, onClose, onSaved }: Props) {
  const [context, setContext] = useState<InviteContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [mode, setMode] = useState<InviteMode>("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CandidateUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CandidateUser | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole | "">("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !business) {
      setContext(null);
      setMode("existing");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser(null);
      setEmail("");
      setRole("");
      return;
    }

    let cancelled = false;

    const loadContext = async () => {
      setLoadingContext(true);
      try {
        const res = await adminGet<InviteContextResponse>(`/admin/catalog/businesses/${encodeURIComponent(business.id)}/team/invite-context`);
        if (cancelled) return;
        const data = res.data || null;
        setContext(data);
        const preferredRole = data?.role_options.find((option) => option.value === "owner")?.value || data?.role_options[0]?.value || "";
        setRole(preferredRole);
      } catch (err) {
        if (!cancelled) {
          notifyError(err instanceof Error ? err.message : "Gagal memuat konteks invite");
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    };

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [business, open]);

  useEffect(() => {
    if (!open || !business || mode !== "existing") {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await adminGet<CandidateResponse>(
          `/admin/catalog/businesses/${encodeURIComponent(business.id)}/team/candidates?q=${encodeURIComponent(query)}&page=1&limit=8`,
        );
        if (controller.signal.aborted) return;
        setSearchResults(res.data || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          notifyError(err instanceof Error ? err.message : "Gagal mencari existing user");
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [business, mode, open, searchQuery]);

  const handleSubmit = async () => {
    if (!business) return;
    if (!email.trim()) {
      if (mode === "email") {
        notifyError("Email wajib diisi");
        return;
      }
    }
    if (!role) {
      notifyError("Role wajib dipilih");
      return;
    }
    if (mode === "existing" && !selectedUser) {
      notifyError("Pilih existing user dulu");
      return;
    }
    if (mode === "email" && !email.trim()) {
      notifyError("Email wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost(`/admin/catalog/businesses/${encodeURIComponent(business.id)}/team/members/invite`,
        mode === "existing"
          ? {
              user_id: selectedUser?.id,
              role,
            }
          : {
              email: email.trim(),
              role,
            },
      );
      notifySuccess(mode === "existing" ? "Member added" : "Invite sent");
      onSaved?.();
      onClose();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal mengirim invite");
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions = context?.role_options || [];

  return (
    <AdminModal
      open={open && !!business}
      onClose={onClose}
      title={`Invite Member${business ? ` - ${business.name}` : ""}`}
      maxWidth="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingContext}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {submitting ? "Sending..." : "Send Invite"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">{business?.name || "Business"}</div>
          <div className="text-xs text-slate-500">/{business?.slug || ""}</div>
          <p className="mt-2 text-sm text-slate-600">Pilih existing user yang belum jadi member business ini, atau kirim invite lewat email jika user belum ditemukan.</p>
        </div>

        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setMode("existing");
              setSelectedUser(null);
            }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${mode === "existing" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Existing user
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setSelectedUser(null);
            }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${mode === "email" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            New member
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="space-y-1 text-sm">
              <span className="text-xs uppercase text-slate-500">Search existing user</span>
              <input
                className={inputClass}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedUser(null);
                }}
                placeholder="Search by name, email, or phone"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">Hanya user yang belum menjadi member business ini yang akan muncul.</p>
            </div>

            {selectedUser ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-emerald-900">{selectedUser.full_name || selectedUser.email}</div>
                    <div className="text-xs text-emerald-800">{selectedUser.email}</div>
                    {selectedUser.phone_number ? <div className="text-xs text-emerald-800">{selectedUser.phone_number}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : null}

            {!selectedUser && searchQuery.trim().length >= 2 ? (
              <div className="space-y-2">
                {searchLoading ? <div className="text-sm text-slate-500">Searching user...</div> : null}
                {!searchLoading && searchResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Tidak ada user yang cocok. Pindah ke tab New member kalau mau invite via email.</div>
                ) : null}
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchQuery(user.full_name || user.email);
                      setEmail(user.email);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{user.full_name || user.email}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        {user.phone_number ? <div className="text-xs text-slate-500">{user.phone_number}</div> : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[11px] font-semibold uppercase tracking-wide">
                        <span className={`rounded-full px-2 py-0.5 ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? "Active" : "Inactive"}</span>
                        {user.is_banned ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Banned</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs uppercase text-slate-500">Email</span>
              <input
                className={inputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="member@domain.com"
                autoComplete="email"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Kalau email belum terdaftar sebagai user member, sistem tetap akan kirim invite untuk join business ini.
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Role</span>
            <select
              className={inputClass}
              value={role}
              onChange={(event) => setRole(event.target.value as InviteRole)}
              disabled={loadingContext || roleOptions.length === 0}
            >
              <option value="">{loadingContext ? "Loading roles..." : "Select role"}</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {context?.has_owner === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Business ini belum punya owner. Kamu bisa pilih role owner untuk invite pertama.
          </div>
        ) : null}

        <div className="space-y-2">
          {roleOptions.map((option) => (
            <div key={option.value} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{option.value}</div>
              </div>
              {option.description ? <div className="mt-1 text-xs text-slate-500">{option.description}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </AdminModal>
  );
}