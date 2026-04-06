/** @jsxRuntime classic */
import React from "react";
import type { PublicBusiness } from "../types";

interface BusinessAboutTabProps {
  business: PublicBusiness;
}

export default function BusinessAboutTab({ business }: BusinessAboutTabProps) {
  const ownerName = business.owner_name ?? "-";
  const ownerRole = business.owner_role ?? "-";
  const establishedYear = business.founded_year ?? "-";
  const fullAddress = business.address ?? "-";
  const operatingHours = business.operational_hours ?? "-";
  const responseTime = business.chat_response_time ?? "-";
  const contactEmail = business.email ?? "-";
  const contactPhone = business.phone ?? "-";
  const descriptionLong = business.description ?? business.short_description ?? "";
  const descriptionHTML = business.description_html ?? null;

  const renderOperational = (op: any) => {
    if (!op) return "-";
    if (typeof op === "string") return op;
    try {
      return JSON.stringify(op, null, 2);
    } catch (e) {
      return String(op);
    }
  };

  const canShowEmail = business.show_contact_email ?? true;
  const canShowPhone = business.show_phone ?? true;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Profil Toko</h2>
        {descriptionHTML ? (
          <div className="mt-3 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: descriptionHTML }} />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{descriptionLong}</p>
        )}
       
      </section>

      <aside className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Informasi Lengkap</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Alamat:</span> {fullAddress}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Pemilik:</span> {ownerName}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Peran:</span> {ownerRole}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Didirikan Tahun:</span> {establishedYear}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Jam Operasional:</span> {renderOperational(operatingHours)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Respon Chat:</span> {responseTime}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Email:</span>{' '}
              {!canShowEmail || !contactEmail || contactEmail === '-' ? (
                '-'
              ) : (
                <a className="text-emerald-600 hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
              )}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Telepon:</span>{' '}
              {!canShowPhone || !contactPhone || contactPhone === '-' ? (
                '-'
              ) : (
                <a className="text-emerald-600 hover:underline" href={`tel:${contactPhone}`}>{contactPhone}</a>
              )}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
