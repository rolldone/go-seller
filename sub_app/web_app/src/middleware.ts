import { defineMiddleware } from "astro:middleware";

import { buildCustomerSession, parseCustomerProfile } from "./lib/customerSession";

export const onRequest = defineMiddleware(async (context, next) => {
  let accessToken = context.cookies.get("customer_access_token")?.value ?? "";
  const profileRaw = context.cookies.get("customer_profile")?.value ?? "";
  let profile = parseCustomerProfile(profileRaw);

  if (accessToken) {
    const apiUrl = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/customer/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          const customer = payload?.data?.customer;
          if (customer && typeof customer === "object") {
            profile = parseCustomerProfile(
              JSON.stringify({
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                locale: customer.locale,
              }),
            );
          }
        } else if (res.status === 401 || res.status === 403) {
          context.cookies.delete("customer_access_token", { path: "/" });
          context.cookies.delete("customer_profile", { path: "/" });
          accessToken = "";
          profile = null;
        }
      } catch {
        // Keep existing profile fallback on transient network errors.
      }
    }
  }

  context.locals.customerSession = buildCustomerSession(accessToken, profile, null);
  context.locals.customerAuthenticated = Boolean(context.locals.customerSession);

  if (!context.locals.customerAuthenticated) {
    context.cookies.delete("customer_access_token", { path: "/" });
    context.cookies.delete("customer_profile", { path: "/" });
    accessToken = "";
  }

  return next();
});