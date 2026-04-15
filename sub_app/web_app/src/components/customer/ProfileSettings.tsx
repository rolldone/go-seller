/** @jsxRuntime classic */
import React, { useState } from "react";
import { ShieldCheck, User, Mail, Lock } from "lucide-react";
import { useTranslations } from "../../i18n";

interface ProfileSettingsProps {
  className?: string;
}

export default function ProfileSettings({ className = "" }: ProfileSettingsProps) {
  const t = useTranslations();
  const [name, setName] = useState("Budi Santoso");
  const [email, setEmail] = useState("budi@email.com");
  const [phone, setPhone] = useState("+62 812 9988 7766");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const containerClasses = ["space-y-6", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{t("updateProfile", "Update Profile")}</p>
            <p className="text-sm text-slate-500">{t("updateProfileDescription", "Perbarui nama, email, dan nomor telepon kamu.")}</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            alert("Profile updated (mock)");
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-600">
                {t("fullName", "Nama Lengkap")}
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-600">
              {t("emailLabel", "Email")}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-600">
            {t("phoneLabel", "Nomor Telepon")}
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Mail className="h-4 w-4" />
            {t("saveChanges", "Simpan perubahan")}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{t("updatePassword", "Update Password")}</p>
            <p className="text-sm text-slate-500">{t("updatePasswordDesc", "Ubah password jika kamu merasa perlu keamanan ekstra.")}</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            alert("Password updated (mock)");
          }}
        >
          <label className="block text-sm font-medium text-slate-600">
            {t("currentPassword", "Password Sekarang")}
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-600">
              {t("newPassword", "Password Baru")}
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-600">
              {t("confirmPassword", "Konfirmasi Password")}
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <ShieldCheck className="h-4 w-4" />
            {t("updatePasswordAction", "Update password")}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-red-700">{t("deactivateAccountTitle", "Nonaktifkan Akun")}</p>
            <p className="text-sm text-red-600">{t("deactivateAccountDesc", "Kamu dapat menonaktifkan akun sementara jika sedang tidak aktif.")}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-red-700">{t("accountLockedNotice", "Akun akan dikunci dan kamu harus menghubungi support untuk mengaktifkannya kembali.")}</p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100"
          onClick={() => alert("Akun dinonaktifkan (mock)")}
        >
          <ShieldCheck className="h-4 w-4" />
          {t("deactivateAccountAction", "Deactivate account")}
        </button>
      </div>
    </div>
  );
}
