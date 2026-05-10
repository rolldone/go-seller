package services

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"
)

func TestGetOrderByIDRejectsEmptyID(t *testing.T) {
	service := &OrderService{}

	testCases := []struct {
		name string
		id   string
	}{
		{name: "empty", id: ""},
		{name: "whitespace", id: "   \t\n  "},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			order, err := service.GetOrderByID(context.Background(), testCase.id)
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				t.Fatalf("expected gorm.ErrRecordNotFound, got %v", err)
			}
			if order != nil {
				t.Fatalf("expected nil order, got %#v", order)
			}
		})
	}
}
