package handlers

import (
	"encoding/json"
	"testing"

	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/datatypes"
)

func TestApplyCategoryTranslationCopiesLocalizedFields(t *testing.T) {
	description := "Translated description"
	descriptionHTML := "<p>Translated description</p>"
	descriptionPlain := "Translated description"
	shortDescription := "Short translated description"
	descriptionBlocks := datatypes.JSON(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Translated description"}]}]}`)
	category := &catalogmodels.Category{
		Name: "Base Name",
		Slug: "base-name",
	}
	translation := catalogmodels.CategoryTranslation{
		Name:              "Localized Name",
		Slug:              "localized-name",
		Description:       &description,
		DescriptionHTML:   &descriptionHTML,
		DescriptionPlain:  &descriptionPlain,
		DescriptionBlocks: descriptionBlocks,
		ShortDescription:  &shortDescription,
		SEOContent:        json.RawMessage(`{"title":"Localized SEO","description":"Localized desc"}`),
	}

	applyCategoryTranslation(category, translation)

	if category.Name != "Localized Name" {
		t.Fatalf("expected translated name, got %q", category.Name)
	}
	if category.Slug != "localized-name" {
		t.Fatalf("expected translated slug, got %q", category.Slug)
	}
	if category.Description == nil || *category.Description != description {
		t.Fatalf("expected translated description, got %#v", category.Description)
	}
	if category.DescriptionHTML == nil || *category.DescriptionHTML != descriptionHTML {
		t.Fatalf("expected translated description_html, got %#v", category.DescriptionHTML)
	}
	if category.DescriptionPlain == nil || *category.DescriptionPlain != descriptionPlain {
		t.Fatalf("expected translated description_plain, got %#v", category.DescriptionPlain)
	}
	if string(category.DescriptionBlocks) != string(descriptionBlocks) {
		t.Fatalf("expected translated description_blocks, got %s", string(category.DescriptionBlocks))
	}
	if category.ShortDescription == nil || *category.ShortDescription != shortDescription {
		t.Fatalf("expected translated short_description, got %#v", category.ShortDescription)
	}
	if string(category.SEOContent) != string(translation.SEOContent) {
		t.Fatalf("expected translated seo_content, got %s", string(category.SEOContent))
	}
}
