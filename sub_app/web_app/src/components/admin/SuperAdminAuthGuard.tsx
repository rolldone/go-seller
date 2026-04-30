import { useEffect } from "react";

const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

/**
 * SuperAdminAuthGuard — verifies the current session belongs to a super admin.
 * Redirects to /admin/login if the token is missing or invalid,
 * and redirects to /admin (forbidden) if the admin is not a super admin.
 */
export default function SuperAdminAuthGuard() {
  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error("PUBLIC_API_URL not configured");

        const token = localStorage.getItem("access_token");
        if (!token) {
          window.location.href = "/admin/login";
          return;
        }

        const res = await fetch(`${apiUrl}/admin/auth/me`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!mounted) return;

        if (res.status === 401 || res.status === 403) {
          window.location.href = "/admin/login";
          return;
        }

        const payload = await res.json().catch(() => ({}));
        if (!mounted) return;

        const admin = payload?.data?.admin;
        if (!admin?.is_superadmin) {
          window.location.href = "/admin";
        }
      } catch {
        if (!mounted) return;
        window.location.href = "/admin/login";
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
