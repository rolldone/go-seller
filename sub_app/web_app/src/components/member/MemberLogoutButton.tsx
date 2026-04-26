/** @jsxRuntime classic */
import React from "react";
import { buildLocalizedPath } from "../../lib/siteLocale";

type MemberLogoutButtonProps = {
	locale?: string;
};

export default function MemberLogoutButton({ locale }: MemberLogoutButtonProps) {
	const handleLogout = () => {
		try {
			localStorage.removeItem("member_access_token");
		} catch {
			// ignore storage failures and redirect anyway
		}

		window.location.href = buildLocalizedPath("/member/auth/login", locale);
	};

	return (
		<button
			onClick={handleLogout}
			className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
		>
			Keluar
		</button>
	);
}