export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  description_html?: string | null;
  description_plain?: string | null;
  description_blocks?: any;
  highlights?: any;
  owner_name?: string | null;
  owner_role?: string | null;
  founded_year?: number | null;
  address?: string | null;
  operational_hours?: any;
  chat_response_time?: string | null;
  email?: string | null;
  phone?: string | null;
  show_contact_email?: boolean;
  show_phone?: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  assets?: PublicBusinessAsset[];
}

export interface PublicBusinessProduct {
  id: string;
  title: string;
  slug: string;
  category: string;
  // original server-provided price (number) and optional discounted price
  price?: string | null;
  original_price?: number | null;
  discounted_price?: number | null;
  discount_badge?: string | null;
  applied_discount_ids?: string[] | null;
  excerpt: string;

  // gallery assets provided by backend (ordered, is_main preferred)
  gallery?: PublicProductAsset[] | null;
}

export interface PublicProductAsset {
  id: string;
  product_id?: string;
  file_path?: string | null;
  public_url?: string | null;
  is_main?: boolean;
  usage_tag?: string | null;
  display_order?: number | null;
}

export interface PublicBusinessReviewBreakdown {
  star: number;
  count: number;
}

export interface PublicBusinessReviewSummary {
  score: number;
  outOf: number;
  satisfiedPercent: number;
  ratingCount: number;
  reviewCount: number;
  breakdown: PublicBusinessReviewBreakdown[];
}

export interface PublicBusinessReview {
  id: string;
  productId: string;
  productTitle: string;
  productVariant: string;
  rating: number;
  createdAtLabel: string;
  usernameMasked: string;
  content: string;
  helpfulCount: number;
}

export interface PublicBusinessAsset {
  id: string;
  business_id?: string;
  file_path?: string;
  file_type?: string;
  mime_type?: string;
  file_size?: number;
  original_name?: string;
  public_url?: string;
  is_main?: boolean;
  usage_tag?: string;
  display_order?: number;
  derivatives?: PublicBusinessAssetDerivative[];
  created_at?: string;
  updated_at?: string;
}

export interface PublicBusinessAssetDerivative {
  id: string;
  asset_id?: string;
  file_path?: string;
  file_type?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  file_size?: number;
  purpose?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PublicBusinessStore {
  business: PublicBusiness;
  products?: PublicBusinessProduct[];
  reviewSummary?: PublicBusinessReviewSummary | null;
  reviews?: PublicBusinessReview[] | null;
}
