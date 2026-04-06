/** @jsxRuntime classic */
import React, { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { CustomerSession } from "../../lib/customerSession";
import { getCustomerAuthToken, getCustomerProfile } from "./auth/authApi";

interface CustomerPageNavProps {
  customerSession?: CustomerSession | null;
}

export default function CustomerPageNav({ customerSession = null }: CustomerPageNavProps) {
  const [session, setSession] = useState<CustomerSession | null>(customerSession);

  useEffect(() => {
    if (session?.authenticated) return;
    const token = getCustomerAuthToken();
    if (!token) return;
    setSession({
      authenticated: true,
      accessToken: token,
      profile: getCustomerProfile(),
      expiresAt: null,
    });
  }, [session]);

  const customerName = session?.profile?.name || "Customer";
  const customerEmail = session?.profile?.email || "";
  const isAuthenticated = Boolean(session?.authenticated);

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <a href="/" className="inline-flex items-center gap-2 transition hover:opacity-80">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-xl font-bold text-transparent">
          GoSeller
        </span>
      </a>

      <div className="flex items-center justify-end gap-3">
        {isAuthenticated ? (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{customerName}</p>
            {customerEmail ? <p className="text-xs text-slate-500">{customerEmail}</p> : null}
          </div>
        ) : null}
        <a
          href={isAuthenticated ? "/customer/auth/logout" : "/customer/auth/login"}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {isAuthenticated ? "Logout" : "Login"}
        </a>
      </div>
    </header>
  );
}
