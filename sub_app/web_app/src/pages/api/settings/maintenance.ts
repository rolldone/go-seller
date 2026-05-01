import type { APIRoute } from "astro";

function getApiBase(): string {
  return import.meta.env.PUBLIC_API_URL ? String(import.meta.env.PUBLIC_API_URL).replace(/\/$/, "") : "";
}

export const GET: APIRoute = async () => {
  const apiBase = getApiBase();
  if (!apiBase) {
    return new Response(JSON.stringify({ error: "PUBLIC_API_URL belum dikonfigurasi" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  const response = await fetch(`${apiBase}/api/settings/maintenance`, {
    headers: { Accept: "application/json" },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
};
