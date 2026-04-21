import type { PublicProductAsset } from "../business/types";

export interface BrowseStoreItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  productCount: number;
  code: string;
  accent: string;
  verified?: boolean;
}

export interface BrowseProductItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice: number;
  hasDiscount: boolean;
  stockStatus: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  category: string;
  categoryIds: string[];
  gallery?: PublicProductAsset[];
  tone: string;
}

export interface BrowseCategoryItem {
  id: string;
  label: string;
}
