export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 1500): Promise<Response> {
	const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
	const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

	try {
		return await fetch(input, { ...init, signal: controller?.signal ?? init.signal });
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}
