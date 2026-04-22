/**
 * Thin HTTP wrapper for the GoSeller admin API.
 * All requests use: Authorization: Bearer <token>
 */

export function createApiClient({ baseUrl, token }) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  async function post(path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`POST ${path} → ${res.status}: ${json?.error || JSON.stringify(json)}`);
    }
    return json;
  }

  async function put(path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`PUT ${path} → ${res.status}: ${json?.error || JSON.stringify(json)}`);
    }
    return json;
  }

  return { post, put };
}
