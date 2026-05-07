import { getMemberAuthToken } from "../../../lib/memberSession";

const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

function getMemberLoginPath() {
	if (typeof window === "undefined") return "/member/auth/login";
	const pathname = window.location.pathname || "";
	if (pathname.startsWith("/en/")) return "/en/member/auth/login";
	if (pathname.startsWith("/id/")) return "/id/member/auth/login";
	return "/member/auth/login";
}

async function parseResponse<T>(res: Response): Promise<T> {
	if (res.status === 401 || res.status === 403) {
		window.location.href = getMemberLoginPath();
		throw new Error("Unauthorized");
	}
	const payload = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
		const err: any = new Error(message);
		err.status = res.status;
		err.payload = payload;
		throw err;
	}
	return payload as T;
}

async function memberRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
	const apiUrl = getApiUrl();
	if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

	const token = getMemberAuthToken();
	const headers: HeadersInit = { "Content-Type": "application/json" };
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const init: RequestInit = {
		method,
		credentials: "include",
		headers,
	};
	if (body !== undefined) {
		init.body = JSON.stringify(body);
	}

	const res = await fetch(`${apiUrl}${path}`, init);
	return parseResponse<T>(res);
}

export async function memberGet<T>(path: string): Promise<T> {
	return memberRequest<T>(path, "GET");
}

export async function memberPost<T>(path: string, body?: unknown): Promise<T> {
	return memberRequest<T>(path, "POST", body);
}

export async function memberPut<T>(path: string, body: unknown): Promise<T> {
	return memberRequest<T>(path, "PUT", body);
}

export async function memberPatch<T>(path: string, body?: unknown): Promise<T> {
	return memberRequest<T>(path, "PATCH", body);
}

export async function memberDelete(path: string): Promise<void> {
	await memberRequest<unknown>(path, "DELETE");
}

export async function memberPostForm<T>(path: string, formData: FormData): Promise<T> {
	const apiUrl = getApiUrl();
	if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

	const token = getMemberAuthToken();
	const headers: HeadersInit = {};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const res = await fetch(`${apiUrl}${path}`, {
		method: "POST",
		credentials: "include",
		headers,
		body: formData,
	});

	return parseResponse<T>(res);
}