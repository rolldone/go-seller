export const MEMBER_ACCESS_TOKEN_KEY = "member_access_token";

export function getMemberAuthToken(): string {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(MEMBER_ACCESS_TOKEN_KEY) || "";
}

export function saveMemberSession(token: string): void {
	if (typeof window === "undefined") return;
	const trimmedToken = token.trim();
	if (!trimmedToken) return;
	localStorage.setItem(MEMBER_ACCESS_TOKEN_KEY, trimmedToken);
}

export function clearMemberSession(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
}