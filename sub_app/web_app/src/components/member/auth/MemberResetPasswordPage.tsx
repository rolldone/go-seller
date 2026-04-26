/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";

type MemberResetPasswordPageProps = {
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

export default function MemberResetPasswordPage({ locale }: MemberResetPasswordPageProps) {
	const [token, setToken] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setToken((params.get("token") || "").trim());
	}, []);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");

		if (!token) {
			setError("Token reset tidak tersedia");
			return;
		}
		if (password.length < 8) {
			setError("Password minimal 8 karakter");
			return;
		}
		if (password !== confirmPassword) {
			setError("Password dan konfirmasi password tidak cocok");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`${resolveApiBase()}/api/member/auth/reset-password`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ token, password }),
			});

			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				throw new Error(payload.error || "Gagal reset password");
			}

			window.location.href = buildLocalizedPath("/member/auth/login", locale);
		} catch (submitError) {
			const message = submitError instanceof Error ? submitError.message : "Gagal reset password";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-4">
			<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="text-2xl font-bold text-slate-900">Reset Password Member</h1>
				<p className="mt-2 text-sm text-slate-600">Buat password baru untuk melanjutkan login ke member dashboard.</p>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
					<label className="block text-sm">
						<span className="mb-1 block font-medium text-slate-700">Password Baru</span>
						<input
							type="password"
							autoComplete="new-password"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							placeholder="Min. 8 karakter"
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
							placeholder="Ulangi password baru"
						/>
					</label>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
					>
						{loading ? "Memproses..." : "Simpan Password Baru"}
					</button>
				</form>

				{error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

				<div className="mt-5 text-center text-sm text-slate-500">
					<a className="font-semibold text-emerald-700 underline" href={buildLocalizedPath("/member/auth/login", locale)}>
						Kembali ke login
					</a>
				</div>
			</div>
		</div>
	);
}