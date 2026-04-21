import { adminGet, adminPut } from "../entities/adminApi";

export type Locale = "id" | "en";

export type CategoryTranslation = {
  id: string;
  category_id: string;
  locale: Locale;
  name: string;
  slug: string;
  seo_content?: unknown;
  created_at: string;
  updated_at: string;
};

export type CategoryTranslationPayload = {
  name: string;
  slug: string;
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