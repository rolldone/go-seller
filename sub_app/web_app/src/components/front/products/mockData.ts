import type { BrowseCategoryItem, BrowseProductItem, BrowseStoreItem } from "./types";

export const browseCategories: BrowseCategoryItem[] = [
  { id: "all", label: "Semua Kategori" },
  { id: "kesehatan", label: "Kesehatan" },
  { id: "elektronik", label: "Elektronik" },
  { id: "kecantikan", label: "Kecantikan" },
  { id: "rumah", label: "Rumah Tangga" },
];

export const browseSortOptions = ["Terbaru", "Terlaris", "Harga Terendah", "Harga Tertinggi"];

export const browseStores: BrowseStoreItem[] = [
  {
    id: "store-healthy",
    name: "Healthy Life",
    description: "Produk kesehatan alami",
    productCount: 120,
    code: "2YTKB",
    accent: "text-emerald-700",
    verified: true,
  },
  {
    id: "store-gadget",
    name: "Gadget Geek",
    description: "Aksesoris dan elektronik terkini",
    productCount: 85,
    code: "4QFLAK",
    accent: "text-slate-900",
  },
  {
    id: "store-beauty",
    name: "Beauty Glow",
    description: "Kosmetik dan skincare berkualitas",
    productCount: 110,
    code: "4PRCLJAA",
    accent: "text-pink-600",
  },
  {
    id: "store-fresh",
    name: "Fresh Home",
    description: "Dekorasi dan perlengkapan rumah",
    productCount: 95,
    code: "4JPKLAX",
    accent: "text-lime-700",
    verified: true,
  },
  {
    id: "store-fit",
    name: "Fit Motion",
    description: "Peralatan olahraga harian",
    productCount: 72,
    code: "5PTMKA",
    accent: "text-cyan-700",
  },
  {
    id: "store-pure",
    name: "Pure Botanica",
    description: "Produk botanical premium",
    productCount: 64,
    code: "1MTRAA",
    accent: "text-emerald-600",
  },
];

export const browseProducts: BrowseProductItem[] = [
  { id: "pr-1", name: "Mini TWS Earbuds", price: 180000, storeId: "store-gadget", storeName: "Gadget Geek", category: "elektronik", categoryIds: ["elektronik"], tone: "from-lime-100 to-slate-100" },
  { id: "pr-2", name: "Keyboard Mechanical RGB", price: 95000, storeId: "store-beauty", storeName: "Beauty Glow", category: "elektronik", categoryIds: ["elektronik"], tone: "from-slate-100 to-zinc-100" },
  { id: "pr-3", name: "Aloe Vera Gel", price: 95000, storeId: "store-beauty", storeName: "Beauty Glow", category: "kecantikan", categoryIds: ["kecantikan"], tone: "from-emerald-50 to-lime-100" },
  { id: "pr-4", name: "Organic Multivitamin", price: 120000, storeId: "store-gadget", storeName: "Gadget Geek", category: "kesehatan", categoryIds: ["kesehatan"], tone: "from-emerald-100 to-stone-100" },
  { id: "pr-5", name: "Matte Liquid Lipstick Set", price: 120000, storeId: "store-beauty", storeName: "Beauty Glow", category: "kecantikan", categoryIds: ["kecantikan"], tone: "from-rose-50 to-stone-100" },
  { id: "pr-6", name: "Magnete Wireless Charger", price: 150000, storeId: "store-beauty", storeName: "Beauty Glow", category: "elektronik", categoryIds: ["elektronik"], tone: "from-slate-100 to-stone-100" },
  { id: "pr-7", name: "Omega 3 Fish Oil", price: 150000, storeId: "store-healthy", storeName: "Healthy Life", category: "kesehatan", categoryIds: ["kesehatan"], tone: "from-lime-100 to-stone-100" },
  { id: "pr-8", name: "Bluetooth Headphones", price: 300000, storeId: "store-gadget", storeName: "Gadget Geek", category: "elektronik", categoryIds: ["elektronik"], tone: "from-slate-100 to-cyan-100" },
  { id: "pr-9", name: "Automatic Blood Pressure", price: 310000, storeId: "store-gadget", storeName: "Gadget Geek", category: "kesehatan", categoryIds: ["kesehatan"], tone: "from-slate-100 to-zinc-100" },
  { id: "pr-10", name: "Citrus Essential Oil Set", price: 90000, storeId: "store-beauty", storeName: "Beauty Glow", category: "kecantikan", categoryIds: ["kecantikan"], tone: "from-lime-100 to-stone-100" },
  { id: "pr-11", name: "Portable Blender", price: 220000, storeId: "store-fit", storeName: "Fit Motion", category: "rumah", categoryIds: ["rumah"], tone: "from-cyan-50 to-slate-100" },
  { id: "pr-12", name: "Herbal Detox Tea", price: 65000, storeId: "store-healthy", storeName: "Healthy Life", category: "kesehatan", categoryIds: ["kesehatan"], tone: "from-emerald-50 to-stone-100" },
  { id: "pr-13", name: "Aromatherapy Humidifier", price: 175000, storeId: "store-pure", storeName: "Pure Botanica", category: "rumah", categoryIds: ["rumah"], tone: "from-lime-50 to-stone-100" },
  { id: "pr-14", name: "Vitamin C Chewable", price: 55000, storeId: "store-healthy", storeName: "Healthy Life", category: "kesehatan", categoryIds: ["kesehatan"], tone: "from-emerald-100 to-zinc-100" },
  { id: "pr-15", name: "Smart Jump Rope", price: 89000, storeId: "store-fit", storeName: "Fit Motion", category: "elektronik", categoryIds: ["elektronik"], tone: "from-cyan-50 to-stone-100" },
  { id: "pr-16", name: "Hydrating Face Toner", price: 72000, storeId: "store-pure", storeName: "Pure Botanica", category: "kecantikan", categoryIds: ["kecantikan"], tone: "from-rose-50 to-zinc-100" },
];
