/// <reference types="astro/client" />

import type { CustomerSession } from "./lib/customerSession";

declare global {
  namespace App {
    interface Locals {
      customerSession: CustomerSession | null;
      customerAuthenticated: boolean;
    }
  }

  interface Window {
    __CUSTOMER_SESSION__?: CustomerSession | null;
  }
}

export {};