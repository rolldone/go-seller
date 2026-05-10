import { useEffect, useState } from "react";
import { notifyError, notifySuccess } from "../../../lib/notification";
import { formatAmount } from "../../../lib/amountFormat";
import {
  createOrderShipment,
  getOrderByID,
  listOrderShipments,
  listShippableItems,
  type ShipmentStatus,
  updateOrderShipment,
} from "./api";
import type { Order, OrderItem, OrderShipment } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────

const money = (currency: string, amount: number) =>
  `${currency || "IDR"} ${formatAmount(amount || 0, { fractionDigits: 0 })}`;

const fmt = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("id-ID");
};

const parseOrderMetadata = (raw: unknown): Record<string, unknown> | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;

  const text = raw.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
};

// ── Status badge helpers ──────────────────────────────────────────────────────

type BadgeVariant = "gray" | "amber" | "green" | "red" | "blue" | "indigo" | "orange" | "purple";

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  gray: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
  indigo: "bg-indigo-100 text-indigo-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-purple-100 text-purple-800",
};

function badge(label: string, variant: BadgeVariant) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASSES[variant]}`}>{label}</span>
  );
}

function paymentStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") return badge("Lunas", "green");
  if (s === "pending" || s === "unpaid") return badge("Belum Bayar", "amber");
  if (s === "expired") return badge("Kedaluwarsa", "red");
  if (s === "cancelled" || s === "canceled") return badge("Dibatalkan", "gray");
  if (s === "refunded") return badge("Direfund", "purple");
  if (s === "failed") return badge("Gagal", "red");
  return badge(status, "amber");
}

function orderStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return badge("Selesai", "green");
  if (s === "processing") return badge("Diproses", "blue");
  if (s === "shipped") return badge("Dikirim", "indigo");
  if (s === "waiting_customer_confirmation") return badge("Menunggu Konfirmasi", "orange");
  if (s === "in_dispute") return badge("Dispute", "red");
  if (s === "refunded") return badge("Direfund", "purple");
  if (s === "cancelled" || s === "canceled") return badge("Dibatalkan", "gray");
  if (s === "awaiting_quote") return badge("Menunggu Ongkir", "amber");
  if (s === "quote_ready") return badge("Ongkir Siap", "amber");
  if (s === "draft") return badge("Draft", "gray");
  return badge(status, "amber");
}

function deliveryStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "not_applicable") return badge("Tidak Berlaku", "gray");
  if (s === "pending") return badge("Belum Dikirim", "amber");
  if (s === "ready_to_ship") return badge("Siap Kirim", "blue");
  if (s === "partially_shipped") return badge("Sebagian Dikirim", "indigo");
  if (s === "shipped") return badge("Dalam Pengiriman", "indigo");
  if (s === "delivered") return badge("Terkirim", "green");
  if (s === "exception") return badge("Ada Masalah", "red");
  if (s === "returned") return badge("Dikembalikan", "orange");
  if (s === "cancelled" || s === "canceled") return badge("Dibatalkan", "gray");
  return badge(status, "gray");
}

function shipmentStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "delivered") return badge("Terkirim", "green");
  if (s === "shipped" || s === "in_transit") return badge("Dikirim", "indigo");
  if (s === "ready_to_ship") return badge("Siap Kirim", "blue");
  if (s === "pending") return badge("Belum Aktif", "amber");
  if (s === "exception") return badge("Masalah", "red");
  if (s === "returned") return badge("Dikembalikan", "orange");
  if (s === "cancelled" || s === "canceled") return badge("Dibatalkan", "gray");
  return badge(status, "gray");
}

// ── Form state ────────────────────────────────────────────────────────────────

type ShipmentForm = {
  carrier_name: string;
  service_name: string;
  tracking_number: string;
  shipping_amount: string;
  estimated_delivery: string;
  description: string;
  notes: string;
};

const defaultShipmentForm: ShipmentForm = {
  carrier_name: "",
  service_name: "",
  tracking_number: "",
  shipping_amount: "0",
  estimated_delivery: "",
  description: "",
  notes: "",
};

type EditForm = ShipmentForm & {
  shipment_id: string;
  status: string;
};

const defaultEditForm: EditForm = { ...defaultShipmentForm, shipment_id: "", status: "pending" };

// ── Shipment card ─────────────────────────────────────────────────────────────

function ShipmentCard({
  shipment,
  onEdit,
}: {
  shipment: OrderShipment;
  onEdit: (s: OrderShipment) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {shipmentStatusBadge(shipment.status)}
          {shipment.carrier_name && (
            <span className="text-xs font-medium text-slate-600">{shipment.carrier_name}</span>
          )}
          {shipment.service_name && (
            <span className="text-xs text-slate-500">{shipment.service_name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEdit(shipment)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>
      </div>

      {shipment.tracking_number && (
        <p className="mb-1 text-sm font-mono font-semibold text-slate-800">
          Resi: {shipment.tracking_number}
        </p>
      )}
      {shipment.estimated_delivery && (
        <p className="text-xs text-slate-500">Estimasi: {shipment.estimated_delivery}</p>
      )}
      {shipment.description && (
        <p className="mt-1 text-xs text-slate-500">{shipment.description}</p>
      )}
      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        {shipment.shipped_at && <span>Dikirim: {fmt(shipment.shipped_at)}</span>}
        {shipment.delivered_at && <span>Tiba: {fmt(shipment.delivered_at)}</span>}
      </div>
      {(shipment.items?.length ?? 0) > 0 && (
        <p className="mt-2 text-xs text-slate-400">{shipment.items!.length} item terlampir</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrderDeliveryPage() {
  const [orderID, setOrderID] = useState<string>("");
  const [order, setOrder] = useState<Order | null>(null);
  const [shipments, setShipments] = useState<OrderShipment[]>([]);
  const [shippableItems, setShippableItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<ShipmentForm>(defaultShipmentForm);
  const [selectedItemIDs, setSelectedItemIDs] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(defaultEditForm);
  const [saving, setSaving] = useState(false);

  const buildAddFormFromQuote = (): ShipmentForm => {
    const metadata = parseOrderMetadata(order?.metadata);
    const shippingQuote = (metadata?.shipping_quote || metadata?.shippingQuote || null) as Record<string, any> | null;
    if (!shippingQuote) return defaultShipmentForm;

    return {
      carrier_name: String(shippingQuote.carrier_name || ""),
      service_name: String(shippingQuote.service_name || ""),
      tracking_number: "",
      shipping_amount: shippingQuote.shipping_amount != null ? String(shippingQuote.shipping_amount) : "0",
      estimated_delivery: String(shippingQuote.estimated_delivery || ""),
      description: String(shippingQuote.description || ""),
      notes: String(shippingQuote.notes || ""),
    };
  };

  // ── Resolve order ID from URL ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    // pattern: /admin/orders/{id}/delivery
    const idx = parts.findIndex((p) => p === "orders");
    const id = idx >= 0 ? parts[idx + 1] : null;
    if (id && id !== "delivery") {
      setOrderID(id);
    }
  }, []);

  // ── Fetch order + shipments when orderID is known ─────────────────────────
  useEffect(() => {
    if (!orderID) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [orderRes, shipRes] = await Promise.all([
          getOrderByID(orderID),
          listOrderShipments(orderID),
        ]);
        if (cancelled) return;
        setOrder({ ...orderRes.data.order, payments: orderRes.data.payments || orderRes.data.order.payments || [] });
        setShipments(shipRes.data || []);
        try {
          const itemRes = await listShippableItems(orderID);
          if (!cancelled) setShippableItems(itemRes.data || []);
        } catch {
          // shippable items optional
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orderID]);

  const refreshAll = async () => {
    if (!orderID) return;
    try {
      const [orderRes, shipRes] = await Promise.all([
        getOrderByID(orderID),
        listOrderShipments(orderID),
      ]);
      setOrder({ ...orderRes.data.order, payments: orderRes.data.payments || orderRes.data.order.payments || [] });
      setShipments(shipRes.data || []);
    } catch {
      // ignore
    }
  };

  // ── Add new shipment ──────────────────────────────────────────────────────
  const openAdd = () => {
    setAddForm(buildAddFormFromQuote());
    setSelectedItemIDs({});
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!order?.id) return;
    setSubmitting(true);
    try {
      const itemIDs = Object.entries(selectedItemIDs)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await createOrderShipment(order.id, {
        carrier_name: addForm.carrier_name,
        service_name: addForm.service_name,
        tracking_number: addForm.tracking_number,
        shipping_amount: parseFloat(addForm.shipping_amount) || 0,
        estimated_delivery: addForm.estimated_delivery,
        description: addForm.description,
        notes: addForm.notes,
        item_ids: itemIDs.length > 0 ? itemIDs : undefined,
      });
      notifySuccess("Shipment berhasil dibuat");
      setAddOpen(false);
      await refreshAll();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal membuat shipment");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit shipment ─────────────────────────────────────────────────────────
  const openEdit = (s: OrderShipment) => {
    setEditForm({
      shipment_id: s.id,
      status: s.status,
      carrier_name: s.carrier_name,
      service_name: s.service_name,
      tracking_number: s.tracking_number,
      shipping_amount: String(s.shipping_amount ?? 0),
      estimated_delivery: s.estimated_delivery,
      description: s.description,
      notes: s.notes,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.shipment_id) return;
    setSaving(true);
    try {
      await updateOrderShipment(editForm.shipment_id, {
        status: editForm.status as ShipmentStatus,
        carrier_name: editForm.carrier_name,
        service_name: editForm.service_name,
        tracking_number: editForm.tracking_number,
        shipping_amount: parseFloat(editForm.shipping_amount) || 0,
        estimated_delivery: editForm.estimated_delivery,
        description: editForm.description,
        notes: editForm.notes,
      });
      notifySuccess("Shipment diperbarui");
      setEditOpen(false);
      await refreshAll();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memperbarui shipment");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-sm text-slate-500">Memuat data pengiriman…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-600">{error ?? "Order tidak ditemukan"}</p>
        <a href="/admin/orders" className="text-sm text-sky-600 underline">
          ← Kembali ke daftar order
        </a>
      </div>
    );
  }

  const activeShipments = shipments.filter(
    (s) => !["cancelled", "canceled"].includes(s.status.toLowerCase()),
  );
  const cancelledShipments = shipments.filter((s) =>
    ["cancelled", "canceled"].includes(s.status.toLowerCase()),
  );

  const SHIPMENT_STATUSES = [
    "pending",
    "ready_to_ship",
    "shipped",
    "in_transit",
    "delivered",
    "exception",
    "returned",
    "cancelled",
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* back link */}
      <a
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-sky-600 hover:underline"
      >
        ← Kembali ke Orders
      </a>

      {/* ── Order header ──────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800">#{order.order_number}</h1>
            {order.customer && (
              <p className="mt-0.5 text-sm text-slate-500">
                {order.customer.name || "-"}{" "}
                {order.customer.email ? `(${order.customer.email})` : ""}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {money(order.currency, order.grand_total)}
          </span>
        </div>

        {/* 3-domain status badges */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</span>
            {paymentStatusBadge(order.payment_status)}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order</span>
            {orderStatusBadge(order.status)}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery</span>
            {deliveryStatusBadge(order.delivery_status || "pending")}
          </div>
        </div>
      </div>

      {/* ── Shipment list ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Pengiriman ({activeShipments.length})
        </h2>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          + Tambah Shipment
        </button>
      </div>

      {activeShipments.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Belum ada shipment aktif.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {activeShipments.map((s) => (
          <ShipmentCard key={s.id} shipment={s} onEdit={openEdit} />
        ))}
      </div>

      {cancelledShipments.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-400">
            {cancelledShipments.length} shipment dibatalkan
          </summary>
          <div className="mt-2 flex flex-col gap-2 opacity-60">
            {cancelledShipments.map((s) => (
              <ShipmentCard key={s.id} shipment={s} onEdit={openEdit} />
            ))}
          </div>
        </details>
      )}

      {/* ── Add shipment modal ────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="mb-4 text-base font-bold text-slate-800">Tambah Shipment</h3>

            {/* item selector */}
            {shippableItems.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pilih Item
                </p>
                <div className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2">
                  {shippableItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!selectedItemIDs[item.id]}
                        onChange={(e) =>
                          setSelectedItemIDs((prev) => ({ ...prev, [item.id]: e.target.checked }))
                        }
                      />
                      {item.product_name} (x{item.qty})
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {[
                ["Kurir", "carrier_name"],
                ["Service", "service_name"],
                ["No. Resi", "tracking_number"],
                ["Estimasi Tiba", "estimated_delivery"],
                ["Deskripsi", "description"],
                ["Catatan", "notes"],
              ].map(([label, key]) => (
                <label key={key} className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                  <input
                    value={(addForm as Record<string, string>)[key]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ))}
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Biaya Kirim
                </span>
                <input
                  type="number"
                  min="0"
                  value={addForm.shipping_amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, shipping_amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-sky-700"
              >
                {submitting ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit shipment modal ────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="mb-4 text-base font-bold text-slate-800">Edit Shipment</h3>

            <div className="flex flex-col gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {SHIPMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {[
                ["Kurir", "carrier_name"],
                ["Service", "service_name"],
                ["No. Resi", "tracking_number"],
                ["Estimasi Tiba", "estimated_delivery"],
                ["Deskripsi", "description"],
                ["Catatan", "notes"],
              ].map(([label, key]) => (
                <label key={key} className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                  <input
                    value={(editForm as Record<string, string>)[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ))}
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Biaya Kirim
                </span>
                <input
                  type="number"
                  min="0"
                  value={editForm.shipping_amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, shipping_amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-sky-700"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
