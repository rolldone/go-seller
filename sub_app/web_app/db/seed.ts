import { db, BusinessCarousel } from "astro:db";

export default async function seed() {
  await db.insert(BusinessCarousel).values([
    {
      id: "carousel-biz-1-hero",
      businessId: "biz-1",
      slot: "hero",
      title: "Healthy Life Promo Carousel",
      subtitle: "Konten hero untuk storefront business",
      layoutType: "large",
      isActive: true,
      sortOrder: 1,
      items: [
        { id: "hero-1", title: "Promo Mingguan", subtitle: "Diskon terbatas untuk pelanggan baru", image: "", href: "" },
        { id: "hero-2", title: "Best Seller", subtitle: "Produk paling sering dibeli", image: "", href: "" },
      ],
    },
    {
      id: "carousel-biz-2-featured",
      businessId: "biz-2",
      slot: "featured",
      title: "Featured Carousel",
      subtitle: "Contoh section tambahan per business",
      layoutType: "medium",
      isActive: true,
      sortOrder: 1,
      items: [{ id: "featured-1", title: "Launch Blueprint", subtitle: "Start from zero faster", image: "", href: "" }],
    },
  ]);
}