/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { memberGet, memberPut } from "../businesses/api";
import type { SiteLocale } from "@/lib/siteLocale";
import { SUPPORTED_LOCALES, LOCALE_LABELS, ORIGINAL_LOCALE } from "@/lib/siteLocale";
import MemberModal from "../ui/MemberModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  language?: string;
  created_at: string;
}

type Tab = "profile" | "security";

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profil" },
    { key: "security", label: "Keamanan" },
  ];
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            active === t.key
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ profile, onUpdated }: { profile: MemberProfile; onUpdated: (p: MemberProfile) => void }) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number);
  const [language, setLanguage] = useState<SiteLocale>(profile.language as SiteLocale || ORIGINAL_LOCALE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync if profile changes externally
  useEffect(() => {
    setFullName(profile.full_name);
    setPhoneNumber(profile.phone_number);
    setLanguage((profile.language as SiteLocale) || ORIGINAL_LOCALE);
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await memberPut<{ data: MemberProfile }>("/api/member/profile", {
        full_name: fullName.trim() || null,
        phone_number: phoneNumber.trim() || null,
        language: language || ORIGINAL_LOCALE,
      });
      onUpdated(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          type="email"
          value={profile.email}
          disabled
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-slate-400">Email tidak dapat diubah.</p>
      </div>

      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Nama lengkap"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Telepon</label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="+628xxxx"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Bahasa</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as SiteLocale)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profil berhasil disimpan.</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    resetForm();
    setShowModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter");
      return;
    }
    setSaving(true);
    try {
      await memberPut<unknown>("/api/member/profile/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengganti password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="max-w-lg space-y-5">
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Password</p>
              <p className="mt-1 text-sm text-slate-500">
                Gunakan password yang kuat dan unik untuk melindungi akun Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ganti Password
            </button>
          </div>
        </div>
      </div>

      <MemberModal
        open={showModal}
        title="Ganti Password"
        onClose={handleClose}
        maxWidth="md"
        footer={
          <>
            <button type="button" onClick={handleClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Batal
            </button>
            <button
              type="submit"
              form="change-password-form"
              disabled={saving || success}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password Saat Ini</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Min. 8 karakter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ulangi password baru"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password berhasil diubah!</p>}
        </form>
      </MemberModal>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    memberGet<{ data: MemberProfile }>("/api/member/profile")
      .then((res) => setProfile(res.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Gagal memuat profil"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Memuat data akun…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
        {error || "Gagal memuat profil akun."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold select-none">
          {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "?"}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{profile.full_name || "—"}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
        </div>
      </div>

      <TabBar active={activeTab} onSelect={setActiveTab} />

      {activeTab === "profile" && (
        <ProfileTab profile={profile} onUpdated={setProfile} />
      )}
      {activeTab === "security" && <SecurityTab />}
    </div>
  );
}
