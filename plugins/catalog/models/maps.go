package models

// ProductCategoryMap maps products to categories.
type ProductCategoryMap struct {
	ProductID  string `gorm:"type:uuid;primaryKey" json:"product_id"`
	CategoryID string `gorm:"type:uuid;primaryKey" json:"category_id"`
}

func (ProductCategoryMap) TableName() string {
	return "product_category_map"
}

// ProductTagMap maps products to tags.
type ProductTagMap struct {
	ProductID string `gorm:"type:uuid;primaryKey" json:"product_id"`
	TagID     string `gorm:"type:uuid;primaryKey" json:"tag_id"`
}

func (ProductTagMap) TableName() string {
	return "product_tag_map"
}
