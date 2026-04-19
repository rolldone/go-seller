export interface BrowseStoreItem {
  id: string;
  name: string;
  description: string;
  productCount: number;
  code: string;
  accent: string;
  verified?: boolean;
}

export interface BrowseProductItem {
  id: string;
  name: string;
  price: number;
  storeId: string;
  storeName: string;
  category: string;
  tone: string;
}

export interface BrowseCategoryItem {
  id: string;
  label: string;
}
