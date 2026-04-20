import { Mail, MapPin, Phone } from "lucide-react";
import { buildLocalizedPath } from "../../../lib/siteLocale";
import { useTranslations } from "../../../i18n";
import type { StoreContactInfo } from "../../../lib/storeContact";

interface ContactPageProps {
  locale?: string;
  contact: StoreContactInfo;
}

function normalizePhoneHref(value: string): string {
  const compact = value.replace(/[^+\d]/g, "");
  return compact ? `tel:${compact}` : "#";
}

export default function ContactPage({ locale, contact }: ContactPageProps) {
  const t = useTranslations("common", locale);
  const storeName = contact.storeName || t("goSeller", "GoSeller");
  const address = contact.address || t("companyAddress", "Jl. Teknologi No. 42, Jakarta Selatan, Indonesia");
  const phone = contact.phone || t("companyPhone", "+62 21 1234 5678");
  const email = contact.email || t("supportEmail", "support@goseller.com");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_24px_80px_-40px_rgba(16,185,129,0.45)]">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_38%),linear-gradient(135deg,_#f6fff9_0%,_#ecfdf5_48%,_#ffffff_100%)] px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              {t("contactPageEyebrow", "Kontak")}
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              {t("contactPageTitle", "Butuh bantuan atau ingin bicara langsung?")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {t(
                "contactPageDescription",
                "Semua informasi kontak storefront ditarik dari setting supaya alamat, telepon, dan email selalu konsisten di seluruh halaman."
              )}
            </p>

            <div className="mt-10 rounded-3xl border border-white/80 bg-white/80 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("contactPageStoreLabel", "Store")}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{storeName}</p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
                {t(
                  "contactPageResponseNote",
                  "Gunakan halaman ini sebagai pusat kontak resmi. Saat setting diubah dari admin, informasi di sini ikut berubah tanpa edit manual di frontend."
                )}
              </p>
            </div>
          </div>

          <div className="px-6 py-10 sm:px-10 sm:py-14">
            <div className="space-y-4">
              <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("addressLabel", "Alamat")}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-base leading-7 text-slate-700">{address}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("phoneLabel", "Nomor Telepon")}
                    </p>
                    <a href={normalizePhoneHref(phone)} className="mt-2 inline-flex text-base font-medium text-slate-700 transition hover:text-emerald-600">
                      {phone}
                    </a>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("emailLabel", "Email")}
                    </p>
                    <a href={`mailto:${email}`} className="mt-2 inline-flex text-base font-medium text-slate-700 transition hover:text-emerald-600">
                      {email}
                    </a>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={buildLocalizedPath("/products", locale)}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                {t("allProducts", "Semua Produk")}
              </a>
              <a
                href={buildLocalizedPath("/", locale)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                {t("contactPageBackHome", "Kembali ke Beranda")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}