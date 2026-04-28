/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";

import { buildLocalizedPath } from "../../../lib/siteLocale";

type MemberTeamInvitePageProps = {
	locale?: string;
};

type InviteMode = "loading" | "confirm" | "setup" | "done" | "error";

type InviteResolution = {
	email: string;
	business_name: string;
	business_slug: string;
	role: string;
	inviter_name?: string;
	inviter_email?: string;
	account_exists: boolean;
	requires_setup: boolean;
};

type InviteSetupResponse = {
	data?: {
		user?: { id: string; full_name: string; email: string };
		business?: { id: string; name: string; slug: string };
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

function getTokenFromLocation(): string {
	if (typeof window === "undefined") return "";
	return new URLSearchParams(window.location.search).get("token")?.trim() || "";
}

export default function MemberTeamInvitePage({ locale }: MemberTeamInvitePageProps) {
	const [mode, setMode] = useState<InviteMode>("loading");
	const [message, setMessage] = useState("Memeriksa undangan tim...");
	const [token, setToken] = useState("");
	const [invite, setInvite] = useState<InviteResolution | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [fullName, setFullName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");

	useEffect(() => {
		setToken(getTokenFromLocation());
	}, []);

	useEffect(() => {
		if (!token) {
			setMode("error");
			setMessage("Token undangan tidak ditemukan.");
			return;
		}

		const controller = new AbortController();

		async function loadInvite() {
			try {
				const apiBase = resolveApiBase();
				const response = await fetch(`${apiBase}/api/member/team/invites/resolve?token=${encodeURIComponent(token)}`, {
					headers: { Accept: "application/json" },
					signal: controller.signal,
					credentials: "include",
				});
				const payload = (await response.json().catch(() => ({}))) as { data?: InviteResolution; error?: string };
				if (!response.ok) {
					throw new Error(payload.error || "Undangan tidak valid atau sudah kedaluwarsa.");
				}
				if (!payload.data) {
					throw new Error("Data undangan tidak ditemukan.");
				}
				setInvite(payload.data);
				setMode(payload.data.requires_setup ? "setup" : "confirm");
				setMessage(payload.data.requires_setup ? "Akun member belum ditemukan. Silakan buat akun dulu untuk join ke toko ini." : "Akun member sudah ada. Kamu bisa memilih untuk bergabung atau menolak undangan ini.");
				setFullName((current) => current || "");
			} catch (error) {
				if (controller.signal.aborted) return;
				setMode("error");
				setMessage(error instanceof Error ? error.message : "Gagal memproses undangan.");
			}
		}

		loadInvite();
		return () => controller.abort();
	}, [token]);

	const finish = (nextMessage: string) => {
		setMode("done");
		setMessage(nextMessage);
	};

	const handleAccept = async () => {
		if (!token) return;
		setSubmitting(true);
		try {
			const apiBase = resolveApiBase();
			const response = await fetch(`${apiBase}/api/member/team/invites/accept`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ token }),
				credentials: "include",
			});
			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				if (response.status === 409) {
					setMode("setup");
					setMessage("Akun belum ada, silakan setup dulu untuk join ke toko ini.");
					return;
				}
				throw new Error(payload.error || "Undangan tidak valid atau sudah kedaluwarsa.");
			}
			finish("Undangan diterima. Kamu sekarang bisa login ke member dashboard.");
		} catch (error) {
			setMode("error");
			setMessage(error instanceof Error ? error.message : "Gagal memproses undangan.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleReject = () => {
		finish("Undangan ditolak. Kamu bisa menutup halaman ini kapan saja.");
	};

	const handleSetup = async () => {
		if (!token) return;
		if (!fullName.trim() || !password.trim()) {
			setMode("error");
			setMessage("Nama lengkap dan password wajib diisi.");
			return;
		}
		if (password !== confirmPassword) {
			setMode("error");
			setMessage("Password dan konfirmasi password harus sama.");
			return;
		}
		setSubmitting(true);
		try {
			const apiBase = resolveApiBase();
			const response = await fetch(`${apiBase}/api/member/auth/team/invites/setup`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					token,
					full_name: fullName,
					password,
					phone_number: phoneNumber,
				}),
				credentials: "include",
			});
			const payload = (await response.json().catch(() => ({}))) as InviteSetupResponse & { error?: string };
			if (!response.ok) {
				throw new Error(payload.error || "Gagal setup member dari undangan.");
			}
			finish("Akun member berhasil dibuat dan join ke toko sudah diproses. Cek email untuk verifikasi sebelum login.");
		} catch (error) {
			setMode("error");
			setMessage(error instanceof Error ? error.message : "Gagal setup member dari undangan.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_30%),linear-gradient(180deg,#f7f7f5_0%,#ffffff_100%)] px-4 py-10 text-slate-900">
			<div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center py-10">
				<div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
					<div className="flex flex-col items-center text-center">
						<div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${mode === "done" ? "border-emerald-100 bg-emerald-50 text-emerald-600" : mode === "error" ? "border-rose-100 bg-rose-50 text-rose-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
							{mode === "done" ? "✓" : mode === "error" ? "!" : "..."}
						</div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Undangan Tim Member</p>
						<h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
							{mode === "done" ? "Undangan diproses" : mode === "error" ? "Undangan gagal" : invite?.requires_setup ? "Setup akun member" : "Konfirmasi undangan"}
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{message}</p>
					</div>

					{invite ? (
						<div className="mt-8 space-y-6">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
								<p className="font-semibold text-slate-900">{invite.business_name}</p>
								<p className="mt-1">Role: {invite.role}</p>
								<p>Email tujuan: {invite.email}</p>
								{invite.inviter_name || invite.inviter_email ? <p className="mt-1 text-xs text-slate-500">Diundang oleh {invite.inviter_name || invite.inviter_email}</p> : null}
							</div>

							{mode === "confirm" ? (
								<div className="grid gap-3 sm:grid-cols-2">
									<button
										type="button"
										onClick={() => void handleAccept()}
										disabled={submitting}
										className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
									>
										{submitting ? "Memproses..." : "Bersedia bergabung"}
									</button>
									<button
										type="button"
										onClick={handleReject}
										className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										Tidak bersedia
									</button>
								</div>
							) : mode === "setup" ? (
								<div className="space-y-4 text-left">
									<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
										Email ini belum punya akun member. Isi data di bawah untuk membuat akun baru lalu join ke toko ini.
									</div>
									<div className="grid gap-4 sm:grid-cols-2">
										<label className="space-y-1 text-sm sm:col-span-2">
											<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
											<input className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700" value={invite.email} readOnly />
										</label>
										<label className="space-y-1 text-sm sm:col-span-2">
											<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama lengkap</span>
											<input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama lengkap" />
										</label>
										<label className="space-y-1 text-sm">
											<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
											<input type="password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru" />
										</label>
										<label className="space-y-1 text-sm">
											<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Konfirmasi password</span>
											<input type="password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Ulangi password" />
										</label>
										<label className="space-y-1 text-sm sm:col-span-2">
											<span className="text-xs font-semibold uppercase tracking-wide text-slate-500">No. telepon</span>
											<input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="08xxxxxxxxxx" />
										</label>
									</div>
									<div className="flex flex-col gap-3 sm:flex-row">
										<button type="button" onClick={() => void handleSetup()} disabled={submitting} className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
											{submitting ? "Membuat akun..." : "Buat akun dan join toko"}
										</button>
										<button type="button" onClick={handleReject} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
											Batal
										</button>
									</div>
								</div>
							) : null}
						</div>
					) : null}

					{mode === "done" || mode === "error" ? (
						<div className="mt-8 grid gap-3 sm:grid-cols-2">
							<a href={buildLocalizedPath("/member/auth/login", locale)} className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700">
								Ke halaman login
							</a>
							<button type="button" onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
								Muat ulang
							</button>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
