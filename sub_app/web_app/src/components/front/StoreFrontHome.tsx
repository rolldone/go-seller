import BusinessPageNav from "./business/BusinessPageNav";
import Footer from "./Footer";
import type { CartBusinessSummary } from "../../lib/cartApi";
import type { CustomerSession } from "../../lib/customerSession";
import HomeHeroSection from "./home/HomeHeroSection";
import HomeFeaturedStoresSection from "./home/HomeFeaturedStoresSection";
import HomeFeaturedProductsSection from "./home/HomeFeaturedProductsSection";
import HomeCategoryProductsSection from "./home/HomeCategoryProductsSection";

interface StoreFrontHomeProps {
  customerSession?: CustomerSession | null;
  locale?: string;
  initialBusinesses?: CartBusinessSummary[];
}

export default function StoreFrontHome({ customerSession = null, locale, initialBusinesses = [] }: StoreFrontHomeProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f7f5]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <BusinessPageNav business={null} customerSession={customerSession} locale={locale} initialBusinesses={initialBusinesses} />

        <main className="mt-8 flex-1 space-y-10 pb-8">
          <HomeHeroSection locale={locale} customerSession={customerSession} />
          <HomeFeaturedStoresSection />
          <HomeFeaturedProductsSection />
          <HomeCategoryProductsSection />
        </main>
      </div>

      <Footer />
    </div>
  );
}
