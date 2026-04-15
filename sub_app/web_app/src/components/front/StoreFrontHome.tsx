import { useRef } from "react";
import HeroBranding from "./HeroBranding";
import HeroIntro from "./HeroIntro";
import AuthCard from "./AuthCard";
import HomeNav from "./HomeNav";
import CategoryStrip from "./CategoryStrip";
import ProductGrid from "./ProductGrid";
import LargeCardCarousel, { type CarouselHandle } from "./LargeCardCarousel";
import HeroChatComposer from "./HeroChatComposer";
import SectionGroup from "./SectionGroup";
import CarouselNav from "./CarouselNav";
import Footer from "./Footer";
import type { CustomerSession } from "../../lib/customerSession";
import { useTranslations } from "../../i18n";

const categoryItems = [
  "Templates",
  "Courses",
  "Guides",
  "Tools",
  "Membership",
  "Services",
];

const featuredProducts = [
  {
    id: "prod-1",
    name: "Growth OS Starter",
    category: "Templates",
    price: "$39",
    description: "Plug-and-play system for content pipeline and KPI dashboard.",
  },
  {
    id: "prod-2",
    name: "Mini SEO Sprint",
    category: "Services",
    price: "$129",
    description: "7-day optimization checklist with concrete implementation tasks.",
  },
  {
    id: "prod-3",
    name: "Launch Copy Bundle",
    category: "Guides",
    price: "$24",
    description: "High-converting copy prompts and headline frameworks for launch week.",
  },
  {
    id: "prod-4",
    name: "Creator CRM Lite",
    category: "Tools",
    price: "$59",
    description: "Simple CRM setup for tracking leads and buyer follow-ups.",
  },
];

const gettingStarted = [
  { id: "gs-1", title: "Clipping", subtitle: "Get paid to create content for top brands", image: "" },
  { id: "gs-2", title: "Whop University", subtitle: "Learn how to build and grow on Whop", image: "" },
];

const verifiedBusinesses = Array.from({ length: 8 }).map((_, i) => ({
  id: `vb-${i}`,
  title: `Business ${i + 1}`,
  subtitle: `Top creator ${i + 1}`,
  image: "",
}));

interface StoreFrontHomeProps {
  customerSession?: CustomerSession | null;
  locale?: string;
}

export default function StoreFrontHome({ customerSession = null, locale }: StoreFrontHomeProps) {
  const gsRef = useRef<CarouselHandle>(null);
  const vbRef = useRef<CarouselHandle>(null);
  const t = useTranslations("common", locale);
  const totalEarned = 2863128438;
  const totalUsers = 19548229;
  const totalBusinesses = 2510523;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f7f5]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <HomeNav variant="light" customerSession={customerSession} locale={locale} />

        <main className="mt-8 flex-1">
          <SectionGroup
            title="Section 1"
            subtitle="Hero + Auth"
            contentClassName="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_360px] md:p-8 lg:p-10"
          >
            <section>
              <HeroIntro locale={locale} />
            </section>
            <AuthCard locale={locale} />
          </SectionGroup>

          <SectionGroup
            title="Section 2"
            subtitle="Discovery Chat"
            contentClassName="rounded-3xl border border-slate-200 bg-white px-5 py-10 shadow-sm md:px-8 lg:px-10"
          >
            <section>
              <HeroBranding locale={locale} />
              <HeroChatComposer locale={locale} />
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500 sm:text-base">
                <span className="font-semibold text-slate-800">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalEarned)} {t("earned", "earned")}</span>
                <span>·</span>
                <span>{new Intl.NumberFormat("en-US").format(totalUsers)} {t("users", "users")}</span>
                <span>·</span>
                <span>{new Intl.NumberFormat("en-US").format(totalBusinesses)} {t("businesses", "businesses")}</span>
              </div>
            </section>
          </SectionGroup>

          <SectionGroup title={t("popularCategories", "Popular Categories")}>
            <CategoryStrip items={categoryItems} />
          </SectionGroup>

          <SectionGroup 
            title={t("gettingStarted", "Getting started")}
            action={<CarouselNav onPrev={() => gsRef.current?.scroll(-1)} onNext={() => gsRef.current?.scroll(1)} />}
          >
            <LargeCardCarousel ref={gsRef} items={gettingStarted} variant="large" hideArrows />
          </SectionGroup>

          <SectionGroup
            title={t("verifiedBusinesses", "Verified businesses")}
            subtitle={t("topCreatorsAndBrands", "Top creators and brands")}
            action={
              <div className="flex items-center gap-4">
                <a href="#" className="hidden text-sm font-semibold text-slate-600 transition hover:text-emerald-600 sm:block">{t("seeMore", "See more")}</a>
                <CarouselNav onPrev={() => vbRef.current?.scroll(-1)} onNext={() => vbRef.current?.scroll(1)} />
              </div>
            }
          >
            <LargeCardCarousel ref={vbRef} items={verifiedBusinesses} variant="medium" hideArrows />
          </SectionGroup>

          <SectionGroup
            title={t("trendingProducts", "Trending Products")}
            action={<a href="#" className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-500">{t("viewAll", "View all")}</a>}
          >
            <ProductGrid items={featuredProducts} />
          </SectionGroup>
        </main>
      </div>

      <Footer />
    </div>
  );
}
