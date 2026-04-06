import type { PublicBusinessStore } from "./types";

const STORES: Record<string, PublicBusinessStore> = {
  "bravo-six": {
    business: {
      id: "biz-1",
      name: "Bravo Six",
      slug: "bravo-six",
      city: "Jakarta Barat",
      description: "Sports betting tools and premium analysis for daily decision making.",
      headline: "Elite betting insights for consistent outcomes.",
      logoText: "BS",
      isVerified: true,
      rating: "4.8",
      reviewCount: "7,456",
      soldLabel: "141K sold",
      followers: "129K",
      soldCount: "42K",
    },
    products: [
      // Membership Category
      { id: "p-1", title: "Daily Picks Pro", slug: "daily-picks-pro", category: "Membership", price: "$79", excerpt: "Daily slate picks, confidence ratings, and risk notes." },
      { id: "p-1b", title: "Monthly VIP Access", slug: "monthly-vip", category: "Membership", price: "$199", excerpt: "Full access to all signals and premium chat rooms." },
      { id: "p-1c", title: "Yearly Elite Plan", slug: "yearly-elite", category: "Membership", price: "$999", excerpt: "Best value for professional bettors and syndicates." },
      { id: "p-1d", title: "Trial Week Pass", slug: "trial-week", category: "Membership", price: "$19", excerpt: "7-day access to test our signals and community." },
      { id: "p-1e", title: "Lifetime Founders", slug: "lifetime-founders", category: "Membership", price: "$2499", excerpt: "One-time payment for permanent elite status." },
      { id: "p-1f", title: "Signal Alert SMS", slug: "signal-sms", category: "Membership", price: "$45", excerpt: "Instant SMS notifications for high-confidence picks." },
      { id: "p-1g", title: "Community Only", slug: "community-only", category: "Membership", price: "$29", excerpt: "Access to the discord without specific signal picks." },

      // Tools Category
      { id: "p-2", title: "Bankroll Tracker", slug: "bankroll-tracker", category: "Tools", price: "$29", excerpt: "Track wagers, ROI, and stake discipline with clean dashboards." },
      { id: "p-2b", title: "Odds Comparator", slug: "odds-compare", category: "Tools", price: "$15", excerpt: "Compare odds across 20+ major sportsbooks live." },
      { id: "p-2c", title: "Arbitrage Scanner", slug: "arb-scanner", category: "Tools", price: "$149", excerpt: "Find guaranteed profit opportunities via line discrepancies." },
      { id: "p-2d", title: "EV+ Calculator", slug: "ev-calc", category: "Tools", price: "$0", excerpt: "Free tool to calculate expected value on any bet." },
      { id: "p-2e", title: "Line Movement Bot", slug: "line-bot", category: "Tools", price: "$39", excerpt: "Real-time alerts for significant market steam." },
      { id: "p-2f", title: "Parlay Optimizer", slug: "parlay-opt", category: "Tools", price: "$25", excerpt: "Find the best legs to correlate for higher payouts." },
      { id: "p-2g", title: "Prop Tool Pro", slug: "prop-tool", category: "Tools", price: "$55", excerpt: "Deep stats for player propositions across NBA/NFL." },

      // Guides Category
      { id: "p-3", title: "NFL Model Report", slug: "nfl-model-report", category: "Guides", price: "$49", excerpt: "Weekly edge report with matchup grades and line movement context." },
      { id: "p-3b", title: "NBA Betting Bible", slug: "nba-bible", category: "Guides", price: "$35", excerpt: "Complete strategy guide for high-frequency NBA betting." },
      { id: "p-3c", title: "MLB Analytics 101", slug: "mlb-101", category: "Guides", price: "$20", excerpt: "Introduction to sabermetrics for baseball betting." },
      { id: "p-3d", title: "Horse Racing Secrets", slug: "horse-secrets", category: "Guides", price: "$65", excerpt: "Pro methods for reading tracks and handicap sheets." },
      { id: "p-3e", title: "UFC Fight Night Prep", slug: "ufc-prep", category: "Guides", price: "$15", excerpt: "Specific breakdown for the upcoming fight card." },
      { id: "p-3f", title: "Bankroll Management", slug: "br-mgt-guide", category: "Guides", price: "$0", excerpt: "Free e-book on how to never go broke betting." },
      { id: "p-3g", title: "Algo Betting intro", slug: "algo-intro", category: "Guides", price: "$85", excerpt: "Learn how to build your first predictive sports model." },
    ],
    reviewSummary: {
      score: 4.8,
      outOf: 5,
      satisfiedPercent: 97,
      ratingCount: 7456,
      reviewCount: 3777,
      breakdown: [
        { star: 5, count: 691 },
        { star: 4, count: 562 },
        { star: 3, count: 105 },
        { star: 2, count: 24 },
        { star: 1, count: 74 },
      ],
    },
    reviews: [
      {
        id: "r-1",
        productId: "p-2",
        productTitle: "Bankroll Tracker",
        productVariant: "Pro Plan",
        rating: 5,
        createdAtLabel: "Hari ini",
        usernameMasked: "j***u",
        content:
          "Dashboard-nya rapi dan gampang dipakai. Bantu banget untuk tracking stake dan ROI harian, jadi keputusan lebih disiplin.",
        helpfulCount: 12,
      },
      {
        id: "r-2",
        productId: "p-3",
        productTitle: "NFL Model Report",
        productVariant: "Week 12 Edition",
        rating: 5,
        createdAtLabel: "1 hari lalu",
        usernameMasked: "P***c",
        content:
          "Analisis matchup detail dan langsung actionable. Beberapa pick saya ikut punya hit-rate bagus minggu ini.",
        helpfulCount: 8,
      },
      {
        id: "r-3",
        productId: "p-1b",
        productTitle: "Monthly VIP Access",
        productVariant: "Member",
        rating: 4,
        createdAtLabel: "2 hari lalu",
        usernameMasked: "n***r",
        content:
          "Komunitas aktif dan admin responsif. Kadang sinyal mepet waktu match, tapi overall tetap worth it.",
        helpfulCount: 5,
      },
    ],
    about: {
      ownerName: "Raka Pradana",
      ownerRole: "Founder & Lead Analyst",
      establishedYear: 2019,
      fullAddress: "Jl. Panjang No. 88, Kebon Jeruk, Jakarta Barat, DKI Jakarta",
      responseTime: "± 5 menit di jam operasional",
      operatingHours: "Senin - Minggu, 09.00 - 22.00 WIB",
      descriptionLong:
        "Bravo Six adalah toko digital yang berfokus pada tools analisis, membership sinyal, dan panduan edukasi untuk membantu member mengambil keputusan berbasis data. Tim kami terdiri dari analis statistik dan operator komunitas yang aktif mendampingi member setiap hari.",
      mission:
        "Misi kami adalah membuat analisis taruhan lebih terstruktur, transparan, dan mudah diakses untuk pemula maupun profesional.",
      highlights: [
        "Lebih dari 140K transaksi produk digital",
        "Komunitas aktif dengan update harian",
        "Sistem manajemen bankroll berbasis data",
        "Support responsif via chat toko",
      ],
      contactEmail: "support@bravosix.store",
      contactPhone: "+62 811-9000-1100",
    },
  },
  "whop-university": {
    business: {
      id: "biz-2",
      name: "Whop University",
      slug: "whop-university",
      city: "Bandung",
      description: "Practical business education for creators and digital sellers.",
      headline: "Learn, launch, and grow your storefront faster.",
      logoText: "WU",
      isVerified: true,
      rating: "4.9",
      reviewCount: "12,110",
      soldLabel: "198K sold",
      followers: "311K",
      soldCount: "95K",
    },
    products: [
      {
        id: "p-4",
        title: "Launch Blueprint",
        slug: "launch-blueprint",
        category: "Courses",
        price: "$99",
        excerpt: "Step-by-step launch framework from offer setup to first 100 sales.",
      },
      {
        id: "p-5",
        title: "Creator Sales Scripts",
        slug: "creator-sales-scripts",
        category: "Templates",
        price: "$24",
        excerpt: "DM, email, and checkout scripts that improve conversions.",
      },
      {
        id: "p-6",
        title: "Community Growth Playbook",
        slug: "community-growth-playbook",
        category: "Guides",
        price: "$39",
        excerpt: "Retention and engagement systems to grow paid communities.",
      },
    ],
    reviewSummary: {
      score: 4.9,
      outOf: 5,
      satisfiedPercent: 98,
      ratingCount: 12110,
      reviewCount: 5021,
      breakdown: [
        { star: 5, count: 1021 },
        { star: 4, count: 255 },
        { star: 3, count: 41 },
        { star: 2, count: 18 },
        { star: 1, count: 9 },
      ],
    },
    reviews: [
      {
        id: "wu-r-1",
        productId: "p-4",
        productTitle: "Launch Blueprint",
        productVariant: "Batch 3",
        rating: 5,
        createdAtLabel: "Hari ini",
        usernameMasked: "a***n",
        content:
          "Materinya jelas step-by-step dan cocok buat pemula. Dalam 2 minggu sudah bisa launch offer pertama.",
        helpfulCount: 16,
      },
      {
        id: "wu-r-2",
        productId: "p-5",
        productTitle: "Creator Sales Scripts",
        productVariant: "v2",
        rating: 4,
        createdAtLabel: "3 hari lalu",
        usernameMasked: "r***a",
        content:
          "Script DM-nya membantu, tinggal disesuaikan dengan niche saya. Conversion naik dibanding sebelumnya.",
        helpfulCount: 7,
      },
    ],
    about: {
      ownerName: "Alya Mahendra",
      ownerRole: "Program Director",
      establishedYear: 2021,
      fullAddress: "Jl. Setiabudi No. 21, Bandung Wetan, Kota Bandung, Jawa Barat",
      responseTime: "± 10 menit di jam kerja",
      operatingHours: "Senin - Jumat, 08.00 - 21.00 WIB",
      descriptionLong:
        "Whop University menyediakan materi praktis untuk creator dan digital seller yang ingin membangun bisnis online berkelanjutan. Fokus utama kami ada pada peluncuran produk, optimasi conversion, dan pengembangan komunitas berbayar.",
      mission:
        "Kami membantu creator naik kelas dari coba-coba menjadi bisnis digital yang konsisten tumbuh.",
      highlights: [
        "12K+ rating dari peserta aktif",
        "Kurikulum berbasis studi kasus nyata",
        "Template dan playbook siap pakai",
        "Mentoring komunitas mingguan",
      ],
      contactEmail: "hello@whopuniversity.id",
      contactPhone: "+62 812-7000-2200",
    },
  },
};

export function listBusinessSlugs(): string[] {
  return Object.keys(STORES);
}

export function getBusinessStoreBySlug(slug: string): PublicBusinessStore | null {
  return STORES[slug] ?? null;
}

export function getFallbackBusinessStore(slug?: string): PublicBusinessStore | null {
  if (slug && STORES[slug]) {
    return STORES[slug];
  }

  const firstStore = Object.values(STORES)[0];
  return firstStore ?? null;
}

export function listBusinessProductPaths(): Array<{ merchant: string; slug: string }> {
  return Object.entries(STORES).flatMap(([merchant, store]) =>
    store.products.map((product) => ({ merchant, slug: product.slug }))
  );
}

export function getBusinessProductBySlugs(merchant: string, productSlug: string) {
  const store = getBusinessStoreBySlug(merchant);
  if (!store) return null;

  const product = store.products.find((item) => item.slug === productSlug);
  if (!product) return null;

  return { store, product };
}
