/** @jsxRuntime classic */
import React from "react";
import LargeCardCarousel from "../../LargeCardCarousel";
import type { PublicBusinessCarousel, PublicBusinessProduct } from "../types";

interface BusinessHomeTabProps {
  businessSlug: string;
  carousels: PublicBusinessCarousel[];
  featuredProducts: PublicBusinessProduct[];
  products: PublicBusinessProduct[];
  categories: string[];
}

export default function BusinessHomeTab({
  businessSlug,
  carousels,
  featuredProducts,
  products,
  categories,
}: BusinessHomeTabProps) {
  return (
    <>
      {carousels.length > 0 ? (
        <section className="mt-7 space-y-8">
          {carousels.map((carousel) => (
            <div key={carousel.id} className="space-y-4">

              <LargeCardCarousel
                items={carousel.items.map((item) => ({
                  id: item.id,
                  title: item.title,
                  subtitle: item.subtitle || undefined,
                  image: item.image || undefined,
                  href: item.href || undefined,
                }))}
                variant={carousel.layoutType === "medium" ? "medium" : "large"}
                hideArrows={carousel.items.length <= 1}
                className="-mt-2"
              />
            </div>
          ))}
        </section>
      ) : null}

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
