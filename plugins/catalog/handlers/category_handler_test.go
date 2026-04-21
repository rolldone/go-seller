package handlers

import (
	"encoding/json"
	"testing"

	catalogmodels "go_framework/plugins/catalog/models"
)

func TestApplyCategoryTranslationCopiesNameSlugAndSEOContent(t *testing.T) {
	category := &catalogmodels.Category{
		Name: "Base Name",
		Slug: "base-name",
	}
	translation := catalogmodels.CategoryTranslation{
		Name:       "Localized Name",
		Slug:       "localized-name",
		SEOContent: json.RawMessage(`{"title":"Localized SEO","description":"Localized desc"}`),
	}

	applyCategoryTranslation(category, translation)

	if category.Name != "Localized Name" {
		t.Fatalf("expected translated name, got %q", category.Name)
	}
	if category.Slug != "localized-name" {
		t.Fatalf("expected translated slug, got %q", category.Slug)
	}
	if string(category.SEOContent) != string(translation.SEOContent) {
		t.Fatalf("expected translated seo_content, got %s", string(category.SEOContent))
	}
}
