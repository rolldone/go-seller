import { useEffect, useState } from 'react';
import { ShoppingBag, Mail, Phone, MapPin } from 'lucide-react';
import { buildLocalizedPath, getLocaleFromPathname } from "../../lib/siteLocale";
import { useTranslations } from "../../i18n";
import { fetchStoreContactInfo, type StoreContactInfo } from "../../lib/storeContact";

interface FooterProps {
  locale?: string;
}

const Footer = ({ locale }: FooterProps) => {
  const currentYear = new Date().getFullYear();
  const resolvedLocale = locale || (typeof window !== "undefined" ? getLocaleFromPathname(window.location.pathname) : undefined);
  const t = useTranslations("common", resolvedLocale);
  const fallbackContact: StoreContactInfo = {
    storeName: t("goSeller", "GoSeller"),
    address: t("companyAddress", "Jl. Teknologi No. 42, Jakarta Selatan, Indonesia"),
    phone: t("companyPhone", "+62 21 1234 5678"),
    email: t("supportEmail", "support@goseller.com"),
  };
  const [contact, setContact] = useState<StoreContactInfo>(fallbackContact);

  useEffect(() => {
    setContact((current) => ({
      storeName: current.storeName || fallbackContact.storeName,
      address: current.address || fallbackContact.address,
      phone: current.phone || fallbackContact.phone,
      email: current.email || fallbackContact.email,
    }));
  }, [fallbackContact.address, fallbackContact.email, fallbackContact.phone, fallbackContact.storeName]);

  useEffect(() => {
    let cancelled = false;

    async function loadContact() {
      try {
        const next = await fetchStoreContactInfo();
        if (cancelled) return;
        setContact({
          storeName: next.storeName || fallbackContact.storeName,
          address: next.address || fallbackContact.address,
          phone: next.phone || fallbackContact.phone,
          email: next.email || fallbackContact.email,
        });
      } catch {
        if (cancelled) return;
        setContact((current) => ({
          storeName: current.storeName || fallbackContact.storeName,
          address: current.address || fallbackContact.address,
          phone: current.phone || fallbackContact.phone,
          email: current.email || fallbackContact.email,
        }));
      }
    }

    void loadContact();

    return () => {
      cancelled = true;
    };
  }, [fallbackContact.address, fallbackContact.email, fallbackContact.phone, fallbackContact.storeName]);

  const contactHref = buildLocalizedPath("/contact", resolvedLocale);
  const productsHref = buildLocalizedPath("/products", resolvedLocale);
  const storesHref = buildLocalizedPath("/b", resolvedLocale);
  const termsHref = buildLocalizedPath("/terms", resolvedLocale);
  const privacyHref = buildLocalizedPath("/privacy", resolvedLocale);
  const phoneHref = `tel:${contact.phone.replace(/[^+\d]/g, "")}`;
  const emailHref = `mailto:${contact.email}`;

  return (
    <footer className="bg-white border-t border-slate-200 pt-16 pb-8 mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {t("goSeller", "GoSeller")}
              </span>
            </div>
            <p className="text-slate-500 leading-relaxed max-w-xs">
              {t(
                "footerDescription",
                "Platform terbaik untuk menemukan produk berkualitas dari ribuan bisnis terpercaya di seluruh Indonesia."
              )}
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                aria-label={t("socialLink1", "Social link 1")}
              >
                <span className="text-sm font-semibold">{t("socialIconFacebook", "f")}</span>
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                aria-label={t("socialLink2", "Social link 2")}
              >
                <span className="text-sm font-semibold">{t("socialIconInstagram", "ig")}</span>
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                aria-label={t("socialLink3", "Social link 3")}
              >
                <span className="text-sm font-semibold">{t("socialIconX", "x")}</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">{t("shopTitle", "Belanja")}</h3>
            <ul className="space-y-3">
              <li>
                <a href={productsHref} className="text-slate-500 hover:text-emerald-600 transition-colors">{t("allProducts", "Semua Produk")}</a>
              </li>
              <li>
                <a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">{t("popularCategories", "Kategori Populer")}</a>
              </li>
              <li>
                <a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">{t("specialPromos", "Promo Spesial")}</a>
              </li>
              <li>
                <a href={storesHref} className="text-slate-500 hover:text-emerald-600 transition-colors">{t("verifiedBusinesses", "Toko Terverifikasi")}</a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">{t("support", "Bantuan")}</h3>
            <ul className="space-y-3">
              <li>
                <a href={contactHref} className="text-slate-500 hover:text-emerald-600 transition-colors">{t("helpCenter", "Pusat Bantuan")}</a>
              </li>
              <li>
                <a href={termsHref} className="text-slate-500 hover:text-emerald-600 transition-colors">{t("terms", "Syarat & Ketentuan")}</a>
              </li>
              <li>
                <a href={privacyHref} className="text-slate-500 hover:text-emerald-600 transition-colors">{t("privacyPolicy", "Kebijakan Privasi")}</a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">
              <a href={contactHref} className="transition hover:text-emerald-600">{t("contactUs", "Kontak Kami")}</a>
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-500">{contact.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                <a href={phoneHref} className="text-slate-500 transition hover:text-emerald-600">{contact.phone}</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-emerald-600 shrink-0" />
                <a href={emailHref} className="text-slate-500 transition hover:text-emerald-600">{contact.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            {t("copyrightSymbol", "©")} {currentYear} {t("goSeller", "GoSeller")}. {t("allRightsReserved", "All rights reserved.")}
          </p>
          <div className="flex items-center gap-6">
             <img
               src="/payment-methods.svg"
               alt={t("paymentMethodsTitle", "Payment Methods")}
               className="h-6 opacity-50 grayscale hover:grayscale-0 transition-all cursor-help"
               title={t("paymentMethodsList", "Visa, Mastercard, Bank Transfer, E-Wallet")}
               loading="lazy"
               decoding="async"
             />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
