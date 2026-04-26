/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";

type MemberVerifyEmailPageProps = {
	locale?: string;
};

type VerifyState = "loading" | "success" | "error";

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

export default function MemberVerifyEmailPage({ locale }: MemberVerifyEmailPageProps) {
	const [state, setState] = useState<VerifyState>("loading");
	const [message, setMessage] = useState("Memeriksa link verifikasi...");
	const [token, setToken] = useState("");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setToken((params.get("token") || "").trim());
	}, []);

	useEffect(() => {
		if (!token) {
			setState("error");
			setMessage("Token verifikasi tidak ditemukan.");
			return;
		}

		const controller = new AbortController();

		async function verifyEmail() {
			try {
				const apiBase = resolveApiBase();
				const response = await fetch(`${apiBase}/api/member/auth/verify?token=${encodeURIComponent(token)}`, {
					method: "GET",
					signal: controller.signal,
					credentials: "include",
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error || "Link verifikasi tidak valid atau sudah kedaluwarsa.");
				}

				setState("success");
				setMessage("Email berhasil diverifikasi. Kamu sekarang bisa login.");
			} catch (error) {
				if (controller.signal.aborted) return;
				setState("error");
				setMessage(error instanceof Error ? error.message : "Gagal memverifikasi email.");
			}
		}

		verifyEmail();
		return () => controller.abort();
	}, [token]);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,#f7f7f5_0%,#ffffff_100%)] px-4 py-10 text-slate-900">
			<div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center py-10">
				<div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
					<div className="flex flex-col items-center text-center">
						<div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${state === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-600" : state === "error" ? "border-rose-100 bg-rose-50 text-rose-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
							{state === "success" ? "✓" : state === "error" ? "!" : "..."}
						</div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Verifikasi Email Member</p>
						<h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
							{state === "success" ? "Email terverifikasi" : state === "error" ? "Verifikasi gagal" : "Memverifikasi email"}
						</h1>
						<p className="mt-3 max-w-md text-sm leading-6 text-slate-600">{message}</p>
					</div>

					<div className="mt-8 grid gap-3 sm:grid-cols-2">
						<a
							href={buildLocalizedPath("/member/auth/login", locale)}
							className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
						>
							Ke halaman login
						</a>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
						>
							Coba lagi
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
