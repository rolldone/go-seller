package services

import (
	"context"
	"errors"
	"strings"

	catalogmodels "go_framework/plugins/catalog/models"

	"gorm.io/gorm"
)

func (s *CatalogService) GetAttributeGroupByIDForMember(ctx context.Context, memberID, id string) (*catalogmodels.AttributeGroup, error) {
	ag, err := s.GetAttributeGroupByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ag.BusinessID == nil || strings.TrimSpace(*ag.BusinessID) == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if _, err := s.GetBusinessByIDForMember(ctx, memberID, strings.TrimSpace(*ag.BusinessID)); err != nil {
		return nil, err
	}
	return ag, nil
}

func (s *CatalogService) ListAttributeGroupsForMember(ctx context.Context, memberID, businessID string, includeInactive bool) ([]catalogmodels.AttributeGroup, error) {
	trimmedBusinessID := strings.TrimSpace(businessID)
	if trimmedBusinessID == "" {
		return []catalogmodels.AttributeGroup{}, errors.New("business id is required")
	}
	if _, err := s.GetBusinessByIDForMember(ctx, memberID, trimmedBusinessID); err != nil {
		return nil, err
	}
	return s.ListAttributeGroups(ctx, includeInactive, trimmedBusinessID)
}

func (s *CatalogService) CreateAttributeGroupForMember(ctx context.Context, memberID string, ag *catalogmodels.AttributeGroup) error {
	if ag.BusinessID == nil || strings.TrimSpace(*ag.BusinessID) == "" {
		return errors.New("business id is required")
	}
	if _, err := s.GetBusinessByIDForMember(ctx, memberID, strings.TrimSpace(*ag.BusinessID)); err != nil {
		return err
	}
	return s.CreateAttributeGroup(ctx, ag)
}

func (s *CatalogService) UpdateAttributeGroupForMember(ctx context.Context, memberID string, ag *catalogmodels.AttributeGroup) error {
	if _, err := s.GetAttributeGroupByIDForMember(ctx, memberID, ag.ID); err != nil {
		return err
	}
	return s.UpdateAttributeGroup(ctx, ag)
}

func (s *CatalogService) DeleteAttributeGroupForMember(ctx context.Context, memberID, id string) error {
	if _, err := s.GetAttributeGroupByIDForMember(ctx, memberID, id); err != nil {
		return err
	}
	return s.DeleteAttributeGroup(ctx, id)
}

func (s *CatalogService) ListAttributesByGroupIDForMember(ctx context.Context, memberID, groupID string, includeInactive bool) ([]catalogmodels.Attribute, error) {
	if _, err := s.GetAttributeGroupByIDForMember(ctx, memberID, groupID); err != nil {
		return nil, err
	}
	return s.ListAttributesByGroupID(ctx, groupID, includeInactive)
}

func (s *CatalogService) GetAttributeByIDForMember(ctx context.Context, memberID, id string) (*catalogmodels.Attribute, error) {
	attr, err := s.GetAttributeByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if attr.AttributeGroupID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if _, err := s.GetAttributeGroupByIDForMember(ctx, memberID, attr.AttributeGroupID); err != nil {
		return nil, err
	}
	return attr, nil
}

func (s *CatalogService) CreateAttributeForMember(ctx context.Context, memberID string, attr *catalogmodels.Attribute) error {
	if _, err := s.GetAttributeGroupByIDForMember(ctx, memberID, attr.AttributeGroupID); err != nil {
		return err
	}
	return s.CreateAttribute(ctx, attr)
}

func (s *CatalogService) UpdateAttributeForMember(ctx context.Context, memberID string, attr *catalogmodels.Attribute) error {
	if _, err := s.GetAttributeByIDForMember(ctx, memberID, attr.ID); err != nil {
		return err
	}
	return s.UpdateAttribute(ctx, attr)
}

func (s *CatalogService) DeleteAttributeForMember(ctx context.Context, memberID, id string) error {
	if _, err := s.GetAttributeByIDForMember(ctx, memberID, id); err != nil {
		return err
	}
	return s.DeleteAttribute(ctx, id)
}

func (s *CatalogService) getProductVariationForMember(ctx context.Context, memberID, id string) (*catalogmodels.ProductVariation, error) {
	pv, err := s.GetProductVariationByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if _, err := s.GetProductByIDForMember(ctx, memberID, pv.ProductID); err != nil {
		return nil, err
	}
	return pv, nil
}

func (s *CatalogService) CreateProductVariationForMember(ctx context.Context, memberID string, pv *catalogmodels.ProductVariation, attributeIDs []string) error {
	if _, err := s.GetProductByIDForMember(ctx, memberID, pv.ProductID); err != nil {
		return err
	}
	return s.CreateProductVariation(ctx, pv, attributeIDs)
}

func (s *CatalogService) GetProductVariationByIDForMember(ctx context.Context, memberID, id string) (*catalogmodels.ProductVariation, error) {
	return s.getProductVariationForMember(ctx, memberID, id)
}

func (s *CatalogService) ListProductVariationsByProductIDForMember(ctx context.Context, memberID, productID string) ([]catalogmodels.ProductVariation, error) {
	if _, err := s.GetProductByIDForMember(ctx, memberID, productID); err != nil {
		return nil, err
	}
	return s.ListProductVariationsByProductID(ctx, productID)
}

func (s *CatalogService) UpdateProductVariationForMember(ctx context.Context, memberID string, pv *catalogmodels.ProductVariation, attributeIDs []string) error {
	if _, err := s.getProductVariationForMember(ctx, memberID, pv.ID); err != nil {
		return err
	}
	return s.UpdateProductVariation(ctx, pv, attributeIDs)
}

func (s *CatalogService) DeleteProductVariationForMember(ctx context.Context, memberID, id string) error {
	if _, err := s.getProductVariationForMember(ctx, memberID, id); err != nil {
		return err
	}
	return s.DeleteProductVariation(ctx, id)
}

func (s *CatalogService) UpdateVariationAssetsForMember(ctx context.Context, memberID, variationID string, assetIDs []string) error {
	pv, err := s.getProductVariationForMember(ctx, memberID, variationID)
	if err != nil {
		return err
	}
	return s.UpdateVariationAssets(ctx, variationID, pv.ProductID, assetIDs)
}

func (s *CatalogService) GetVariationByAttributesForMember(ctx context.Context, memberID, productID string, attributeIDs []string) (*catalogmodels.ProductVariation, error) {
	if _, err := s.GetProductByIDForMember(ctx, memberID, productID); err != nil {
		return nil, err
	}
	return s.GetVariationByAttributes(ctx, productID, attributeIDs)
}
