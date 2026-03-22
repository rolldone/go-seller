package services

import (
	"strings"
	"testing"
	"time"

	authmodels "go_framework/plugins/auth/models"
	ordermodels "go_framework/plugins/order/models"
)

func TestBuildInvoiceHTML(t *testing.T) {
	now := time.Date(2026, 3, 22, 10, 30, 0, 0, time.UTC)
	order := &ordermodels.Order{
		OrderNumber:    "INV-1001",
		Channel:        "admin",
		Status:         "confirmed",
		PaymentStatus:  "paid",
		Currency:       "IDR",
		Subtotal:       250000,
		DiscountAmount: 10000,
		TaxAmount:      22000,
		ShippingAmount: 15000,
		GrandTotal:     277000,
		CreatedAt:      now,
		Customer: &authmodels.Customer{
			ID:    "cust-1",
			Name:  "Budi",
			Email: "budi@example.com",
			Phone: "08123",
		},
		OrderItems: []ordermodels.OrderItem{{
			ID:             "item-1",
			ProductName:    "Produk A",
			Qty:            2,
			UnitPrice:      125000,
			DiscountAmount: 10000,
			LineTotal:      240000,
		}},
	}

	htmlDoc, err := buildInvoiceHTML(order, invoiceStoreInfo{Name: "Toko Demo", Phone: "081234", Address: "Jl. Mawar"})
	if err != nil {
		t.Fatalf("buildInvoiceHTML returned error: %v", err)
	}

	checks := []string{"INV-1001", "Toko Demo", "Produk A", "budi@example.com", "IDR 277000.00"}
	for _, want := range checks {
		if !strings.Contains(htmlDoc, want) {
			t.Fatalf("expected HTML to contain %q", want)
		}
	}
}

func TestBuildInvoiceFilename(t *testing.T) {
	got := buildInvoiceFilename("ORD/2026 001")
	if got != "invoice-ORD-2026-001.pdf" {
		t.Fatalf("unexpected filename: %s", got)
	}
}
