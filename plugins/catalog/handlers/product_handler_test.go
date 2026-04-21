package handlers

import (
	"encoding/json"
	"testing"

	catalogmodels "go_framework/plugins/catalog/models"
)

func TestApplyTranslationCopiesSEOContent(t *testing.T) {
	product := &catalogmodels.Product{
		Name: "Base Name",
	}
	shortDescription := "Localized short desc"
	translation := catalogmodels.ProductTranslation{
		Name:             "Translated Name",
		Slug:             "translated-name",
		SEOContent:       json.RawMessage(`{"title":"Translated SEO","description":"Localized desc"}`),
		ShortDescription: &shortDescription,
	}

	applyTranslation(product, translation)

	if product.Name != "Translated Name" {
		t.Fatalf("expected translated name, got %q", product.Name)
	}
	if product.Slug != "translated-name" {
		t.Fatalf("expected translated slug, got %q", product.Slug)
	}
	if string(product.SEOContent) != string(translation.SEOContent) {
		t.Fatalf("expected seo_content to be copied, got %s", string(product.SEOContent))
	}
	if product.ShortDescription == nil || *product.ShortDescription != shortDescription {
		t.Fatalf("expected translated short description, got %#v", product.ShortDescription)
	}
}
