import React, { useState } from "react";

type Props = {
  shippingQuote?: Record<string, any> | null;
  fallbackAmount?: number;
  currency?: string;
  className?: string;
};

function toCurrency(value: number, currency = "IDR"): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(value)));
  } catch {
    return String(value);
  }
}

function trackingUrlForCarrier(carrier: string | undefined, trackingNumber: string): string | null {
  if (!trackingNumber) return null;
  const tn = encodeURIComponent(trackingNumber.trim());
  const c = String(carrier || "").toLowerCase();
  if (c.includes("jne")) return `https://www.jne.co.id/id/tracking/trace?waybill=${tn}`;
  if (c.includes("sicepat") || c.includes("si cepat")) return `https://www.sicepat.com/tracking?resi=${tn}`;
  if (c.includes("j&t") || c.includes("jnt")) return `https://www.jtexpress.id/track?awb=${tn}`;
  if (c.includes("tiki")) return `https://www.tiki.id/tracking?resi=${tn}`;
  if (c.includes("ninja") || c.includes("ninjaxpress")) return `https://www.ninjaxpress.co/id/track?waybill=${tn}`;
  if (c.includes("anteraja")) return `https://anteraja.id/cek-resi?resi=${tn}`;
  if (c.includes("pos") || c.includes("posindonesia") || c.includes("pos indonesia")) return `https://www.posindonesia.co.id/en/tracking?waybill=${tn}`;
  return `https://www.google.com/search?q=${encodeURIComponent(((carrier || "") + " " + trackingNumber).trim())}`;
}

export default function CourierCard({ shippingQuote, fallbackAmount = 0, currency = "IDR", className = "" }: Props) {
  if (!shippingQuote) return null;

  const ready = Boolean(shippingQuote.ready);
  const carrier = shippingQuote.carrier_name || shippingQuote.carrier || "";
  const service = shippingQuote.service_name || shippingQuote.service || "";
  const trackingNumber = shippingQuote.tracking_number || shippingQuote.trackingNumber || "";
  const eta = shippingQuote.estimated_delivery || shippingQuote.estimatedDelivery || "";
  const description = shippingQuote.description || "";
  const notes = shippingQuote.notes || "";
  const amount = typeof shippingQuote.shipping_amount === "number"
    ? shippingQuote.shipping_amount
    : typeof shippingQuote.amount === "number"
    ? shippingQuote.amount
    : Number(shippingQuote.shippingAmount || fallbackAmount || 0);

  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!trackingNumber) return;
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const trackUrl = trackingUrlForCarrier(carrier, trackingNumber || "");

  let updatedAtText = "";
  try {
    const raw = shippingQuote.updated_at || shippingQuote.updatedAt || shippingQuote.updated || null;
    if (raw) {
      const d = new Date(String(raw));
      if (!Number.isNaN(d.getTime())) {
        updatedAtText = d.toLocaleString();
      }
    }
  } catch {
    updatedAtText = "";
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kurir</div>
          <div className="mt-1 font-semibold text-slate-900">{carrier || "Kurir belum ditentukan"}</div>
          {service ? <div className="text-xs text-slate-500">{service}</div> : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {ready ? "Ready" : "Pending"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <div className="text-xs text-slate-500">Ongkir</div>
          <div className="mt-0.5 font-medium text-slate-900">{toCurrency(Number(amount || 0), currency)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">ETA</div>
          <div className="mt-0.5 font-medium text-slate-900">{eta || "-"}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Resi</div>
              <div className="mt-0.5 font-medium text-slate-900 break-words">{trackingNumber || "-"}</div>
            </div>
            <div className="flex items-center gap-2">
              {trackingNumber ? (
                <>
                  <button type="button" onClick={onCopy} className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                  {trackUrl ? (
                    <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
                      Lacak
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {description ? <div className="mt-3 text-sm text-slate-700">{description}</div> : null}
      {notes ? <div className="mt-2 text-xs text-slate-500">Catatan: {notes}</div> : null}
      {updatedAtText ? <div className="mt-3 text-xs text-slate-400">Terakhir diperbarui: {updatedAtText}</div> : null}
    </div>
  );
}
