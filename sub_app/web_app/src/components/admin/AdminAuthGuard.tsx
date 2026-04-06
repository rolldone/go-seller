import { useEffect } from "react";
import { notifySuccess, notifyError } from "../../lib/notification";

const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

// AdminAuthGuard verifies admin session by calling a protected admin endpoint
// and displays any server-side flash messages when available.
export default function AdminAuthGuard() {
  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

        const token = localStorage.getItem("access_token");
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        if (!token) {
          window.location.href = "/admin/login";
          return;
        }

        const res = await fetch(`${apiUrl}/admin/admins?page=1&limit=1`, {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (res.status === 401 || res.status === 403) {
          if (!mounted) return;
          window.location.href = "/admin/login";
          return;
        }

        const payload = await res.json().catch(() => ({}));
        if (!mounted) return;

        // If backend attaches a flash message (one-time read), display it
        if (payload && payload.flash) {
          const { type, message } = payload.flash;
          if (type === "success") notifySuccess(message);
          else if (type === "error") notifyError(message);
          else notifySuccess(message);
        }
      } catch (e) {
        // On error, redirect to login as safe fallback
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
