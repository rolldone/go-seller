import React, { useState, useEffect, useRef } from "react";
import { buildLocalizedPath } from "../../lib/siteLocale";

type MemberSetupResponse = {
  data?: {
    user?: { id: string; full_name: string; email: string };
    business?: { id: string; name: string; slug: string };
  };
};

type MemberSetupPageProps = {
  locale?: string;
};

function resolveApiBase(): string {
  const envApi = (import.meta.env.PUBLIC_API_URL ?? "").toString().trim();
  if (envApi) {
    return envApi.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

export default function MemberSetupPage({ locale }: MemberSetupPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<MemberSetupResponse["data"] | null>(null);
  const slugCheckTimer = useRef<number | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);

    if (!fullName.trim() || !email.trim() || !password.trim() || !businessName.trim()) {
      setError("Nama lengkap, email, password, dan nama toko wajib diisi");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password harus sama");
      return;
    }

    setLoading(true);
    try {
      const apiBase = resolveApiBase();
      const response = await fetch(`${apiBase}/api/member/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          phone_number: phoneNumber,
          business_name: businessName,
          business_slug: businessSlug,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as MemberSetupResponse & { error?: string };
      if (response.ok) {
        setSuccess(payload.data ?? null);
        setError("");
        return;
      }

      if (response.status === 409) {
        // conflict: email or slug taken. Show friendly message and suggestions for slug
        setError(payload.error || "Email atau business slug sudah digunakan");
        try {
          const apiBase = resolveApiBase();
          const slugQuery = businessSlug?.trim() || businessName?.trim();
          if (slugQuery) {
            const suggestRes = await fetch(`${apiBase}/api/catalog/businesses/slug/suggest?${businessSlug?.trim() ? `slug=${encodeURIComponent(businessSlug)}` : `name=${encodeURIComponent(businessName)}`}&limit=5`);
            const suggestJson = await suggestRes.json().catch(() => ({}));
            if (suggestRes.ok && Array.isArray(suggestJson.suggestions)) {
              setSlugSuggestions(suggestJson.suggestions || []);
              setSlugAvailable(Boolean(suggestJson.available));
            }
          }
        } catch (e) {
          // ignore suggestion errors
        }
        return;
      }

      throw new Error(payload.error || "Gagal setup member");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal setup member");
    } finally {
      setLoading(false);
    }
  };

  // debounce check when user edits slug manually
  useEffect(() => {
    setSlugError(null);
    setSlugSuggestions([]);
    setSlugAvailable(null);
    if (slugCheckTimer.current) {
      window.clearTimeout(slugCheckTimer.current);
      slugCheckTimer.current = null;
    }
    const s = businessSlug.trim();
    if (!s) return;
    slugCheckTimer.current = window.setTimeout(async () => {
      setSlugChecking(true);
      try {
        const apiBase = resolveApiBase();
        const res = await fetch(`${apiBase}/api/catalog/businesses/slug/check?slug=${encodeURIComponent(s)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSlugError(j.error || "Gagal cek slug");
          setSlugAvailable(null);
        } else {
          setSlugAvailable(Boolean(j.available));
          if (!j.available) {
            // fetch suggestions
            try {
              const suggestRes = await fetch(`${apiBase}/api/catalog/businesses/slug/suggest?slug=${encodeURIComponent(s)}&limit=5`);
              const suggestJson = await suggestRes.json().catch(() => ({}));
              setSlugSuggestions(Array.isArray(suggestJson.suggestions) ? suggestJson.suggestions : []);
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        setSlugError(e instanceof Error ? e.message : String(e));
      } finally {
        setSlugChecking(false);
      }
    }, 450);

    return () => {
      if (slugCheckTimer.current) {
        window.clearTimeout(slugCheckTimer.current);
        slugCheckTimer.current = null;
      }
    };
  }, [businessSlug]);

  const handleGenerate = async () => {
    setSlugError(null);
    setSlugSuggestions([]);
    if (!businessName.trim()) {
      setSlugError("Nama Toko harus diisi untuk generate slug");
      return;
    }
    setGenerating(true);
    try {
      const apiBase = resolveApiBase();
      const res = await fetch(`${apiBase}/api/catalog/businesses/slug/suggest?name=${encodeURIComponent(businessName)}&limit=5`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSlugError(j.error || "Gagal generate slug");
        return;
      }
      if (j.slug) setBusinessSlug(j.slug);
      setSlugAvailable(Boolean(j.available));
      setSlugSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
    } catch (e) {
      setSlugError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Member Setup</h1>
        <p className="mt-1 text-sm text-slate-600">Daftarkan member beserta toko pertamanya.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nama Lengkap Member</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nama member"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email Member</span>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@email.com"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Password Member</span>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password untuk login member"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Konfirmasi Password</span>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ulangi password"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">No. Telepon</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="08xxxxxxxxxx"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nama Toko</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Nama bisnis"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Slug Toko (opsional)</span>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
                value={businessSlug}
                onChange={(event) => setBusinessSlug(event.target.value)}
                placeholder="nama-toko"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                {generating ? "Memproses..." : "Generate"}
              </button>
            </div>
            <div className="mt-2 text-sm">
              {slugChecking ? (
                <span className="text-slate-500">Memeriksa ketersediaan...</span>
              ) : slugAvailable === true ? (
                <span className="text-green-600">Slug tersedia</span>
              ) : slugAvailable === false ? (
                <span className="text-red-600">Slug sudah dipakai</span>
              ) : null}
              {slugError ? <div className="text-red-600 mt-1">{slugError}</div> : null}
              {slugSuggestions && slugSuggestions.length > 0 ? (
                <div className="mt-2">
                  <div className="text-slate-600 text-sm">Saran:</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {slugSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBusinessSlug(s)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Simpan Setup Member"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-semibold">Setup berhasil</p>
            <p>Member: {success.user?.full_name} ({success.user?.email})</p>
            <p>Toko: {success.business?.name} ({success.business?.slug})</p>
            <p className="mt-2">Cek email untuk verifikasi akun. Setelah verifikasi selesai, baru login di halaman member.</p>
            <a className="mt-2 inline-block font-semibold text-emerald-700 underline" href={buildLocalizedPath("/member/auth/login", locale)}>
              Buka halaman login member
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}