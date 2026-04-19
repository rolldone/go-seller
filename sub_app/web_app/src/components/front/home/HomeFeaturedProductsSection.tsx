import HomeGroupedCarousel from "./HomeGroupedCarousel";
import { highlightedProducts } from "./homeData";
import HomeProductCard from "./HomeProductCard";

export default function HomeFeaturedProductsSection() {
  return (
    <HomeGroupedCarousel
      title="Produk Utama"
      subtitle="Pilihan terlaris dari berbagai toko."
      items={highlightedProducts}
      groupSize={4}
      prevLabel="Produk utama sebelumnya"
      nextLabel="Produk utama berikutnya"
      renderGroup={(group) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {group.map((product) => (
            <HomeProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    />
  );
}
