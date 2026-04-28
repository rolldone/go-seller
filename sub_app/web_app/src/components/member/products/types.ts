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
	tax_type?: "include" | "exclude";
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

export type ProductAsset = {
	id: string;
	product_id: string;
	file_path: string;
	file_type?: string;
	mime_type?: string;
	file_size?: number;
	original_name?: string;
	public_url?: string;
	is_main: boolean;
	usage_tag?: string;
	display_order?: number;
	created_at?: string;
	updated_at?: string;
};

export type ProductDigitalFile = {
	id: string;
	product_id: string;
	file_path: string;
	file_name: string;
	mime_type?: string;
	file_size?: number;
	download_limit?: number;
	sort_order?: number;
	is_active?: boolean;
	created_at?: string;
	updated_at?: string;
};

export type BusinessOption = {
	id: string;
	name: string;
	slug: string;
};

export type CategoryOption = {
	id: string;
	name: string;
	slug: string;
	parent_id?: string | null;
};

export type TagOption = {
	id: string;
	name: string;
	slug: string;
};

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
	tax_type?: "include" | "exclude";
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
	seo_content?: unknown;
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
	seo_content?: unknown;
};