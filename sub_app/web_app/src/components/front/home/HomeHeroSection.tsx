import { Sparkles } from "lucide-react";
import { buildLocalizedPath } from "../../../lib/siteLocale";

interface HomeHeroSectionProps {
  locale?: string;
}

export default function HomeHeroSection({ locale }: HomeHeroSectionProps) {
  return (
    <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:grid-cols-[1.15fr_1fr] md:px-10 md:py-10">
      <div>
        <h1 className="max-w-xl text-3xl font-bold leading-tight text-slate-900 md:text-5xl">Temukan produk terbaik dari toko terpercaya</h1>
        <p className="mt-4 max-w-lg text-sm text-slate-600 md:text-base">Jelajahi berbagai produk pilihan dari partner terpercaya kami.</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href={buildLocalizedPath("/products", locale)} className="inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">Cari Produk</a>
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
