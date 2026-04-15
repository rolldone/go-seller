/** @jsxRuntime classic */
import React from "react";
import type { PublicBusiness } from "../types";
import { useTranslations } from "../../../../i18n";

interface BusinessAboutTabProps {
  business: PublicBusiness;
  locale?: string;
}

export default function BusinessAboutTab({ business, locale }: BusinessAboutTabProps) {
  const t = useTranslations("business", locale);
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
        <h2 className="text-lg font-bold text-slate-900">{t("profileStore", "Profil Toko")}</h2>
        {descriptionHTML ? (
          <div className="mt-3 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: descriptionHTML }} />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{descriptionLong}</p>
        )}
       
      </section>

      <aside className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">{t("fullInfo", "Informasi Lengkap")}</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">{t("addressLabel", "Alamat:")}</span> {fullAddress}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("ownerLabel", "Pemilik:")}</span> {ownerName}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("roleLabel", "Peran:")}</span> {ownerRole}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("foundedYearLabel", "Didirikan Tahun:")}</span> {establishedYear}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("operatingHoursLabel", "Jam Operasional:")}</span> {renderOperational(operatingHours)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("chatResponseLabel", "Respon Chat:")}</span> {responseTime}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("emailLabel", "Email:")}</span>{' '}
              {!canShowEmail || !contactEmail || contactEmail === '-' ? (
                '-'
              ) : (
                <a className="text-emerald-600 hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
              )}
            </p>
            <p>
              <span className="font-semibold text-slate-900">{t("phoneLabel", "Telepon:")}</span>{' '}
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
