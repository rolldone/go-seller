export default function AdminLogoutButton() {
  const handleLogout = async () => {
    try {
      const apiUrl = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";
      if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${apiUrl}/admin/auth/logout`, { method: "POST", credentials: "include", headers });
    } catch (e) {
      // ignore errors and redirect anyway
    } finally {
      // Clear tokens from localStorage
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/admin/login";
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="ml-auto rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
    >
      Logout
    </button>
  );
}
