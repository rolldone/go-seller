export type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string | null;
  description_html?: string | null;
  description_plain?: string | null;
  description_blocks?: unknown;
  short_description?: string | null;
  price: number;
  sale_price?: number | null;
  status: string;
  stock_status: string;
  is_visible: boolean;
  is_negotiate: boolean;
  seo_content?: unknown;
  attributes?: unknown;
  business_id?: string | null;
  category_ids?: string[];
  tag_ids?: string[];
  product_type?: string;
  tax_type?: TaxType;
  tax_rate?: number;
  custom_tax?: boolean;
  price_override_enabled?: boolean;
  weight?: number | null;
  dimensions_length?: number | null;
  dimensions_width?: number | null;
  dimensions_height?: number | null;
  created_at: string;
  updated_at: string;
};

export type TaxType = "include" | "exclude";

export type ProductListResponse = {
  data: Product[];
  total: number;
};

export type ProductListParams = {
  q?: string;
  status?: string;
  stock_status?: string;
  business_id?: string;
  category_id?: string;
  tag_id?: string;
  product_type?: string;
  is_visible?: "true" | "false" | "";
  page: number;
  limit: number;
};

export type ProductPayload = {
  sku: string;
  name: string;
  slug: string;
  description?: string;
  description_html?: string;
  description_plain?: string;
  description_blocks?: unknown;
  short_description?: string;
  price: number;
  sale_price?: number;
  status: string;
  stock_status: string;
  is_visible: boolean;
  is_negotiate: boolean;
  seo_content?: unknown;
  attributes?: unknown;
  business_id?: string;
  category_ids?: string[];
  tag_ids?: string[];
  product_type?: string;
  tax_type?: TaxType;
  tax_rate?: number;
  custom_tax?: boolean;
  price_override_enabled?: boolean;
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
};

export type ProductTranslation = {
  id: string;
  product_id: string;
  locale: "id" | "en";
  name: string;
  slug: string;
  description?: string | null;
  description_html?: string | null;
  description_plain?: string | null;
  description_blocks?: unknown;
  short_description?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductTranslationPayload = {
  name: string;
  slug: string;
  description?: string;
  description_html?: string;
  description_plain?: string;
  description_blocks?: unknown;
  short_description?: string;
};
