import { useMemo, useState } from "react";
import { categories, categoryProducts } from "./homeData";
import HomeProductCard from "./HomeProductCard";

export default function HomeCategoryProductsSection() {
  const [activeCategoryID, setActiveCategoryID] = useState(categories[0]?.id || "");

  const filteredProducts = useMemo(
    () => categoryProducts.filter((product) => product.categoryId === activeCategoryID),
    [activeCategoryID],
  );

  return (
    <section>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">Pilih Kategori</h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const Icon = category.icon;
          const active = category.id === activeCategoryID;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategoryID(category.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xl font-semibold text-slate-900">{category.name}</span>
                <span className="block text-xs text-slate-500">{category.count}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 transition-opacity duration-300" key={activeCategoryID}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <HomeProductCard key={product.id} product={product} compactTitle />
          ))}
        </div>
      </div>

      <div className="mt-6 text-center">
        <a href="#" className="inline-flex rounded-lg bg-emerald-600 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
          Lihat Semua Produk
        </a>
      </div>
    </section>
  );
}
