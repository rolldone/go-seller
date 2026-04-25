import { useEffect, useMemo, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import type { Product } from "../products/types";
import { adminDelete, adminGet, adminPost, adminPatch, adminPut } from "../entities/adminApi";
import ProductSelectorModal from "./ProductSelectorModal";
import type { AppliedCoupon, Order, OrderExtraCharge } from "../orders/types";
import DiscountSelector from "../discounts/DiscountSelector";
import { formatAmount } from "../../../lib/amountFormat";

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
  const [fulfillmentType, setFulfillmentType] = useState("delivery");

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discountSelectorOpen, setDiscountSelectorOpen] = useState(false);
  const [discountTargetItemID, setDiscountTargetItemID] = useState("");
  const [discountTargetProductID, setDiscountTargetProductID] = useState("");

  const [draftOrder, setDraftOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [customChargeName, setCustomChargeName] = useState("");
  const [customChargeAmount, setCustomChargeAmount] = useState("");
  const [customChargeNotes, setCustomChargeNotes] = useState("");
  const [savingExtraCharges, setSavingExtraCharges] = useState(false);

  const subtotal = useMemo(() => draftOrder?.subtotal || 0, [draftOrder]);
  const discountAmount = useMemo(() => draftOrder?.discount_amount || 0, [draftOrder]);
  const taxAmount = useMemo(() => draftOrder?.tax_amount || 0, [draftOrder]);
  const shippingAmount = useMemo(() => draftOrder?.shipping_amount || 0, [draftOrder]);
  const extraCharges = useMemo(() => (draftOrder?.extra_charges || []) as OrderExtraCharge[], [draftOrder?.extra_charges]);
  const extraChargeTotal = useMemo(
    () => extraCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    [extraCharges],
  );
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

  // load order if order_id provided in query string (open existing draft)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (orderId) {
      (async () => {
        try {
          await loadOrderDetail(orderId);
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to load order");
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
    setFulfillmentType(detail.data.order.fulfillment_type || "delivery");
    setCurrency(detail.data.order.currency || "IDR");
  };

  const syncDraftOrderFields = async (nextFields: { customerID?: string | null; fulfillmentType?: string } = {}) => {
    if (!draftOrder) return;
    const nextCustomerID = nextFields.customerID ?? customerID ?? null;
    const nextFulfillmentType = nextFields.fulfillmentType ?? fulfillmentType;
    setSubmitting(true);
    try {
      await adminPatch(`/admin/order/orders/${draftOrder.id}`, {
        customer_id: nextCustomerID || null,
        fulfillment_type: nextFulfillmentType,
      });
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Draft order updated");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save draft order");
    } finally {
      setSubmitting(false);
    }
  };

  const ensureDraftOrder = async (): Promise<Order> => {
    if (draftOrder) return draftOrder;
    const adminID = readAdminIDFromToken();
    if (!adminID) {
      throw new Error("Invalid admin token, please sign in again");
    }
    if (!businessID) {
      throw new Error("Business is required");
    }
    const payload = {
      admin_id: adminID,
      user_id: userID || undefined,
      customer_id: customerID || undefined,
      business_id: businessID,
      fulfillment_type: fulfillmentType,
      currency,
      is_draft: true,
    };
    const created = await adminPost<OrderCreateResponse>("/admin/order/orders", payload);
    setDraftOrder(created.data);
    return created.data;
  };

  const addLine = async () => {
    if (!selectedProduct) {
      notifyError("Select a product first");
      return;
    }
    if (qty <= 0) {
      notifyError("Quantity must be greater than 0");
      return;
    }
    const price = unitPrice > 0 ? unitPrice : Number((selectedProduct.sale_price ?? selectedProduct.price) || 0);
    if (price <= 0) {
      notifyError("Unit price is required");
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
      notifySuccess("Item added to order");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to add item");
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
      notifySuccess("Item removed");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setSubmitting(false);
    }
  };

  const openDiscountSelector = async (itemID: string, productID?: string | null) => {
    if (!productID) {
      notifyError("This item does not have a product_id");
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
      notifySuccess("Item discount removed");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to remove item discount");
    } finally {
      setSubmitting(false);
    }
  };

  const applyCoupon = async () => {
    if (!draftOrder) { notifyError("Create a draft order first"); return; }
    if (!couponCode.trim()) { notifyError("Enter a coupon code"); return; }
    setCouponApplying(true);
    try {
      await adminPost(`/admin/order/orders/${draftOrder.id}/coupon`, { coupon_code: couponCode.trim() });
      await loadOrderDetail(draftOrder.id);
      notifySuccess("Coupon applied successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid coupon";
      if (message.toLowerCase().includes("same category")) {
        notifyError("Coupons from the same category cannot be combined in one order.");
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
      notifySuccess("Coupon removed");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to remove coupon");
    } finally {
      setCouponApplying(false);
    }
  };

  const onSubmit = async () => {
    if (!draftOrder) {
      notifyError("No draft order yet");
      return;
    }
    if (!draftOrder.order_items || draftOrder.order_items.length === 0) {
      notifyError("Add at least 1 item");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost(`/admin/order/orders/${draftOrder.id}/finalize`);
      notifySuccess(`Order ${draftOrder.order_number} created successfully`);
      window.location.href = `/admin/orders?order_id=${encodeURIComponent(draftOrder.id)}`;
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const replaceExtraCharges = async (charges: Array<{ name: string; amount: number; notes?: string; sort_order?: number }>) => {
    setSavingExtraCharges(true);
    try {
      const order = await ensureDraftOrder();
      const adminID = readAdminIDFromToken();
      await adminPut(`/admin/order/orders/${order.id}/extra-charges`, {
        admin_id: adminID || undefined,
        charges,
      });
      await loadOrderDetail(order.id);
    } finally {
      setSavingExtraCharges(false);
    }
  };

  const handleAddCustomCharge = async () => {
    const name = customChargeName.trim();
    if (!name) {
      notifyError("Nama biaya tambahan wajib diisi");
      return;
    }
    const amount = Number(customChargeAmount || "0");
    if (!Number.isFinite(amount) || amount < 0) {
      notifyError("Nominal biaya tambahan harus angka >= 0");
      return;
    }

    try {
      const next = [
        ...extraCharges.map((charge, index) => ({
          name: String(charge.name || "").trim(),
          amount: Number(charge.amount || 0),
          notes: String(charge.notes || "").trim(),
          sort_order: Number(charge.sort_order || index + 1),
        })),
        {
          name,
          amount,
          notes: customChargeNotes.trim(),
          sort_order: extraCharges.length + 1,
        },
      ];
      await replaceExtraCharges(next);
      setCustomChargeName("");
      setCustomChargeAmount("");
      setCustomChargeNotes("");
      notifySuccess("Biaya tambahan disimpan");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan biaya tambahan");
    }
  };

  const handleRemoveCustomCharge = async (indexToRemove: number) => {
    try {
      const next = extraCharges
        .filter((_, index) => index !== indexToRemove)
        .map((charge, index) => ({
          name: String(charge.name || "").trim(),
          amount: Number(charge.amount || 0),
          notes: String(charge.notes || "").trim(),
          sort_order: index + 1,
        }));
      await replaceExtraCharges(next);
      notifySuccess("Biaya tambahan dihapus");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus biaya tambahan");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Internal POS</h3>
          <p className="text-sm text-slate-600">Create internal orders as an admin (items are saved directly to the order details).</p>
          {draftOrder ? <p className="text-xs text-slate-500">Draft: {draftOrder.order_number}</p> : null}
        </div>
        <a
          href={draftOrder?.id ? `/admin/orders?order_id=${encodeURIComponent(draftOrder.id)}` : "/admin/orders"}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
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
              await syncDraftOrderFields({ customerID: val || null });
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Fulfillment</label>
          <select
            value={fulfillmentType}
            onChange={async (e) => {
              const val = e.target.value === "pickup" ? "pickup" : "delivery";
              setFulfillmentType(val);
              await syncDraftOrderFields({ fulfillmentType: val });
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
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
              <span className="text-slate-500">No product selected yet.</span>
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
          <p className="mt-3 text-sm text-slate-600">No items yet.</p>
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
                    <td className="px-3 py-2 text-right text-slate-700">{formatAmount(line.unit_price, { fractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{line.discount_amount > 0 ? `-${formatAmount(line.discount_amount, { fractionDigits: 0 })}` : "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      <div>{line.tax_amount > 0 ? formatAmount(line.tax_amount, { fractionDigits: 0 }) : "-"}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {line.tax_amount > 0 ? formatTaxMode(line.tax_type, line.tax_rate) : "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatAmount(line.line_total, { fractionDigits: 0 })}</td>
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
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Coupon / Promo</h5>
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
                    title="Remove coupon"
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
              placeholder="Add another coupon code…"
              className="rounded border border-slate-300 px-3 py-2 text-sm uppercase flex-1 max-w-xs"
              disabled={!draftOrder}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponApplying || !draftOrder || !couponCode.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {couponApplying ? "..." : "Apply"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Coupons can be combined when their categories differ: product, shipping, cashback.</p>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Biaya Tambahan Custom</h5>
          <div className="grid gap-2 md:grid-cols-[2fr,1fr,2fr,auto]">
            <input
              type="text"
              value={customChargeName}
              onChange={(e) => setCustomChargeName(e.target.value)}
              placeholder="Nama biaya (mis: Packing Kayu, Asuransi)"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={customChargeAmount}
              onChange={(e) => setCustomChargeAmount(e.target.value)}
              placeholder="Nominal"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={customChargeNotes}
              onChange={(e) => setCustomChargeNotes(e.target.value)}
              placeholder="Catatan (opsional)"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddCustomCharge}
              disabled={savingExtraCharges || submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingExtraCharges ? "..." : "Tambah"}
            </button>
          </div>

          {extraCharges.length > 0 ? (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {extraCharges.map((charge, index) => (
                <div key={charge.id || `${charge.name}-${index}`} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{charge.name}</p>
                    {charge.notes ? <p className="truncate text-xs text-slate-500">{charge.notes}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{formatAmount(Number(charge.amount || 0), { fractionDigits: 0 })}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomCharge(index)}
                      disabled={savingExtraCharges || submitting}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Summary totals */}
        <div className="mt-4 border-t border-slate-200 pt-4 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatAmount(subtotal, { fractionDigits: 0 })}</span>
          </div>
          {(draftOrder?.applied_coupons ?? []).length > 0
            ? (draftOrder!.applied_coupons as AppliedCoupon[]).map((ac) => (
                <div key={ac.code} className="flex justify-between text-sm text-rose-600">
                  <span className="uppercase">{ac.code} <span className="normal-case text-rose-400 text-xs capitalize">({ac.category})</span></span>
                  <span>-{formatAmount(ac.discount_amount, { fractionDigits: 0 })}</span>
                </div>
              ))
            : discountAmount > 0 && (
                <div className="flex justify-between text-sm text-rose-600">
                  <span>Diskon</span>
                  <span>-{formatAmount(discountAmount, { fractionDigits: 0 })}</span>
                </div>
              )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax</span>
              <span>{formatAmount(taxAmount, { fractionDigits: 0 })}</span>
            </div>
            {taxBreakdown.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                {taxBreakdown.map((group) => (
                  <div key={`${group.taxType}-${group.taxRate}`} className="flex justify-between gap-3">
                    <span className="capitalize text-slate-500">Tax {formatTaxMode(group.taxType, group.taxRate)}</span>
                    <span className="font-medium text-slate-800">{formatAmount(group.amount, { fractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Fulfillment</span>
            <span>{fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</span>
          </div>
          {shippingAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Shipping</span>
              <span>{formatAmount(shippingAmount, { fractionDigits: 0 })}</span>
            </div>
          )}
          {extraCharges.map((charge) => (
            <div key={charge.id} className="flex justify-between text-sm text-slate-600">
              <span>{charge.name}</span>
              <span>{formatAmount(Number(charge.amount || 0), { fractionDigits: 0 })}</span>
            </div>
          ))}
          {extraChargeTotal > 0 ? (
            <div className="flex justify-between text-sm text-slate-700">
              <span>Total Biaya Tambahan</span>
              <span>{formatAmount(extraChargeTotal, { fractionDigits: 0 })}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatAmount(grandTotal, { fractionDigits: 0 })}</span>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
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
                notifySuccess("All items removed");
              } catch (err) {
                notifyError(err instanceof Error ? err.message : "Failed to clear items");
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
            notifySuccess("Discount applied");
          } catch (err) {
            notifyError(err instanceof Error ? err.message : "Failed to apply discount");
          } finally {
            setSubmitting(false);
          }
        }}
      />

    </div>
  );
}
