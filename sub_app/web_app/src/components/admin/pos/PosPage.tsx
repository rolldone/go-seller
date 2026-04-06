import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { Product } from "../products/types";
import { adminDelete, adminGet, adminPost, adminPostForm, adminGetBlob, adminPatch } from "../entities/adminApi";
import ProductSelectorModal from "./ProductSelectorModal";
import type { AppliedCoupon, Order, Payment } from "../orders/types";
import type { Discount } from "../discounts/types";
import DiscountSelector from "../discounts/DiscountSelector";
import AdminModal from "../ui/AdminModal";

type CustomerOption = {
  id: string;
  name?: string;
  email?: string;
};

type BusinessOption = {
  id: string;
  name: string;
};

type OrderCreateResponse = {
  data: Order;
};

type PaymentProviderOption = {
  id: string;
  name: string;
  provider_key: string;
  is_active: boolean;
};

type PaymentProof = {
  id: string;
  payment_id: string;
  public_url?: string | null;
  storage_key?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  notes?: string | null;
  status?: string;
  created_at?: string;
};

function readAdminIDFromToken(): string {
  const token = localStorage.getItem("access_token") || "";
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.admin_id || payload.sub || "");
  } catch {
    return "";
  }
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

export default function PosPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);

  const [userID, setUserID] = useState("");
  const [customerID, setCustomerID] = useState("");
  const [businessID, setBusinessID] = useState("");
  const [currency, setCurrency] = useState("IDR");

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discountSelectorOpen, setDiscountSelectorOpen] = useState(false);
  const [discountTargetItemID, setDiscountTargetItemID] = useState("");
  const [discountTargetProductID, setDiscountTargetProductID] = useState("");

  const [draftOrder, setDraftOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<PaymentProviderOption[]>([]);
  const [selectedProviderID, setSelectedProviderID] = useState("");
  const [proofFiles, setProofFiles] = useState<Record<string, File[]>>({});
  const [proofModalPaymentID, setProofModalPaymentID] = useState("");
  const [proofsByPayment, setProofsByPayment] = useState<Record<string, PaymentProof[]>>({});
  const [recheckStatus, setRecheckStatus] = useState<Record<string, string>>({});

  // coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);

  const subtotal = useMemo(() => draftOrder?.subtotal || 0, [draftOrder]);
  const discountAmount = useMemo(() => draftOrder?.discount_amount || 0, [draftOrder]);
  const taxAmount = useMemo(() => draftOrder?.tax_amount || 0, [draftOrder]);
  const shippingAmount = useMemo(() => draftOrder?.shipping_amount || 0, [draftOrder]);
  const grandTotal = useMemo(() => draftOrder?.grand_total || 0, [draftOrder]);
  const taxBreakdown = useMemo(() => {
    const groups = new Map<string, { taxType: string; taxRate: number; amount: number }>();
    for (const item of draftOrder?.order_items || []) {
      const taxType = String(item.tax_type || "exclude").toLowerCase() === "include" ? "include" : "exclude";
      const taxRate = Number(item.tax_rate || 0);
      const key = `${taxType}:${taxRate.toFixed(4)}`;
      const current = groups.get(key) || { taxType, taxRate, amount: 0 };
      current.amount += Number(item.tax_amount || 0);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate || a.taxType.localeCompare(b.taxType));
  }, [draftOrder?.order_items]);
  const businessNameByID = useMemo(() => Object.fromEntries(businesses.map((item) => [item.id, item.name])), [businesses]);

  useEffect(() => {
    (async () => {
      try {
        const customersRes = await adminGet<{ data: CustomerOption[] }>("/admin/customers?page=1&limit=200");
        setCustomers(customersRes.data || []);
      } catch {
        setCustomers([]);
      }

      try {
        const businessRes = await adminGet<{ data: BusinessOption[] }>("/admin/catalog/businesses?page=1&limit=200");
        setBusinesses(businessRes.data || []);
      } catch {
        setBusinesses([]);
      }
      // load store currency from settings (use as single source of truth)
      try {
        const settingRes = await adminGet<{ data: { key: string; scope: string; value: any } }>(
          `/admin/settings/${encodeURIComponent('store.currency')}?scope=global`,
        );
        const v = settingRes?.data?.value;
        if (v) setCurrency(String(v).toUpperCase());
      } catch {
        // ignore, keep default
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("include_inactive", "true");
        if (businessID) sp.set("business_id", businessID);
        const res = await adminGet<{ data: PaymentProviderOption[] }>(`/admin/order/payment-providers?${sp.toString()}`);
        const allProviders = res.data || [];
        setProviders(allProviders);
        if (allProviders.length === 1) {
          setSelectedProviderID(allProviders[0].id);
        }
      } catch {
        setProviders([]);
      }
    })();
  }, [businessID]);

  // load order if order_id provided in query string (open existing draft)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (orderId) {
      (async () => {
        try {
          await loadOrderDetail(orderId);
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Gagal memuat order");
          // optional: redirect back to orders
          window.location.href = "/admin/orders";
        }
      })();
    }
  }, []);

  const loadOrderDetail = async (orderID: string) => {
    const detail = await adminGet<{ data: { order: Order } }>(`/admin/order/orders/${orderID}`);
    setDraftOrder(detail.data.order);
    setUserID(detail.data.order.user_id || "");
    setCustomerID(detail.data.order.customer_id || "");
    setBusinessID(detail.data.order.business_id || "");
    setCurrency(detail.data.order.currency || "IDR");
  };

  const loadProofsForPayment = async (paymentID: string) => {
    try {
      const res = await adminGet<{ data: PaymentProof[] }>(`/admin/order/payments/${paymentID}/proofs`);
      setProofsByPayment((p) => ({ ...p, [paymentID]: res.data || [] }));
    } catch {
      setProofsByPayment((p) => ({ ...p, [paymentID]: [] }));
    }
  };

  const openProofModal = async (paymentID: string) => {
    setProofModalPaymentID(paymentID);
    await loadProofsForPayment(paymentID);
  };

  const deleteProof = async (proofID: string) => {
    if (!draftOrder) return;
    if (!proofModalPaymentID) return;
    if (!window.confirm("Hapus bukti ini?")) return;
    setSubmitting(true);
    try {
      await adminDelete(`/admin/order/payments/${proofModalPaymentID}/proofs/${proofID}`);
      await loadOrderDetail(draftOrder.id);
      await loadProofsForPayment(proofModalPaymentID);
      notifySuccess("Bukti dihapus");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus bukti");
    } finally {
      setSubmitting(false);
    }
  };

  const openProofPublicURL = async (proofID: string) => {
    if (!proofModalPaymentID) return;
    setSubmitting(true);
    try {
      // Use proxy streaming endpoint which requires admin auth; fetch as blob
      const blob = await adminGetBlob(`/admin/order/payments/${proofModalPaymentID}/proofs/${proofID}/access`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // revoke after a short delay to allow browser to load
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuka bukti");
    } finally {
      setSubmitting(false);
    }
  };

  const ensureDraftOrder = async (): Promise<Order> => {
    if (draftOrder) return draftOrder;
    const adminID = readAdminIDFromToken();
    if (!adminID) {
      throw new Error("Admin token tidak valid, silakan login ulang");
    }
    if (!businessID) {
      throw new Error("Business wajib dipilih");
    }
    const payload = {
      admin_id: adminID,
      user_id: userID || undefined,
      customer_id: customerID || undefined,
      business_id: businessID,
      currency,
      is_draft: true,
    };
    const created = await adminPost<OrderCreateResponse>("/admin/order/orders", payload);
    setDraftOrder(created.data);
    return created.data;
  };

  const addLine = async () => {
    if (!selectedProduct) {
      notifyError("Pilih product dulu");
      return;
    }
    if (qty <= 0) {
      notifyError("Qty harus lebih dari 0");
      return;
    }
    const price = unitPrice > 0 ? unitPrice : Number((selectedProduct.sale_price ?? selectedProduct.price) || 0);
    if (price <= 0) {
      notifyError("Unit price harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      const order = await ensureDraftOrder();
      await adminPost(`/admin/order/orders/${order.id}/items`, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        sku: selectedProduct.sku || undefined,
        qty,
        unit_price: price,
        discount_amount: 0,
      });
      await loadOrderDetail(order.id);
      setSelectedProduct(null);
      setQty(1);
      setUnitPrice(0);
      notifySuccess("Item ditambahkan ke order");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menambahkan item");
    } finally {
      setSubmitting(false);
    }
  };

  const removeLine = async (itemID: string) => {
    if (!draftOrder) return;
    setSubmitting(true);
    try {
      await adminDelete(`/admin/order/orders/${draftOrder.id}/items/${itemID}`);
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Item dihapus");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus item");
    } finally {
      setSubmitting(false);
    }
  };

  const openDiscountSelector = async (itemID: string, productID?: string | null) => {
    if (!productID) {
      notifyError("Item ini tidak memiliki product_id");
      return;
    }
    setDiscountTargetItemID(itemID);
    setDiscountTargetProductID(productID);
    setDiscountSelectorOpen(true);
  };

  const removeItemDiscount = async (itemID: string) => {
    if (!draftOrder) return;
    setSubmitting(true);
    try {
      await adminDelete(`/admin/order/orders/${draftOrder.id}/items/${itemID}/discount`);
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Discount item dihapus");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus discount item");
    } finally {
      setSubmitting(false);
    }
  };

  const applyCoupon = async () => {
    if (!draftOrder) { notifyError("Buat draft order dulu"); return; }
    if (!couponCode.trim()) { notifyError("Masukkan kode kupon"); return; }
    setCouponApplying(true);
    try {
      await adminPost(`/admin/order/orders/${draftOrder.id}/coupon`, { coupon_code: couponCode.trim() });
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Kupon berhasil diterapkan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kupon tidak valid";
      if (message.toLowerCase().includes("same category")) {
        notifyError("Kupon dengan kategori yang sama tidak bisa digabung dalam 1 order.");
      } else {
        notifyError(message);
      }
    } finally {
      setCouponApplying(false);
    }
  };

  const removeCoupon = async (code: string) => {
    if (!draftOrder) return;
    setCouponApplying(true);
    try {
      await adminDelete(`/admin/order/orders/${draftOrder.id}/coupon/${encodeURIComponent(code)}`);
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Kupon dihapus");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus kupon");
    } finally {
      setCouponApplying(false);
    }
  };

  const onSubmit = async () => {
    if (!draftOrder) {
      notifyError("Belum ada draft order");
      return;
    }
    if (!draftOrder.order_items || draftOrder.order_items.length === 0) {
      notifyError("Tambahkan minimal 1 item");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost(`/admin/order/orders/${draftOrder.id}/finalize`);
      notifySuccess(`Order ${draftOrder.order_number} berhasil dibuat`);
      window.location.href = "/admin/orders";
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuat order");
    } finally {
      setSubmitting(false);
    }
  };

  const createPaymentRecord = async () => {
    if (!draftOrder) {
      notifyError("Buat draft order dulu");
      return;
    }
    if (!selectedProviderID) {
      notifyError("Pilih payment provider dulu");
      return;
    }
    const provider = providers.find((item) => item.id === selectedProviderID);
    if (!provider) {
      notifyError("Provider tidak ditemukan");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost<{ data: Payment }>("/admin/order/payments", {
        order_id: draftOrder.id,
        amount: grandTotal,
        currency,
        provider_id: provider.id,
        provider_key: provider.provider_key,
        payment_method: provider.provider_key,
        gateway_name: provider.provider_key,
      });
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Payment berhasil dibuat");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuat payment");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProof = async (paymentID: string) => {
    const files = proofFiles[paymentID] || [];
    if (!files || files.length === 0) {
      notifyError("Pilih minimal 1 file bukti dulu");
      return;
    }
    setSubmitting(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("proof", file);
        // upload sequentially to keep it simple and preserve order
        await adminPostForm<{ data: unknown }>(`/admin/order/payments/${paymentID}/proof`, formData);
      }
      if (draftOrder) {
        await loadOrderDetail(draftOrder.id);
      }
      await loadProofsForPayment(paymentID);
      setProofFiles((prev) => ({ ...prev, [paymentID]: [] }));
      setProofModalPaymentID("");
      notifySuccess("Bukti transfer berhasil diupload");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal upload bukti");
    } finally {
      setSubmitting(false);
    }
  };

  const recheckGateway = async (paymentID: string) => {
    setSubmitting(true);
    try {
      await adminPost(`/admin/order/payments/${paymentID}/recheck`, {
        resolved_status: recheckStatus[paymentID] || "succeeded",
      });
      if (draftOrder) {
        await loadOrderDetail(draftOrder.id);
      }
      notifySuccess("Recheck payment berhasil");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal recheck payment");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPayment = async (paymentID: string) => {
    if (!draftOrder) return;
    const reason = window.prompt("Alasan penolakan (wajib):");
    if (reason === null) return; // user cancelled prompt
    if (!reason.trim()) {
      notifyError("Alasan harus diisi");
      return;
    }
    setSubmitting(true);
    try {
      await adminPost(`/admin/order/payments/${paymentID}/reject`, { notes: reason.trim() });
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Payment ditolak");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menolak payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Internal POS</h3>
          <p className="text-sm text-slate-600">Buat order internal oleh admin (item langsung tersimpan ke order detail).</p>
          {draftOrder ? <p className="text-xs text-slate-500">Draft: {draftOrder.order_number}</p> : null}
        </div>
        <a href="/admin/orders" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Back to Orders
        </a>
      </div>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Customer (optional)</label>
          <select
            value={customerID || userID}
            onChange={async (e) => {
              const val = e.target.value;
              setCustomerID(val);
              setUserID(val);
              if (!draftOrder) return;
              setSubmitting(true);
              try {
                // send PATCH to update customer_id on existing draft
                await adminPatch(`/admin/order/orders/${draftOrder.id}`, { customer_id: val || null });
                await loadOrderDetail(draftOrder.id);
                notifySuccess("Customer disimpan pada draft order");
              } catch (err) {
                notifyError(err instanceof Error ? err.message : "Gagal menyimpan customer");
              } finally {
                setSubmitting(false);
              }
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Walk-in / No customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Business *</label>
          <select value={businessID} onChange={(e) => setBusinessID(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select business</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
          <input value={currency} readOnly className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Add Item</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr,120px,180px]">
          <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
            {selectedProduct ? (
              <div>
                <div className="font-medium text-slate-900">{selectedProduct.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>ID: {selectedProduct.id}</span>
                  <span>SKU: {selectedProduct.sku || "-"}</span>
                  <span>Business: {selectedProduct.business_id ? businessNameByID[selectedProduct.business_id] || selectedProduct.business_id : "-"}</span>
                  {selectedProduct.price_override_enabled && <span className="rounded bg-amber-100 px-1 text-amber-700">Override ✓</span>}
                </div>
              </div>
            ) : (
              <span className="text-slate-500">Belum ada product dipilih.</span>
            )}
          </div>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Qty"
          />
          <div>
            <label className="mb-1 block text-xs text-slate-500">Unit Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Unit price"
              disabled={selectedProduct ? !selectedProduct.price_override_enabled && unitPrice === Number((selectedProduct.sale_price ?? selectedProduct.price) || 0) : false}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {selectedProduct ? "Change Product" : "Select Product"}
          </button>
          {selectedProduct ? (
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setUnitPrice(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Clear Product
            </button>
          ) : null}
          <button type="button" onClick={addLine} disabled={submitting} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            + Add Item to Order
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Order Items</h4>
        {!draftOrder || !draftOrder.order_items || draftOrder.order_items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Belum ada item.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Product</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Qty</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Disc</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Tax</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Line Total</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {draftOrder.order_items.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 text-slate-800">
                      <div>{line.product_name || line.product_id || "-"}</div>
                      {line.sku && <div className="text-xs text-slate-400">SKU: {line.sku}</div>}
                      {line.discount_name ? (
                        <div className="mt-1 text-xs text-amber-700">Discount: {line.discount_name}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{line.qty}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{line.unit_price.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{line.discount_amount > 0 ? `-${line.discount_amount.toLocaleString("id-ID")}` : "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      <div>{line.tax_amount > 0 ? line.tax_amount.toLocaleString("id-ID") : "-"}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {line.tax_amount > 0 ? formatTaxMode(line.tax_type, line.tax_rate) : "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{line.line_total.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openDiscountSelector(line.id, line.product_id)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Select Discount
                        </button>
                        {line.discount_amount > 0 ? (
                          <button
                            type="button"
                            onClick={() => removeItemDiscount(line.id)}
                            className="text-xs font-medium text-amber-700 hover:text-amber-800"
                          >
                            Clear Discount
                          </button>
                        ) : null}
                        <button type="button" onClick={() => removeLine(line.id)} className="text-xs font-medium text-rose-600 hover:text-rose-700">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Coupon input */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Kupon / Promo</h5>
          {/* Applied coupons list — one badge per coupon with remove button */}
          {(draftOrder?.applied_coupons ?? []).length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {(draftOrder!.applied_coupons as AppliedCoupon[]).map((ac) => (
                <div key={ac.code} className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">{ac.code}</span>
                  <span className="text-xs text-slate-500 capitalize">({ac.category})</span>
                  <button
                    type="button"
                    onClick={() => removeCoupon(ac.code)}
                    disabled={couponApplying}
                    className="ml-1 text-rose-400 hover:text-rose-600 disabled:opacity-50 text-xs leading-none"
                    title="Hapus kupon"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Input for a new coupon — visible as long as an order is open */}
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              placeholder="Tambah kode kupon lagi…"
              className="rounded border border-slate-300 px-3 py-2 text-sm uppercase flex-1 max-w-xs"
              disabled={!draftOrder}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponApplying || !draftOrder || !couponCode.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {couponApplying ? "..." : "Terapkan"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Kupon bisa digabung jika kategorinya berbeda: product, shipping, cashback.</p>
        </div>

        {/* Summary totals */}
        <div className="mt-4 border-t border-slate-200 pt-4 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{subtotal.toLocaleString("id-ID")}</span>
          </div>
          {(draftOrder?.applied_coupons ?? []).length > 0
            ? (draftOrder!.applied_coupons as AppliedCoupon[]).map((ac) => (
                <div key={ac.code} className="flex justify-between text-sm text-rose-600">
                  <span className="uppercase">{ac.code} <span className="normal-case text-rose-400 text-xs capitalize">({ac.category})</span></span>
                  <span>-{ac.discount_amount.toLocaleString("id-ID")}</span>
                </div>
              ))
            : discountAmount > 0 && (
                <div className="flex justify-between text-sm text-rose-600">
                  <span>Diskon</span>
                  <span>-{discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Pajak</span>
              <span>{taxAmount.toLocaleString("id-ID")}</span>
            </div>
            {taxBreakdown.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                {taxBreakdown.map((group) => (
                  <div key={`${group.taxType}-${group.taxRate}`} className="flex justify-between gap-3">
                    <span className="capitalize text-slate-500">Pajak {formatTaxMode(group.taxType, group.taxRate)}</span>
                    <span className="font-medium text-slate-800">{group.amount.toLocaleString("id-ID")}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {shippingAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Ongkir</span>
              <span>{shippingAmount.toLocaleString("id-ID")}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{grandTotal.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <div className="mr-auto flex flex-wrap items-center gap-2">
            <select
              value={selectedProviderID}
              onChange={(e) => setSelectedProviderID(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select payment provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.provider_key})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createPaymentRecord}
              disabled={submitting || !draftOrder}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Create Payment
            </button>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!draftOrder?.order_items) return;
              setSubmitting(true);
              try {
                for (const item of draftOrder.order_items) {
                  await adminDelete(`/admin/order/orders/${draftOrder.id}/items/${item.id}`);
                }
                await loadOrderDetail(draftOrder.id);
                notifySuccess("Semua item dihapus");
              } catch (err) {
                notifyError(err instanceof Error ? err.message : "Gagal clear item");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || !draftOrder}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creating order..." : "Create Order"}
          </button>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <h5 className="text-sm font-semibold text-slate-900">Payments</h5>
          {!draftOrder?.payments || draftOrder.payments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Belum ada payment.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {draftOrder.payments.map((payment) => {
                    const providerKey = (payment.provider_key || "").toLowerCase();
                    const isBank = providerKey === "bank_transfer";
                    const isCash = providerKey === "cash_money" || providerKey === "cash";
                    const isGateway = providerKey !== "" && providerKey !== "bank_transfer" && providerKey !== "cash_money" && providerKey !== "cash";
                    return (
                      <tr key={payment.id}>
                        <td className="px-3 py-2 text-slate-800">
                          {(payment.provider_key || payment.gateway_name || payment.payment_method || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {payment.status}
                          {payment.proof_status ? ` / proof:${payment.proof_status}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-900">
                          {payment.amount.toLocaleString("id-ID")} {payment.currency}
                        </td>
                        <td className="px-3 py-2">
                          {payment.status === "cancelled" ? null : (
                            <div className="flex items-center gap-2">
                              {(isBank || isCash) ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openProofModal(payment.id)}
                                    className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                                  >
                                    Manage Proofs
                                  </button>
                                  {(proofsByPayment[payment.id] || []).length > 0 ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                      {(proofsByPayment[payment.id] || []).length} bukti
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {isGateway ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={recheckStatus[payment.id] || "succeeded"}
                                    onChange={(e) => setRecheckStatus((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                                  >
                                    <option value="succeeded">succeeded</option>
                                    <option value="pending">pending</option>
                                    <option value="failed">failed</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => recheckGateway(payment.id)}
                                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                  >
                                    Recheck Gateway
                                  </button>
                                </div>
                              ) : null}

                              {/* Cancel: allow for bank_transfer and cash even if proofs exist */}
                              {(payment.status === "pending" || payment.status === "pending_verification") && !payment.provider_transaction_id && !payment.gateway_transaction_id && (isBank || isCash || (!((proofsByPayment[payment.id] || []).length > 0))) ? (
                                <button
                                  type="button"
                                  onClick={() => cancelPayment(payment.id)}
                                  disabled={submitting}
                                  className="ml-2 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                                >
                                  Reject
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <ProductSelectorModal
        open={selectorOpen}
        businessID={businessID}
        businessNameByID={businessNameByID}
        currentProductID={selectedProduct?.id}
        onClose={() => setSelectorOpen(false)}
        onSelect={(product) => {
          setSelectedProduct(product);
          setUnitPrice(Number((product.sale_price ?? product.price) || 0));
          setSelectorOpen(false);
        }}
      />

      <DiscountSelector
        open={discountSelectorOpen}
        productID={discountTargetProductID}
        onClose={() => setDiscountSelectorOpen(false)}
        onSelect={async (discount) => {
          if (!draftOrder || !discountTargetItemID) return;
          setSubmitting(true);
          try {
            await adminPost(`/admin/order/orders/${draftOrder.id}/items/${discountTargetItemID}/discount`, { discount_id: discount.id });
            await loadOrderDetail(draftOrder.id);
            setDiscountSelectorOpen(false);
            notifySuccess("Discount diterapkan");
          } catch (err) {
            notifyError(err instanceof Error ? err.message : "Gagal menerapkan discount");
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <AdminModal
        open={Boolean(proofModalPaymentID)}
        title="Upload Bukti Pembayaran"
        onClose={() => {
          setProofModalPaymentID("");
        }}
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setProofModalPaymentID("")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => uploadProof(proofModalPaymentID)}
              disabled={submitting || !proofModalPaymentID}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Upload
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {(proofsByPayment[proofModalPaymentID] || []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Bukti yang sudah diupload</p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {(proofsByPayment[proofModalPaymentID] || []).map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                    <div className="min-w-0 flex-1 text-xs text-slate-700">
                      <div className="truncate font-medium">{proof.storage_key?.split("/").pop() || "Proof file"}</div>
                      <div className="text-slate-500">{proof.status || "uploaded"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openProofPublicURL(proof.id)}
                        className="text-xs text-blue-600 underline"
                        disabled={submitting}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProof(proof.id)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Belum ada bukti yang diupload.</p>
          )}

          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-600">Tambah bukti baru</p>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,application/*"
            onChange={(e) => {
              if (!proofModalPaymentID) return;
              const files = e.target.files ? Array.from(e.target.files) : [];
              setProofFiles((prev) => ({ ...prev, [proofModalPaymentID]: files }));
            }}
            className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
          />
          {(proofFiles[proofModalPaymentID] || []).length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="mb-2 text-xs font-medium text-slate-600">File terpilih:</p>
              <ul className="space-y-1 text-xs text-slate-700">
                {(proofFiles[proofModalPaymentID] || []).map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="truncate">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Pilih satu atau beberapa file bukti.</p>
          )}
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
