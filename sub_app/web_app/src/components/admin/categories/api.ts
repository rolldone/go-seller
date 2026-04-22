import { adminGet, adminPut } from "../entities/adminApi";

export type Locale = "id" | "en";

export type CategoryTranslation = {
  id: string;
  category_id: string;
  locale: Locale;
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

export type CategoryTranslationPayload = {
  name: string;
  slug: string;
  description?: string;
  description_html?: string;
  description_plain?: string;
  description_blocks?: unknown;
  short_description?: string;
  seo_content?: unknown;
};

export async function listCategoryTranslations(categoryID: string): Promise<CategoryTranslation[]> {
  const res = await adminGet<{ data: CategoryTranslation[] }>(`/admin/catalog/categories/${categoryID}/translations`);
  return res.data || [];
}

export async function upsertCategoryTranslation(
  categoryID: string,
  locale: Locale,
  input: CategoryTranslationPayload,
): Promise<CategoryTranslation> {
  return adminPut<CategoryTranslation>(`/admin/catalog/categories/${categoryID}/translations/${locale}`, input);
}