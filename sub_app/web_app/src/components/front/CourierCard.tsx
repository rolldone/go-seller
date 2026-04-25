import React from "react";
import { useTranslations } from "../../i18n";
import { formatAmount } from "../../lib/amountFormat";

type Props = {
  shippingQuote?: Record<string, any> | null;
  fallbackAmount?: number;
  currency?: string;
  className?: string;
};

function toCurrency(value: number, currency = "IDR"): string {
  try {
    const formatted = formatAmount(Math.max(0, Math.round(value)), { fractionDigits: 0 });
    return currency ? `${currency} ${formatted}` : formatted;
  } catch {
    return String(value);
  }
}

export default function CourierCard({ shippingQuote, fallbackAmount = 0, currency = "IDR", className = "" }: Props) {
  if (!shippingQuote) return null;

  const t = useTranslations();

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
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("courierLabel", "Kurir")}</div>
          <div className="mt-1 font-semibold text-slate-900">{carrier || t("courierNotAssigned", "Kurir belum ditentukan")}</div>
          {service ? <div className="text-xs text-slate-500">{service}</div> : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {ready ? t("ready", "Ready") : t("pending", "Pending")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <div className="text-xs text-slate-500">{t("shippingCost", "Ongkir")}</div>
          <div className="mt-0.5 font-medium text-slate-900">{toCurrency(Number(amount || 0), currency)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t("eta", "ETA")}</div>
          <div className="mt-0.5 font-medium text-slate-900">{eta || "-"}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
              <div>
              <div className="text-xs text-slate-500">{t("trackingNumberLabel", "Resi")}</div>
              <div className="mt-0.5 font-medium text-slate-900 break-words">{trackingNumber || "-"}</div>
            </div>
          </div>
        </div>
      </div>

      {description ? <div className="mt-3 text-sm text-slate-700">{description}</div> : null}
      {notes ? <div className="mt-2 text-xs text-slate-500">{t("notesPrefix", "Catatan:")} {notes}</div> : null}
      {updatedAtText ? <div className="mt-3 text-xs text-slate-400">{t("lastUpdated", "Terakhir diperbarui:")} {updatedAtText}</div> : null}
    </div>
  );
}
