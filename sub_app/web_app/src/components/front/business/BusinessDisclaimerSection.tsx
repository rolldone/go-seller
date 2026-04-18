/** @jsxRuntime classic */
import React, { useMemo, useState } from "react";
import { ShieldCheck, Truck, Store, Info, ChevronRight } from "lucide-react";
import type { PublicBusinessDisclaimer } from "./types";
import { useTranslations } from "../../../i18n";
import PublicModal from "../ui/PublicModal";

type Props = {
  businessName: string;
  locale?: string;
  disclaimers?: PublicBusinessDisclaimer[] | null;
};

function resolveDisclaimerIcon(iconKey?: string | null) {
  const normalized = String(iconKey || "").toLowerCase();
  if (normalized.includes("truck") || normalized.includes("ship") || normalized.includes("delivery")) {
    return Truck;
  }
  if (normalized.includes("store") || normalized.includes("shop") || normalized.includes("merchant")) {
    return Store;
  }
  if (normalized.includes("info") || normalized.includes("note") || normalized.includes("message")) {
    return Info;
  }
  return ShieldCheck;
}

function stripHtml(value: string): string {
  if (typeof window === "undefined") {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const el = document.createElement("div");
  el.innerHTML = value;
  return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
}

export default function BusinessDisclaimerSection({ businessName, locale, disclaimers }: Props) {
  const t = useTranslations("business", locale);
  const [activeDisclaimer, setActiveDisclaimer] = useState<PublicBusinessDisclaimer | null>(null);

  const items = useMemo(() => {
    const rows = Array.isArray(disclaimers) ? disclaimers : [];
    return [...rows]
      .filter((item) => item && item.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }, [disclaimers]);

  

  const closeModal = () => setActiveDisclaimer(null);

  return (
    <>
      {items.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t("disclaimer", "Disclaimer")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("disclaimerHint", "Klik item untuk melihat detail.")}</p>
            </div>
          </div>

          <div className="grid gap-2">
            {items.map((disclaimer) => {
              const Icon = resolveDisclaimerIcon(disclaimer.icon_key);

              return (
                <button
                  key={disclaimer.id}
                  type="button"
                  onClick={() => setActiveDisclaimer(disclaimer)}
                  className="group rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{disclaimer.title || t("untitled", "(Tanpa judul)")}</p>
                      </div>
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 transition group-hover:translate-x-0.5">
                      {t("detail", "Detail")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> {t("defaultWarrantyDisclaimer", "Garansi 7 hari untuk produk digital.")}</p>
          <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-600" /> {t("defaultDeliveryDisclaimer", "Akses otomatis dalam hitungan menit.")}</p>
          <p className="flex items-center gap-2"><Store className="h-4 w-4 text-emerald-600" /> {t("defaultSoldByDisclaimer", "Dijual oleh")} {businessName}.</p>
        </div>
      )}

      {activeDisclaimer ? (
        <PublicModal
          open={true}
          title={
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t("disclaimerDetail", "Disclaimer Detail")}</p>
              <h4 className="mt-1 text-lg font-bold text-slate-900">{activeDisclaimer.title || t("importantInfo", "Informasi Penting")}</h4>
            </>
          }
          onClose={closeModal}
          maxWidth="xl"
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {t("close", "Tutup")}
              </button>
            </div>
          }
        >
          {String(activeDisclaimer.content_html || "").trim() ? (
            <div className="text-sm leading-relaxed text-slate-700 [&_a]:text-emerald-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: String(activeDisclaimer.content_html || "") }} />
          ) : String(activeDisclaimer.content_plain || "").trim() ? (
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{activeDisclaimer.content_plain}</div>
          ) : null}

          <div className="mt-4" />
        </PublicModal>
      ) : null}
    </>
  );
}
