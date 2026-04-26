/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";
import { getMemberAuthToken, saveMemberSession } from "../../../lib/memberSession";

type MemberLoginPageProps = {
	locale?: string;
};

type MemberLoginResponse = {
	access_token?: string;
	member?: {
		id: string;
		full_name: string;
		email: string;
	};
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

function resolveNextPath(search: string): string | null {
	const nextPath = new URLSearchParams(search).get("next")?.trim() || "";
	if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
		return null;
	}
	return nextPath;
}

async function isMemberSessionValid(token: string): Promise<boolean> {
	if (!token) return false;
	try {
		const apiBase = resolveApiBase();
		const response = await fetch(`${apiBase}/api/member/auth/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		});
		return response.ok;
	} catch {
		return false;
	}
}

export default function MemberLoginPage({ locale }: MemberLoginPageProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const existingToken = getMemberAuthToken();
		if (!existingToken) return;

		void (async () => {
			if (await isMemberSessionValid(existingToken)) {
				window.location.replace(resolveNextPath(window.location.search) || buildLocalizedPath("/member", locale));
				return;
			}
			localStorage.removeItem("member_access_token");
		})();
	}, [locale]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const apiBase = resolveApiBase();
			const response = await fetch(`${apiBase}/api/member/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ email, password }),
			});

			const payload = (await response.json().catch(() => ({}))) as MemberLoginResponse & { error?: string };
			if (!response.ok) {
				throw new Error(payload.error || "Login gagal");
			}
			if (!payload.access_token) {
				throw new Error("Token login tidak ditemukan");
			}
			saveMemberSession(payload.access_token);
			window.location.replace(resolveNextPath(window.location.search) || buildLocalizedPath("/member", locale));
		} catch (submitError) {
			const message = submitError instanceof Error ? submitError.message : "Login gagal";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-4">
			<div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="text-2xl font-bold text-slate-900">Member Login</h1>
				<p className="mt-2 text-sm text-slate-600">Masuk dengan email dan password yang dibuat saat setup member.</p>

				<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
					<label className="block text-sm">
						<span className="mb-1 block font-medium text-slate-700">Email</span>
						<input
							type="email"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="member@email.com"
						/>
					</label>

					<label className="block text-sm">
						<span className="mb-1 block font-medium text-slate-700">Password</span>
						<input
							type="password"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							placeholder="Password"
						/>
					</label>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
					>
						{loading ? "Memproses..." : "Masuk"}
					</button>
				</form>

				{error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

					<div className="mt-5 text-center text-sm text-slate-500">
						Lupa password?{" "}
						<a className="font-semibold text-emerald-700 underline" href={buildLocalizedPath("/member/auth/forgot-password", locale)}>
							Reset di sini
						</a>
					</div>
			</div>
		</div>
	);
}