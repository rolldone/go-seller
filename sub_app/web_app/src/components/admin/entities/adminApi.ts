const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

const getAuthHeaders = (contentType: "json" | "form" = "json") => {
  const headers: HeadersInit = {};
  if (contentType === "json") {
    headers["Content-Type"] = "application/json";
  }
  const token = localStorage.getItem("access_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function adminRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: getAuthHeaders("json"),
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${apiUrl}${path}`, init);
  return parseResponse<T>(res);
}

async function adminRequestBlob(path: string, method: string, body?: unknown): Promise<Blob> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: getAuthHeaders("json"),
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${apiUrl}${path}`, init);
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return res.blob();
}

export async function adminGet<T>(path: string): Promise<T> {
  return adminRequest<T>(path, "GET");
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  return adminRequest<T>(path, "POST", body);
}

export async function adminPostBlob(path: string, body?: unknown): Promise<Blob> {
  return adminRequestBlob(path, "POST", body);
}

export async function adminPut<T>(path: string, body: unknown): Promise<T> {
  return adminRequest<T>(path, "PUT", body);
}

export async function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  return adminRequest<T>(path, "PATCH", body);
}

export async function adminDelete(path: string): Promise<void> {
  await adminRequest<unknown>(path, "DELETE");
}

export async function adminPostForm<T>(path: string, body: FormData): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders("form"),
    body,
  });
  return parseResponse<T>(res);
}

// Fetch binary content (blob) with admin auth. Returns a Blob or throws on error.
export async function adminGetBlob(path: string): Promise<Blob> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const res = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: getAuthHeaders("json"),
  });
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    // try parse JSON error
    const payload = await res.json().catch(() => ({}));
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  const blob = await res.blob();
  return blob;
}
