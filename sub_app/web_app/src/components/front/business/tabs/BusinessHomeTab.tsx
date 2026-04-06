/** @jsxRuntime classic */
import React from "react";
import type { PublicBusinessProduct } from "../types";

interface BusinessHomeTabProps {
  businessSlug: string;
  businessName: string;
  featuredProducts: PublicBusinessProduct[];
  products: PublicBusinessProduct[];
  categories: string[];
}

export default function BusinessHomeTab({
  businessSlug,
  businessName,
  featuredProducts,
  products,
  categories,
}: BusinessHomeTabProps) {
  return (
    <>
      <section className="mt-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-white shadow-lg">
          <div className="relative z-10 flex h-[240px] flex-col justify-center sm:h-[300px]">
            <span className="mb-2 inline-block w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Special Offer
            </span>
            <h2 className="max-w-md text-3xl font-extrabold sm:text-5xl">
              Dapatkan Promo <br /> Terbatas Hari Ini!
            </h2>
            <p className="mt-4 max-w-sm text-lg text-emerald-50/90">
              Belanja produk pilihan dari {businessName} dengan diskon hingga 50% hanya untuk minggu ini.
            </p>
            <div className="mt-8 flex gap-3">
              <button className="rounded-xl bg-white px-6 py-3 font-bold text-emerald-600 shadow-sm hover:bg-emerald-50">
                Lihat Promo
              </button>
              <div className="flex items-center gap-2 px-2">
                <div className="h-2 w-8 rounded-full bg-white"></div>
                <div className="h-2 w-2 rounded-full bg-white/40"></div>
                <div className="h-2 w-2 rounded-full bg-white/40"></div>
              </div>
            </div>
          </div>

          <div className="absolute right-[-50px] top-[-50px] h-[300px] w-[300px] rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-[-100px] right-20 h-[300px] w-[300px] rounded-full bg-teal-400/20 blur-2xl"></div>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[30px] font-bold tracking-tight text-slate-900">Populer</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {featuredProducts.map((product) => (
            <a 
              key={product.id} 
              href={`/b/${businessSlug}/p/${product.slug}`}
              className="group block rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-emerald-500 hover:shadow-md"
            >
              <div className="aspect-[4/5] rounded-lg bg-gradient-to-br from-slate-100 to-slate-200" />
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-emerald-600">{product.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{product.excerpt}</p>
              <p className="mt-2 text-lg font-bold text-rose-500">{product.price}</p>
              <button className="mt-2 w-full rounded-lg border border-emerald-400 py-1.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 focus:outline-none">
                Detail Produk
              </button>
            </a>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button className="rounded-full border border-slate-300 bg-white px-8 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-600">
            Lihat Semua Populer
          </button>
        </div>
      </section>

      {categories.map((catName) => (
        <section key={catName} className="mt-8">
          <h2 className="text-[30px] font-bold tracking-tight text-slate-900">{catName}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {products
              .filter((p) => p.category === catName)
              .slice(0, 6)
              .map((product, idx) => (
                <a
                  key={`${product.id}-${idx}`}
                  href={`/b/${businessSlug}/p/${product.slug}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-emerald-500 hover:shadow-md"
                >
                  <div className="aspect-[4/5] rounded-lg bg-gradient-to-br from-slate-100 to-slate-200" />
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-emerald-600">
                    {product.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{product.category}</p>
                  <p className="mt-2 text-lg font-bold text-rose-500">{product.price}</p>
                  <div className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-emerald-400 py-1.5 text-sm font-semibold text-emerald-600 group-hover:bg-emerald-50">
                    Detail Produk
                  </div>
                </a>
              ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button className="rounded-full border border-slate-300 bg-white px-8 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-600">
              Lihat Produk {catName} Lainnya
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
