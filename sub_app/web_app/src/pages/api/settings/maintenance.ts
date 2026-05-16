import type { APIRoute } from "astro";

function getApiBase(): string {
  return import.meta.env.PUBLIC_API_URL ? String(import.meta.env.PUBLIC_API_URL).replace(/\/$/, "") : "";
}

export const GET: APIRoute = async ({ url }) => {
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

  const upstreamUrl = new URL(`${apiBase}/api/settings/maintenance`);
  const keys = url.searchParams.get("keys");
  if (keys) {
    upstreamUrl.searchParams.set("keys", keys);
  }

  const response = await fetch(upstreamUrl, {
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
