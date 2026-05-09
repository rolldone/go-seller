import { useEffect, useMemo, useState } from "react";
import CourierCard from "./CourierCard";
import type { CustomerAddress } from "../customer/auth/authApi";
import { notifyError, notifySuccess } from "../../lib/notification";
import { useTranslations } from "../../i18n";
import { formatAmount } from "../../lib/amountFormat";
import { buildPaymentConfirmationPath } from "../../lib/paymentRedirect";

type OrderItem = {
  id: string;
  product_name?: string;
  qty: number;
  unit_price: number;
  tax_amount: number;
  tax_type?: string;
  tax_rate?: number;
  line_total: number;
};

type Payment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  provider_key?: string | null;
  payment_method?: string | null;
  proof_status?: string | null;
  created_at?: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

type BankConfig = {
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  account_name?: string;
  reference?: string;
  instructions?: string;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  fulfillment_type?: string;
  grand_total: number;
  metadata?: unknown;
  business_id?: string | null;
  extra_charges?: Array<{
    id: string;
    name: string;
    amount: number;
    notes?: string | null;
  }>;
  order_items: OrderItem[];
  payments: Payment[];
};

type Provider = {
  id: string;
  name: string;
  provider_key: string;
  is_active: boolean;
  config?: BankConfig;
};

type PaymentMethod = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  provider_id: string;
  provider?: {
    id: string;
    name: string;
    provider_key: string;
  } | null;
};

type GuestDetailResponse = {
  data: {
    token: string;
    order: Order;
    customer?: Customer | null;
    providers: Provider[];
    expires_at: string;
  };
};

type StartPaymentResponse = {
  data: Payment;
};

const getApiUrl = () => import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") || "";

