/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { ArrowRight, Building2, ChartColumnBig, ShieldCheck, Sparkles } from "lucide-react";

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
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_32%),linear-gradient(180deg,#f7f7f5_0%,#ffffff_100%)] px-4 py-8 text-slate-900">
			<div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
				<section className="order-2 lg:order-1">
					<div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
						<Sparkles className="h-4 w-4" />
						<span>Member Access</span>
					</div>
					<h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">Masuk ke dashboard member, kelola toko tanpa ribet.</h1>
					<p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
						Kelola produk, order, laporan, POS, dan tim dari satu tempat. Kalau belum punya akun member, kamu bisa setup dulu dari halaman ini.
					</p>

					<div className="mt-6 grid gap-3 sm:grid-cols-2">
						<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-center gap-3">
								<div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
									<Building2 className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-semibold text-slate-900">Setup cepat</p>
									<p className="text-xs text-slate-500">Email, password, toko, selesai.</p>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-center gap-3">
								<div className="rounded-xl bg-sky-50 p-2 text-sky-700">
									<ChartColumnBig className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-semibold text-slate-900">Dashboard lengkap</p>
									<p className="text-xs text-slate-500">Order, laporan, POS, tim.</p>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-center gap-3">
								<div className="rounded-xl bg-amber-50 p-2 text-amber-700">
									<ShieldCheck className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-semibold text-slate-900">Akses aman</p>
									<p className="text-xs text-slate-500">Login pakai email member.</p>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-center gap-3">
								<div className="rounded-xl bg-rose-50 p-2 text-rose-700">
									<ArrowRight className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-semibold text-slate-900">Belum punya akun?</p>
									<p className="text-xs text-slate-500">Setup member dari tombol di form.</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="order-1 lg:order-2">
					<div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] md:p-8">
						<div className="mb-6">
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Member Login</p>
							<h2 className="mt-2 text-2xl font-bold text-slate-900">Masuk ke akun member</h2>
							<p className="mt-2 text-sm text-slate-600">Gunakan email dan password yang dibuat saat setup member.</p>
						</div>

						<form className="space-y-4" onSubmit={handleSubmit}>
							<label className="block text-sm">
								<span className="mb-1 block font-medium text-slate-700">Email</span>
								<input
									type="email"
									className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="member@email.com"
								/>
							</label>

							<label className="block text-sm">
								<span className="mb-1 block font-medium text-slate-700">Password</span>
								<input
									type="password"
									className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="Password"
								/>
							</label>

							<button
								type="submit"
								disabled={loading}
								className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
							>
								{loading ? "Memproses..." : "Masuk"}
							</button>
						</form>

						{error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

						<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
							<p className="text-sm font-semibold text-slate-900">Belum punya akun member?</p>
							<p className="mt-1 text-sm text-slate-600">Setup member dulu supaya kamu bisa masuk ke dashboard, laporan, dan POS.</p>
							<a
								className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
								href={buildLocalizedPath("/member/setup", locale)}
							>
								Setup Member
								<ArrowRight className="h-4 w-4" />
							</a>
						</div>

						<div className="mt-5 flex flex-col items-center justify-between gap-3 text-center text-sm text-slate-500 sm:flex-row sm:text-left">
							<div>
								Lupa password?{" "}
								<a className="font-semibold text-emerald-700 underline" href={buildLocalizedPath("/member/auth/forgot-password", locale)}>
									Reset di sini
								</a>
							</div>
							<a className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4" href={buildLocalizedPath("/", locale)}>
								Kembali ke storefront
							</a>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}