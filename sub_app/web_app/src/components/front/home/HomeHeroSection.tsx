import { Sparkles } from "lucide-react";
import type { CustomerSession } from "../../../lib/customerSession";
import { buildLocalizedPath } from "../../../lib/siteLocale";

interface HomeHeroSectionProps {
  locale?: string;
  customerSession?: CustomerSession | null;
}

export default function HomeHeroSection({ locale, customerSession = null }: HomeHeroSectionProps) {
  const customerHref = buildLocalizedPath(customerSession?.authenticated ? "/customer/dashboard" : "/customer/auth/login", locale);
  const memberHref = buildLocalizedPath("/member/auth/login", locale);

  return (
    <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:grid-cols-[1.15fr_1fr] md:px-10 md:py-10">
      <div>
        <h1 className="max-w-xl text-3xl font-bold leading-tight text-slate-900 md:text-5xl">Temukan produk terbaik dari toko terpercaya</h1>
        <p className="mt-4 max-w-lg text-sm text-slate-600 md:text-base">Jelajahi berbagai produk pilihan dari partner terpercaya kami.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href={customerHref}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {customerSession?.authenticated ? "Masuk ke Customer" : "Masuk sebagai Customer"}
          </a>
          <a
            href={memberHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Masuk sebagai Member
          </a>
          <a href={buildLocalizedPath("/products", locale)} className="inline-flex items-center justify-center rounded-xl px-2 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Cari Produk dulu
          </a>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <div className="rounded-[2rem] bg-gradient-to-br from-emerald-100 via-emerald-50 to-slate-100 p-8">
          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-[2rem] border border-emerald-200 bg-white/80">
            <div className="text-center">
              <Sparkles className="mx-auto h-12 w-12 text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Smart Shopping</p>
              <p className="text-xs text-slate-500">Partner pilihan terpercaya</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-3 left-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">Rp15,000</div>
        <div className="absolute -right-1 top-8 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">Rp120,000</div>
        <div className="absolute bottom-8 right-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">Rp300,000</div>
      </div>
    </section>
  );
}