function parseMetadata(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    try {
      const decoded = typeof window !== "undefined" ? window.atob(value) : "";
      return JSON.parse(decoded) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

function parseShippingQuote(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.shipping_quote || metadata.shippingQuote;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function parseShippingAddress(orderMetadata: unknown): Record<string, any> | null {
  const metadata = parseMetadata(orderMetadata);
  if (!metadata) return null;
  const raw = metadata.shipping_address;
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
}

function formatAddressSummary(address: CustomerAddress): string {
  return String(
    [
      address.address_line_1,
      address.address_line_2,
      address.subdistrict,
      address.district,
      address.city,
      address.province,
      address.postal_code,
    ]
      .filter(Boolean)
      .join(", ") || "-",
  );
}

function formatTaxPercent(rate?: number | null): string {
  if (!rate || rate <= 0) return "0%";
  const normalized = rate <= 1 ? rate * 100 : rate;
  const rounded = Math.round(normalized * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)}%`;
}

function formatTaxMode(taxType?: string | null, taxRate?: number | null): string {
  const mode = String(taxType || "").toLowerCase() === "include" ? "Include" : "Exclude";
  return `${mode} ${formatTaxPercent(taxRate)}`;
}

async function guestGet<T>(path: string): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const res = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    const e: any = new Error(message);
    e.token_revoked = !!(payload && payload.token_revoked);
    e.token_in_use = !!(payload && payload.token_in_use);
    throw e;
  }
  return payload as T;
}

async function guestPost<T>(path: string, body: unknown): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    const e: any = new Error(message);
    e.token_revoked = !!(payload && payload.token_revoked);
    e.token_in_use = !!(payload && payload.token_in_use);
    throw e;
  }
  return payload as T;
}

async function guestPostForm<T>(path: string, formData: FormData): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error("PUBLIC_API_URL belum dikonfigurasi");

  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (payload && (payload.error || payload.message)) || `HTTP ${res.status}`;
    const e: any = new Error(message);
    e.token_revoked = !!(payload && payload.token_revoked);
    e.token_in_use = !!(payload && payload.token_in_use);
    throw e;
  }
  return payload as T;
}

export default function GuestOrderCheckout({ token }: { token?: string }) {
  const resolvedToken = useMemo(() => {
    if (token && token.trim()) return token.trim();
    if (typeof window === "undefined") return "";
    const qs = new URLSearchParams(window.location.search);
    return (qs.get("token") || "").trim();
  }, [token]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderID, setSelectedProviderID] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodID, setSelectedMethodID] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [senderBankName, setSenderBankName] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [senderAccountHolder, setSenderAccountHolder] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferredAt, setTransferredAt] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofNotes, setProofNotes] = useState("");
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressID, setSelectedAddressID] = useState("");
  const [shippingAddressError, setShippingAddressError] = useState("");
  const [updatingShippingAddress, setUpdatingShippingAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: "",
    receiver_name: "",
    phone_number: "",
    address_line_1: "",
    address_line_2: "",
    subdistrict: "",
    district: "",
    city: "",
    province: "",
    postal_code: "",
    country: "ID",
    notes: "",
    is_primary: false,
  });

  const t = useTranslations();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (!resolvedToken) {
          throw new Error(t("guestOrder.tokenNotFound", "Token checkout tidak ditemukan"));
        }
        const res = await guestGet<GuestDetailResponse>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}`);
        const data = res.data;
        setOrder(data.order || null);
        setCustomer(data.customer || null);
        setProviders(data.providers || []);
        setExpiresAt(data.expires_at || "");
        setTransferAmount(String((data.order?.grand_total || 0).toFixed(2)));
        setTransferredAt(new Date().toISOString().slice(0, 16));
        if ((data.providers || []).length > 0) {
          setSelectedProviderID(data.providers[0].id);
        }
        // Fetch payment methods for this business
        const businessID = data.order?.business_id;
        if (businessID) {
          try {
            const methodsRes = await guestGet<{ data: PaymentMethod[] }>(`/api/order/payment-methods?business_id=${encodeURIComponent(businessID)}`);
            const activeMethods = (methodsRes.data || []).filter((m) => m.is_active);
            setPaymentMethods(activeMethods);
            if (activeMethods.length > 0) {
              setSelectedMethodID(activeMethods[0].id);
            }
          } catch {
            // fallback to providers
          }
        }
      } catch (err) {
          // handle token_revoked flag from server (guest revisited after confirmation)
          const tokenRevoked = (err && (err as any).token_revoked) || false;
          if (tokenRevoked) {
            try {
              // redirect to confirmed/thank-you page
              window.location.href = '/order/confirmed';
              return;
            } catch (e) {}
          }
          setError(err instanceof Error ? err.message : t("guestOrder.loadFailed", "Gagal memuat detail order"));
      } finally {
        setLoading(false);
        }
    })();
  }, [resolvedToken]);

  const loadAddresses = async () => {
    if (!resolvedToken) return;
    setShippingAddressError("");
    try {
      const res = await guestGet<{ data: CustomerAddress[] }>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}/addresses`);
      setAddresses(res.data || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t("guestOrder.loadAddressesFailed", "Gagal memuat alamat");
      setShippingAddressError(message);
      setAddresses([]);
    }
  };

  const applyShippingAddress = async (addressID: string) => {
    if (!resolvedToken || !addressID) return;
    if (shippingAddressLocked) {
      const message = t("guestOrder.addressLocked", "Alamat tidak bisa diubah karena ongkir sudah dibuat.");
      setShippingAddressError(message);
      notifyError(message);
      return;
    }
    setUpdatingShippingAddress(true);
    setShippingAddressError("");
    try {
      await guestPost<{ data: Order }>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}/shipping-address`, {
        address_id: addressID,
      });
      await loadAddresses();
      const res = await guestGet<GuestDetailResponse>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}`);
      const data = res.data;
      setOrder(data.order || null);
      setCustomer(data.customer || null);
      setProviders(data.providers || []);
      setExpiresAt(data.expires_at || "");
      setTransferAmount(String((data.order?.grand_total || 0).toFixed(2)));
      setTransferredAt(new Date().toISOString().slice(0, 16));
      notifySuccess(t("guestOrder.addressUpdated", "Alamat pengiriman diperbarui. Menunggu konfirmasi ongkir baru."));
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : t("guestOrder.updateAddressFailed", "Gagal memperbarui alamat pengiriman");
      setShippingAddressError(message);
      notifyError(message);
    } finally {
      setUpdatingShippingAddress(false);
    }
  };

  const createAndApplyAddress = async () => {
    if (!resolvedToken) return;
    if (shippingAddressLocked) {
      const message = t("guestOrder.addressAddLocked", "Alamat tidak bisa ditambahkan dari checkout karena ongkir sudah dibuat.");
      setShippingAddressError(message);
      notifyError(message);
      return;
    }
    setSubmittingAddress(true);
    setShippingAddressError("");
    try {
      const payload = {
        label: addressForm.label,
        receiver_name: addressForm.receiver_name,
        phone_number: addressForm.phone_number,
        address_line_1: addressForm.address_line_1,
        address_line_2: addressForm.address_line_2 || null,
        subdistrict: addressForm.subdistrict || null,
        district: addressForm.district || null,
        city: addressForm.city,
        province: addressForm.province,
        postal_code: addressForm.postal_code,
        country: addressForm.country,
        notes: addressForm.notes || null,
        is_primary: addressForm.is_primary,
      };
      const created = await guestPost<{ data: CustomerAddress }>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}/addresses`, payload);
      setShowAddressForm(false);
      setAddressForm((current) => ({ ...current, address_line_2: "", subdistrict: "", district: "", notes: "", is_primary: false }));
      await loadAddresses();
      await applyShippingAddress(created.data.id);
      setSelectedAddressID(created.data.id);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : t("guestOrder.addAddressFailed", "Gagal menambah alamat");
      setShippingAddressError(message);
      notifyError(message);
    } finally {
      setSubmittingAddress(false);
    }
  };

  useEffect(() => {
    if (!resolvedToken) return;
    void loadAddresses();
  }, [resolvedToken]);

  const shippingQuote = useMemo(() => parseShippingQuote(order?.metadata), [order?.metadata]);
  const shippingAddress = useMemo(() => parseShippingAddress(order?.metadata), [order?.metadata]);
  const shippingAddressID = String(shippingAddress?.address_id || "").trim();
  const shippingQuoteReady = Boolean(shippingQuote?.ready);
  const shippingAddressLocked = shippingQuoteReady;
  const taxBreakdown = useMemo(() => {
    const groups = new Map<string, { taxType: string; taxRate: number; amount: number }>();
    for (const item of order?.order_items || []) {
      const taxType = String(item.tax_type || "exclude").toLowerCase() === "include" ? "include" : "exclude";
      const taxRate = Number(item.tax_rate || 0);
      const key = `${taxType}:${taxRate.toFixed(4)}`;
      const current = groups.get(key) || { taxType, taxRate, amount: 0 };
      current.amount += Number(item.tax_amount || 0);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate || a.taxType.localeCompare(b.taxType));
  }, [order?.order_items]);

  const extraCharges = useMemo(
    () =>
      (order?.extra_charges || [])
        .map((item) => ({
          id: String(item.id || ""),
          name: String(item.name || "").trim() || t("extraChargeLabel", "Extra Charge"),
          amount: Number(item.amount || 0),
        }))
        .filter((item) => item.amount > 0),
    [order?.extra_charges, t],
  );

  const canStartPayment = useMemo(() => {
    if (!order) return false;
    const status = (order.status || "").toLowerCase();
    const paymentStatus = (order.payment_status || "").toLowerCase();
    if (!shippingAddressID) return false;
    if (status === "awaiting_shipping" || status === "pending_shipping" || status === "awaiting_quote") return false;
    if (paymentStatus === "awaiting_shipping" || paymentStatus === "pending_shipping" || paymentStatus === "awaiting_quote") return false;
    if ((status === "pending" || paymentStatus === "unpaid") && !shippingQuoteReady) return false;
    if (order.payment_status === "paid") return false;
    if (!selectedMethodID && !selectedProviderID) return false;
    return true;
  }, [order, selectedMethodID, selectedProviderID, shippingAddressID, shippingQuoteReady]);

  useEffect(() => {
    if (shippingAddressID) {
      setSelectedAddressID(shippingAddressID);
      return;
    }
    if (addresses.length > 0) {
      const primary = addresses.find((item) => item.is_primary) || addresses[0];
      setSelectedAddressID(primary?.id || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, shippingAddressID]);

  useEffect(() => {
    if (customer?.name && !addressForm.receiver_name.trim()) {
      setAddressForm((current) => ({ ...current, receiver_name: customer.name || current.receiver_name }));
    }
    if (customer?.phone && !addressForm.phone_number.trim()) {
      setAddressForm((current) => ({ ...current, phone_number: customer.phone || current.phone_number }));
    }
  }, [customer]);

  const awaitingShippingQuote = useMemo(() => {
    if (!order) return false;
    const status = (order.status || "").toLowerCase();
    const paymentStatus = (order.payment_status || "").toLowerCase();
    if (!shippingAddressID) return true;
    return (
      status === "awaiting_shipping" ||
      status === "pending_shipping" ||
      status === "awaiting_quote" ||
      paymentStatus === "awaiting_shipping" ||
      paymentStatus === "pending_shipping" ||
      paymentStatus === "awaiting_quote" ||
      ((status === "pending" || paymentStatus === "unpaid") && !shippingQuoteReady)
    );
  }, [order, shippingAddressID, shippingQuoteReady]);

  const selectedMethod = useMemo(() => paymentMethods.find((m) => m.id === selectedMethodID) || null, [paymentMethods, selectedMethodID]);
  const selectedProvider = useMemo(
    () =>
      selectedMethod
        ? (providers.find((p) => p.id === selectedMethod.provider_id) || null)
        : (providers.find((p) => p.id === selectedProviderID) || null),
    [selectedMethod, providers, selectedMethodID, selectedProviderID],
  );
  const isBankTransfer = useMemo(() => (selectedProvider?.provider_key || "").toLowerCase() === "bank_transfer", [selectedProvider]);

  const canSubmitBankTransfer = useMemo(() => {
    if (!isBankTransfer) return true;
    if (!senderBankName.trim() || !senderAccountNumber.trim() || !senderAccountHolder.trim()) return false;
    if (!transferAmount.trim() || Number.isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) return false;
    if (!transferredAt.trim()) return false;
    if (!proofFiles || proofFiles.length === 0) return false;
    return true;
  }, [isBankTransfer, senderBankName, senderAccountNumber, senderAccountHolder, transferAmount, transferredAt, proofFiles]);

  const startPayment = async () => {
    if (!canStartPayment) return;
    setSubmitting(true);
    setError("");
    try {
      let res: StartPaymentResponse;
      if (isBankTransfer) {
        if (!proofFiles || proofFiles.length === 0) throw new Error(t("guestOrder.proofRequired", "Bukti transfer wajib diunggah"));
        const form = new FormData();
        form.set("provider_id", selectedProvider?.id || selectedProviderID);
        if (selectedMethodID) form.set("payment_method_id", selectedMethodID);
        form.set("sender_bank_name", senderBankName.trim());
        form.set("sender_account_number", senderAccountNumber.trim());
        form.set("sender_account_holder", senderAccountHolder.trim());
        form.set("transfer_amount", String(Number(transferAmount)));
        form.set("transferred_at", new Date(transferredAt).toISOString());
        form.set("reference", transferReference.trim());
        for (const f of proofFiles) {
          form.append("proof", f);
        }
        if (proofNotes.trim()) {
          form.set("proof_notes", proofNotes.trim());
        }
        res = await guestPostForm<StartPaymentResponse>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}/start-payment`, form);
      } else {
        res = await guestPost<StartPaymentResponse>(`/api/order/guest-checkout/${encodeURIComponent(resolvedToken)}/start-payment`, {
          provider_id: selectedProvider?.id || selectedProviderID,
          ...(selectedMethodID ? { payment_method_id: selectedMethodID } : {}),
        });
      }
      setLastPayment(res.data);
      // redirect to thank-you page and include payment id
      try {
        const pid = String(res.data.id || "").trim();
        window.location.href = buildPaymentConfirmationPath(pid);
        return;
      } catch (e) {
        // fallback: keep inline confirmation
        setConfirmed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("guestOrder.paymentStartFailed", "Gagal memulai pembayaran"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{t("guestOrder.loading", "Memuat detail order...")}</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>;
  }

  if (!order) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{t("guestOrder.notFound", "Order tidak ditemukan.")}</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t("guestOrder.heading", "Detail Order")}</h1>
            <p className="text-sm text-slate-600">{t("guestOrder.orderNumberPrefix", "Order")} #{order.order_number}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{t("guestOrder.status", "Status")} : {order.status}</div>
            <div>{t("guestOrder.payment", "Payment")} : {order.payment_status}</div>
            {expiresAt ? <div>{t("guestOrder.tokenExpires", "Token expires")} : {new Date(expiresAt).toLocaleString()}</div> : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("guestOrder.customerInfo", "Informasi Customer")}</h2>
        {customer ? (
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div><span className="text-slate-500">{t("guestOrder.customerNameLabel", "Nama:")}</span> {customer.name || "-"}</div>
            <div><span className="text-slate-500">{t("guestOrder.customerEmailLabel", "Email:")}</span> {customer.email || "-"}</div>
            <div><span className="text-slate-500">{t("guestOrder.customerPhoneLabel", "Telepon:")}</span> {customer.phone || "-"}</div>
            <div><span className="text-slate-500">{t("guestOrder.customerIdLabel", "Customer ID:")}</span> {customer.id}</div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t("guestOrder.customerDataNotAvailable", "Data customer tidak tersedia.")}</p>
        )}
      </section>

      {shippingAddress || addresses.length > 0 || showAddressForm ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("shippingAddress", "Alamat Pengiriman")}</h2>
          {addresses.length > 0 && !shippingAddressLocked ? (
            <div className="mt-3 flex items-center justify-between gap-3">
                <button
                type="button"
                onClick={() => setShowAddressForm((current) => !current)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {showAddressForm ? t("guestOrder.close", "Tutup") : t("guestOrder.addNew", "Tambah Baru")}
              </button>
            </div>
          ) : null}

          {!shippingAddressLocked && addresses.length > 0 ? (
            <div className="mt-3 space-y-2">
                <select
                value={selectedAddressID}
                onChange={(event) => setSelectedAddressID(event.target.value)}
                disabled={updatingShippingAddress}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">{t("guestOrder.selectAddress", "Pilih alamat")}</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {(address.label || t("guestOrder.address", "Alamat")) + (address.is_primary ? t("guestOrder.primarySuffix", " (Utama)") : "") + " - " + address.receiver_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void applyShippingAddress(selectedAddressID)}
                disabled={!selectedAddressID || updatingShippingAddress || selectedAddressID === shippingAddressID}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingShippingAddress ? t("guestOrder.savingAddress", "Menyimpan alamat...") : selectedAddressID === shippingAddressID ? t("guestOrder.activeAddress", "Alamat Aktif") : t("guestOrder.useThisAddress", "Pakai Alamat Ini")}
              </button>
            </div>
          ) : null}

          {shippingAddress ? (
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">
                {String(shippingAddress.receiver_name || "-")}
                {shippingAddress.label ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{String(shippingAddress.label)}</span> : null}
              </div>
              <div>{String(shippingAddress.phone_number || "-")}</div>
              <div>
                {String(
                  shippingAddress.address_summary ||
                    [
                      shippingAddress.address_line_1,
                      shippingAddress.address_line_2,
                      shippingAddress.subdistrict,
                      shippingAddress.district,
                      shippingAddress.city,
                      shippingAddress.province,
                      shippingAddress.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    "-",
                )}
              </div>
            </div>
          ) : addresses.length > 0 ? (
            <p className="mt-3 text-sm text-slate-600">{t("guestOrder.selectAddressExplanation", "Pilih alamat dari daftar di atas untuk melihat alamat yang aktif.")}</p>
          ) : null}

          {shippingAddressLocked ? <p className="mt-3 text-xs text-amber-700">{t("guestOrder.addressLockedNotice", "Alamat dikunci karena ongkir sudah dibuat. Pilih alamat lain tidak diperbolehkan sampai ongkir direset.")}</p> : null}

          {!showAddressForm && addresses.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
              {t("guestOrder.noSavedAddress", "Belum ada alamat tersimpan. Isi alamat baru di bawah untuk lanjut.")}
            </div>
          ) : null}

          {!shippingAddressLocked && (showAddressForm || addresses.length === 0) ? (
            <form
              className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createAndApplyAddress();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.addressLabelTitle", "Label alamat")}</span>
                  <input value={addressForm.label} onChange={(e) => setAddressForm((current) => ({ ...current, label: e.target.value }))} placeholder={t("guestOrder.addressLabelPlaceholder", "Rumah, Kantor, dll")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.recipientName", "Nama penerima")}</span>
                  <input value={addressForm.receiver_name} onChange={(e) => setAddressForm((current) => ({ ...current, receiver_name: e.target.value }))} placeholder={t("guestOrder.recipientNamePlaceholder", "Nama penerima")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.phoneNumber", "Nomor HP")}</span>
                  <input value={addressForm.phone_number} onChange={(e) => setAddressForm((current) => ({ ...current, phone_number: e.target.value }))} placeholder={t("guestOrder.phonePlaceholder", "08xxxxxxxxxx")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.postalCode", "Kode pos")}</span>
                  <input value={addressForm.postal_code} onChange={(e) => setAddressForm((current) => ({ ...current, postal_code: e.target.value }))} placeholder={t("guestOrder.postalCodePlaceholder", "40123")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-900 sm:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.fullAddress", "Alamat lengkap")}</span>
                  <textarea value={addressForm.address_line_1} onChange={(e) => setAddressForm((current) => ({ ...current, address_line_1: e.target.value }))} placeholder={t("guestOrder.fullAddressPlaceholder", "Jalan, nomor rumah, RT/RW, patokan, gedung, dll")} className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.city", "Kota / Kabupaten")}</span>
                  <input value={addressForm.city} onChange={(e) => setAddressForm((current) => ({ ...current, city: e.target.value }))} placeholder={t("guestOrder.cityPlaceholder", "Contoh: Denpasar")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.province", "Provinsi")}</span>
                  <input value={addressForm.province} onChange={(e) => setAddressForm((current) => ({ ...current, province: e.target.value }))} placeholder={t("guestOrder.provincePlaceholder", "Contoh: Bali")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" required />
                </label>
              </div>

              <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-slate-900">{t("guestOrder.optionalDetailsSummary", "Detail tambahan opsional")}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-900">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.additionalAddress", "Alamat tambahan")}</span>
                    <input value={addressForm.address_line_2} onChange={(e) => setAddressForm((current) => ({ ...current, address_line_2: e.target.value }))} placeholder={t("guestOrder.additionalAddressPlaceholder", "Blok, unit, patokan tambahan")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-900">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.subdistrict", "Kelurahan / Desa")}</span>
                    <input value={addressForm.subdistrict} onChange={(e) => setAddressForm((current) => ({ ...current, subdistrict: e.target.value }))} placeholder={t("guestOrder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-900">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.district", "Kecamatan")}</span>
                    <input value={addressForm.district} onChange={(e) => setAddressForm((current) => ({ ...current, district: e.target.value }))} placeholder={t("guestOrder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-900">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.courierNote", "Catatan kurir")}</span>
                    <input value={addressForm.notes} onChange={(e) => setAddressForm((current) => ({ ...current, notes: e.target.value }))} placeholder={t("guestOrder.optional", "Opsional")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </label>
                </div>
              </details>

              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input type="checkbox" checked={addressForm.is_primary} onChange={(e) => setAddressForm((current) => ({ ...current, is_primary: e.target.checked }))} />
                {t("guestOrder.makePrimary", "Jadikan alamat utama")}
              </label>

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowAddressForm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {t("guestOrder.cancel", "Batal")}
                </button>
                <button type="submit" disabled={submittingAddress} className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {submittingAddress ? t("guestOrder.saving", "Menyimpan...") : t("guestOrder.saveAndUse", "Simpan & Pakai Alamat")}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("guestOrder.itemsHeading", "Item Order")}</h2>
        {(order.order_items || []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t("guestOrder.noItems", "Tidak ada item.")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">{t("guestOrder.colProduct", "Produk")}</th>
                  <th className="px-3 py-2 text-right">{t("guestOrder.colQty", "Qty")}</th>
                  <th className="px-3 py-2 text-right">{t("guestOrder.colPrice", "Harga")}</th>
                  <th className="px-3 py-2 text-right">{t("guestOrder.colTax", "Pajak")}</th>
                  <th className="px-3 py-2 text-right">{t("guestOrder.colTotal", "Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.order_items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-800">
                      <div>{item.product_name || "-"}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span className={`rounded-full px-2 py-0.5 ${String(item.tax_type || "exclude") === "include" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
                          {formatTaxMode(item.tax_type, item.tax_rate)}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          {t("tax", "Pajak")} {formatAmount(item.tax_amount, { fractionDigits: 0 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{item.qty}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatAmount(item.unit_price, { fractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatAmount(item.tax_amount, { fractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatAmount(item.line_total, { fractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("guestOrder.summary", "Ringkasan")}</h2>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">{t("subtotal", "Subtotal")}</span><span>{formatAmount(order.subtotal, { fractionDigits: 0 })}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">{t("discount", "Diskon")}</span><span>-{formatAmount(order.discount_amount, { fractionDigits: 0 })}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">{t("tax", "Pajak")}</span><span>{formatAmount(order.tax_amount, { fractionDigits: 0 })}</span></div>
          {taxBreakdown.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {taxBreakdown.map((group) => (
                <div key={`${group.taxType}-${group.taxRate}`} className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("tax", "Pajak")} {formatTaxMode(group.taxType, group.taxRate)}</span>
                  <span className="font-medium text-slate-800">{formatAmount(group.amount, { fractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-between"><span className="text-slate-600">{t("guestOrder.shipping", "Ongkir")}</span><span>{formatAmount(order.shipping_amount, { fractionDigits: 0 })}</span></div>
          {extraCharges.map((charge) => (
            <div key={charge.id || charge.name} className="flex justify-between">
              <span className="text-slate-600">{charge.name}</span>
              <span>{formatAmount(charge.amount, { fractionDigits: 0 })}</span>
            </div>
          ))}
          {shippingQuote ? (
            <CourierCard shippingQuote={shippingQuote} fallbackAmount={order.shipping_amount} currency={order.currency} />
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>{t("totalLabel", "Total")}</span>
            <span>{formatAmount(order.grand_total, { fractionDigits: 0 })} {order.currency}</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("guestOrder.selectPaymentMethod", "Pilih Metode Pembayaran")}</h2>
        {awaitingShippingQuote ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
            {t("guestOrder.paymentUnavailable", "Pembayaran belum tersedia. Silakan pilih atau buat alamat pengiriman dulu, lalu tim kami akan menghubungi Anda via WhatsApp setelah ongkir dan total pembayaran dikonfirmasi.")}
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          {paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-emerald-300 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50"
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.id}
                    checked={selectedMethodID === method.id}
                    onChange={() => setSelectedMethodID(method.id)}
                    disabled={awaitingShippingQuote}
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{method.name}</div>
                    <div className="text-xs text-slate-500">{method.provider?.provider_key || ""}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <label className="block space-y-1 text-sm text-slate-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.paymentProvider", "Provider pembayaran")}</span>
              <select
                value={selectedProviderID}
                onChange={(event) => setSelectedProviderID(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={awaitingShippingQuote}
              >
                <option value="">{t("guestOrder.selectProvider", "Pilih provider")}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.provider_key})
                  </option>
                ))}
              </select>
            </label>
          )}

          {isBankTransfer ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.senderBankName", "Nama bank pengirim")}</span>
                  <input
                    value={senderBankName}
                    onChange={(event) => setSenderBankName(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("guestOrder.senderBankPlaceholder", "BCA, Mandiri, dll")}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.accountNumber", "Nomor rekening")}</span>
                  <input
                    value={senderAccountNumber}
                    onChange={(event) => setSenderAccountNumber(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("guestOrder.accountNumberPlaceholder", "Nomor rekening")}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.accountHolder", "Atas nama rekening")}</span>
                  <input
                    value={senderAccountHolder}
                    onChange={(event) => setSenderAccountHolder(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("guestOrder.accountHolderPlaceholder", "Nama pemilik rekening")}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.transferAmount", "Nominal transfer")}</span>
                  <input
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("guestOrder.transferAmountPlaceholder", "0")}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.transferTime", "Waktu transfer")}</span>
                  <input
                    value={transferredAt}
                    onChange={(event) => setTransferredAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    type="datetime-local"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.transferReference", "Referensi / catatan")}</span>
                  <input
                    value={transferReference}
                    onChange={(event) => setTransferReference(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder={t("guestOrder.transferReferencePlaceholder", "Referensi transfer")}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-900 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.proof", "Bukti transfer")}</span>
                  <input
                    type="file"
                    onChange={(event) => setProofFiles(Array.from(event.target.files || []))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    accept="image/*,application/pdf"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-900 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t("guestOrder.proofNotes", "Catatan bukti transfer (opsional)")}</span>
                  <textarea
                    value={proofNotes}
                    onChange={(event) => setProofNotes(event.target.value)}
                    placeholder={t("guestOrder.proofNotesPlaceholder", "Catatan bukti transfer (opsional)")}
                    className="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                    rows={2}
                  />
                </label>
              </div>

              <p className="text-xs text-slate-500">{t("guestOrder.proofNoteRequired", "Untuk bank transfer, bukti transfer wajib diunggah agar pesanan masuk ke tahap verifikasi.")}</p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <div className="mr-3 text-xs text-slate-600">
              {isBankTransfer
                ? t("guestOrder.confirmNote.bank", "Dengan menekan tombol konfirmasi, Anda menyatakan bukti transfer telah diunggah. Setelah konfirmasi, halaman ini tidak dapat diakses kembali.")
                : t("guestOrder.confirmNote.other", "Dengan menekan tombol, Anda melanjutkan proses pembayaran.")
              }
            </div>
            <button
              type="button"
              onClick={startPayment}
              disabled={
                !canStartPayment || submitting || (isBankTransfer ? !canSubmitBankTransfer : false)
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? t("guestOrder.processing", "Memproses...") : isBankTransfer ? t("guestOrder.confirmPayment", "Konfirmasi Pembayaran") : t("guestOrder.startPayment", "Mulai Pembayaran")}
            </button>
          </div>
        </div>
      </section>

      {confirmed ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">{t("guestOrder.confirmationSent", "Konfirmasi terkirim")}</div>
          <div className="mt-2">{t("guestOrder.thankYouConfirmation", "Terima kasih — bukti pembayaran Anda telah dikirim dan akan diverifikasi oleh tim kami.")}</div>
          {lastPayment ? (
            <div className="mt-2 text-xs text-emerald-700">{t("guestOrder.paymentId", "Payment ID:")} <span className="font-medium">{lastPayment.id}</span> ({lastPayment.status}{lastPayment.proof_status ? ` / proof: ${lastPayment.proof_status}` : ""})</div>
          ) : null}
          <div className="mt-3 text-xs text-slate-600">{t("guestOrder.confirmationImportant", "Penting: setelah konfirmasi, halaman ini tidak akan bisa dibuka lagi menggunakan token yang sama.")}</div>
        </div>
      ) : null}

      {lastPayment ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {t("guestOrder.paymentCreated", "Payment berhasil dibuat:")} <span className="font-semibold">{lastPayment.id}</span> ({lastPayment.status}{lastPayment.proof_status ? ` / proof: ${lastPayment.proof_status}` : ""})
        </div>
      ) : null}
    </div>
  );
}
