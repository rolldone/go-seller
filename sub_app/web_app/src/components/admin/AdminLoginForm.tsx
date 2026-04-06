import { useState } from "react";
import type { FormEvent } from "react";
import { notifyError, notifySuccess } from "../../lib/notification";

type LoginResponse = {
  message?: string;
};

const getApiUrl = () => {
  const baseUrl = import.meta.env.PUBLIC_API_URL;
  return baseUrl?.replace(/\/$/, "") || "";
};

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<any>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error("PUBLIC_API_URL belum dikonfigurasi");
      }

      const res = await fetch(`${apiUrl}/admin/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as LoginResponse;
      if (!res.ok) {
        throw new Error(payload.message || "Login gagal. Periksa email/password.");
      }

      const params = new URLSearchParams(window.location.search);
      const noRedirect = params.get("no_redirect") === "1";
      if (noRedirect) {
        setResponse(payload as any);
        notifySuccess("Login sukses — response ditampilkan (no redirect)");
      } else {
        // Save tokens to localStorage for subsequent API calls
        const data = payload as any;
        if (data.access_token) localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        window.location.href = "/admin";
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Terjadi kesalahan";
      setError(message);
      notifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Login</h1>
        <p className="mt-1 text-sm text-slate-600">Masuk untuk mengakses dashboard admin.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@email.com"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <a href="/admin/forgot-password" className="text-xs font-medium text-slate-600 hover:text-slate-900">
              Forgot Password?
            </a>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Loading..." : "Sign In"}
        </button>
      </form>
      {response ? (
        <pre className="mt-4 max-w-full overflow-auto rounded bg-slate-100 p-3 text-sm text-slate-800">{JSON.stringify(response, null, 2)}</pre>
      ) : null}
    </div>
  );
}
