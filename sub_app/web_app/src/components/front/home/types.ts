import type { LucideIcon } from "lucide-react";

export interface HomeStoreItem {
  id: string;
  name: string;
  subtitle: string;
  products: string;
  code: string;
}

export interface HomeProductItem {
  id: string;
  name: string;
  price: string;
  tone: string;
  categoryId?: string;
  badge?: string;
}

export interface HomeCategoryItem {
  id: string;
  name: string;
  count: string;
  icon: LucideIcon;
}
