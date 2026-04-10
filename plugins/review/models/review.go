package models

import "time"

type CustomerReview struct {
	ID            string     `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID       string     `gorm:"type:uuid;index" json:"order_id"`
	OrderItemID   string     `gorm:"type:uuid;index" json:"order_item_id"`
	ProductID     string     `gorm:"type:uuid;index" json:"product_id"`
	CustomerID    string     `gorm:"type:uuid;index" json:"customer_id"`
	Rating        int        `gorm:"type:smallint" json:"rating"`
	ReviewText    string     `gorm:"type:text" json:"review_text"`
	QuestionText  string     `gorm:"type:text" json:"question_text"`
	SellerReply   *string    `gorm:"type:text" json:"seller_reply,omitempty"`
	SellerReplyAt *time.Time `json:"seller_reply_at,omitempty"`
	Status        string     `gorm:"size:24;index" json:"status"`
	IsVisible     bool       `gorm:"index" json:"is_visible"`
	Metadata      []byte     `gorm:"type:jsonb" json:"metadata"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (CustomerReview) TableName() string {
	return "customer_reviews"
}
