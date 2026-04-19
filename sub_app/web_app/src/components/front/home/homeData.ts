import { Leaf, Palette, Shirt, Watch } from "lucide-react";
import type { HomeCategoryItem, HomeProductItem, HomeStoreItem } from "./types";

export const featuredStores: HomeStoreItem[] = [
  { id: "store-1", name: "Healthy Life", subtitle: "Produk kesehatan alami", products: "120+ produk", code: "2YTO" },
  { id: "store-2", name: "Gadget Geek", subtitle: "Aksesoris dan elektronik terkini", products: "85+ produk", code: "3GLJQK" },
  { id: "store-3", name: "Beauty Glow", subtitle: "Kosmetik dan skincare berkualitas", products: "110+ produk", code: "4FPLLJGA" },
  { id: "store-4", name: "Fresh Mart", subtitle: "Kebutuhan harian dan grocery pilihan", products: "95+ produk", code: "9MKXA" },
  { id: "store-5", name: "Home Living", subtitle: "Peralatan rumah modern dan praktis", products: "130+ produk", code: "7QJNL" },
  { id: "store-6", name: "Sport Zone", subtitle: "Perlengkapan olahraga dan kebugaran", products: "75+ produk", code: "6BTPS" },
];

export const highlightedProducts: HomeProductItem[] = [
  { id: "hp-1", name: "PopSocket Lucu", price: "Rp30,000+", tone: "from-emerald-100 to-slate-100", badge: "Pilihan Minggu Ini" },
  { id: "hp-2", name: "Mini TWS Earbuds", price: "Rp180,000", tone: "from-lime-100 to-slate-100" },
  { id: "hp-3", name: "Premium Face Cream", price: "Rp95,000", tone: "from-emerald-50 to-stone-100" },
  { id: "hp-4", name: "Smart Power Strip", price: "Rp120,000", tone: "from-cyan-50 to-slate-100" },
  { id: "hp-5", name: "Glasses Holder", price: "Rp42,000", tone: "from-emerald-50 to-lime-50" },
  { id: "hp-6", name: "Nutriboost Gummies", price: "Rp68,000", tone: "from-lime-100 to-stone-100" },
  { id: "hp-7", name: "Electric Warmer", price: "Rp139,000", tone: "from-cyan-50 to-slate-100" },
  { id: "hp-8", name: "Smart Bottle", price: "Rp88,000", tone: "from-slate-100 to-gray-200" },
];

export const categories: HomeCategoryItem[] = [
  { id: "kesehatan", name: "Kesehatan", count: "240+ produk", icon: Leaf },
  { id: "elektronik", name: "Elektronik", count: "180+ produk", icon: Watch },
  { id: "fashion", name: "Fashion", count: "150+ produk", icon: Shirt },
  { id: "kecantikan", name: "Kecantikan", count: "200+ produk", icon: Palette },
];

export const categoryProducts: HomeProductItem[] = [
  { id: "mp-1", name: "Organic Multivitamin", price: "Rp120,000+", tone: "from-emerald-100 to-stone-100", categoryId: "kesehatan" },
  { id: "mp-2", name: "Omega 3 Fish Oil", price: "Rp150,000", tone: "from-lime-100 to-stone-100", categoryId: "kesehatan" },
  { id: "mp-3", name: "Slimming Herbal Tea", price: "Rp55,000", tone: "from-emerald-50 to-stone-100", categoryId: "kesehatan" },
  { id: "mp-4", name: "Vitamin C Chewable", price: "Rp40,000", tone: "from-cyan-50 to-slate-100", categoryId: "kesehatan" },
  { id: "mp-5", name: "Keyboard Mechanical RGB", price: "Rp550,000", tone: "from-lime-100 to-slate-100", categoryId: "elektronik" },
  { id: "mp-6", name: "Automatic Blood Pressure", price: "Rp310,000", tone: "from-cyan-50 to-slate-100", categoryId: "elektronik" },
  { id: "mp-7", name: "Smart Power Strip", price: "Rp120,000", tone: "from-slate-100 to-gray-200", categoryId: "elektronik" },
  { id: "mp-8", name: "Wireless Presenter", price: "Rp89,000", tone: "from-slate-100 to-emerald-50", categoryId: "elektronik" },
  { id: "mp-9", name: "Premium Heels", price: "Rp350,000", tone: "from-rose-50 to-stone-100", categoryId: "fashion" },
  { id: "mp-10", name: "Urban Tote Bag", price: "Rp210,000", tone: "from-orange-50 to-stone-100", categoryId: "fashion" },
  { id: "mp-11", name: "Daily Knit Cardigan", price: "Rp280,000", tone: "from-stone-100 to-rose-50", categoryId: "fashion" },
  { id: "mp-12", name: "Leather Belt Classic", price: "Rp160,000", tone: "from-amber-50 to-stone-100", categoryId: "fashion" },
  { id: "mp-13", name: "Aloe Vera Gel", price: "Rp45,000", tone: "from-emerald-50 to-stone-100", categoryId: "kecantikan" },
  { id: "mp-14", name: "Premium Face Cream", price: "Rp95,000", tone: "from-lime-100 to-stone-100", categoryId: "kecantikan" },
  { id: "mp-15", name: "Hydrating Toner", price: "Rp72,000", tone: "from-cyan-50 to-slate-100", categoryId: "kecantikan" },
  { id: "mp-16", name: "Lip Serum", price: "Rp58,000", tone: "from-rose-50 to-stone-100", categoryId: "kecantikan" },
];
