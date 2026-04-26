import React, { useEffect } from "react";

type MemberAuthGateProps = {
	locale?: string;
};

const MEMBER_ACCESS_TOKEN_KEY = "member_access_token";

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

export default function MemberAuthGate({ locale }: MemberAuthGateProps) {
	useEffect(() => {
		const redirectToLogin = () => {
			const nextPath = encodeURIComponent(window.location.pathname + window.location.search);
			const loginPath = locale === "en" || locale === "id" ? `/${locale}/member/auth/login` : "/member/auth/login";
			window.location.replace(`${loginPath}?next=${nextPath}`);
		};

		const token = localStorage.getItem(MEMBER_ACCESS_TOKEN_KEY) || "";
		if (!token) {
			redirectToLogin();
			return;
		}

		const controller = new AbortController();

		void (async () => {
			try {
				const response = await fetch(`${resolveApiBase()}/api/member/auth/me`, {
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/json",
					},
					signal: controller.signal,
				});
				if (!response.ok) {
					localStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
					redirectToLogin();
				}
			} catch {
				if (controller.signal.aborted) return;
				localStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
				redirectToLogin();
			}
		})();

		return () => controller.abort();
	}, [locale]);

	return null;
}