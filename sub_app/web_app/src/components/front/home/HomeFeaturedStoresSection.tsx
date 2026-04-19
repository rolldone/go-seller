import { Leaf, Sparkles, Stethoscope } from "lucide-react";
import HomeGroupedCarousel from "./HomeGroupedCarousel";
import { featuredStores } from "./homeData";

const storeIcons = [Leaf, Stethoscope, Sparkles] as const;
const iconColors = ["text-emerald-600", "text-slate-700", "text-pink-500"] as const;

export default function HomeFeaturedStoresSection() {
  return (
    <HomeGroupedCarousel
      title="Toko Pilihan"
      subtitle="Jelajahi toko-toko berkualitas yang sudah dikurasi oleh tim kami."
      items={featuredStores}
      groupSize={3}
      prevLabel="Toko sebelumnya"
      nextLabel="Toko berikutnya"
      renderGroup={(group, groupIndex) => (
        <div className="grid gap-4 md:grid-cols-3">
          {group.map((store, itemIdx) => {
            const iconIdx = (groupIndex * group.length + itemIdx) % storeIcons.length;
            const Icon = storeIcons[iconIdx] || Leaf;
            const color = iconColors[iconIdx] || "text-emerald-600";
            return (
              <article key={store.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <h3 className="text-2xl font-bold text-slate-900">{store.name}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500">{store.subtitle}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">{store.products}</span>
                  <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-400">{store.code}</span>
                </div>
                <button type="button" className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  Lihat Toko
                </button>
              </article>
            );
          })}
        </div>
      )}
    />
  );
}
