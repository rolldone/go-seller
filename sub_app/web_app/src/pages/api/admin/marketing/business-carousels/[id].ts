import type { APIRoute } from "astro";
import { db, eq, BusinessCarousel } from "astro:db";
export const prerender = false;

const BACKEND_BASE = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

const getBearerToken = (request: Request) => {
  const auth = request.headers.get("Authorization") || request.headers.get("authorization") || request.headers.get("x-access-token") || "";
  const trimmed = (auth || "").trim();
  if (trimmed && trimmed.toLowerCase().startsWith("bearer ")) return trimmed.slice(7).trim();

  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|; )access_token=([^;]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);

  try {
    const url = new URL(request.url);
    const t = url.searchParams.get("token");
    if (t) return t.trim();
  } catch (e) {}

  return "";
};

const verifyAdminToken = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/admin/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const error = String(payload?.error || payload?.message || `HTTP ${res.status}`);
      return { ok: false, status: res.status, error };
    }

    const payload = await res.json().catch(() => ({}));
    return { ok: true, admin: payload?.data?.admin ?? null };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "failed to verify admin token" };
  }
};

const jsonError = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const serializeRow = (row: any) => ({
  id: row.id,
  businessId: row.businessId,
  slot: row.slot,
  title: row.title,
  subtitle: row.subtitle ?? null,
  layoutType: row.layoutType,
  isActive: Boolean(row.isActive),
  sortOrder: Number(row.sortOrder || 0),
  items: Array.isArray(row.items)
    ? row.items.map((item: any, index: number) => ({
        id: String(item?.id || `item-${index}`),
        title: String(item?.title || ""),
        subtitle: item?.subtitle ? String(item.subtitle) : "",
        image: item?.image ? String(item.image) : "",
        href: item?.href ? String(item.href) : "",
      }))
    : [],
  createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
});

export const PUT: APIRoute = async ({ request, params }) => {
  const auth = await verifyAdminToken(request);
  if (!auth.ok) {
    return jsonError(auth.error ?? "missing bearer token", auth.status || 401);
  }

  const id = String(params.id || "").trim();
  if (!id) {
    return jsonError("missing id", 400);
  }

  const body = (await request.json().catch(() => null)) as any;
  if (!body || typeof body !== "object") {
    return jsonError("invalid JSON body");
  }

  const businessId = String(body.businessId || "").trim();
  const slot = String(body.slot || "").trim();
  const title = String(body.title || "").trim();
  const layoutType = String(body.layoutType || "large").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!businessId || !slot) {
    return jsonError("businessId and slot are required");
  }

  await db
    .update(BusinessCarousel)
    .set({
      businessId,
      slot,
      title,
      subtitle: String(body.subtitle || "").trim() || null,
      layoutType: layoutType === "medium" || layoutType === "banner" ? layoutType : "large",
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder || 0),
      items,
      updatedAt: new Date(),
    })
    .where(eq(BusinessCarousel.id, id));

  const updated = await db.select().from(BusinessCarousel).where(eq(BusinessCarousel.id, id));
  if (!updated[0]) {
    return jsonError("carousel not found", 404);
  }

  return Response.json({ data: serializeRow(updated[0]) });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const auth = await verifyAdminToken(request);
  if (!auth.ok) {
    return jsonError(auth.error ?? "missing bearer token", auth.status || 401);
  }

  const id = String(params.id || "").trim();
  if (!id) {
    return jsonError("missing id", 400);
  }

  await db.delete(BusinessCarousel).where(eq(BusinessCarousel.id, id));
  return new Response(null, { status: 204 });
};