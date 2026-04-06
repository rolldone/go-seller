package services

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 0.000001
}

func TestNormalizeTaxRule(t *testing.T) {
	tests := []struct {
		name     string
		taxType  string
		taxRate  float64
		wantType string
		wantRate float64
	}{
		{name: "include decimal", taxType: "include", taxRate: 0.11, wantType: "include", wantRate: 0.11},
		{name: "exclude uppercase", taxType: "EXCLUDE", taxRate: 0.1, wantType: "exclude", wantRate: 0.1},
		{name: "percentage normalized", taxType: "exclude", taxRate: 10, wantType: "exclude", wantRate: 0.1},
		{name: "invalid type fallback", taxType: "other", taxRate: 0.05, wantType: "exclude", wantRate: 0.05},
		{name: "negative rate clamped", taxType: "include", taxRate: -3, wantType: "include", wantRate: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotType, gotRate := normalizeTaxRule(tc.taxType, tc.taxRate)
			if gotType != tc.wantType {
				t.Fatalf("expected type %q, got %q", tc.wantType, gotType)
			}
			if !almostEqual(gotRate, tc.wantRate) {
				t.Fatalf("expected rate %f, got %f", tc.wantRate, gotRate)
			}
		})
	}
}

func TestCalculateTaxedLineTotal(t *testing.T) {
	tests := []struct {
		name          string
		lineNet       float64
		taxType       string
		taxRate       float64
		wantTax       float64
		wantLineTotal float64
	}{
		{name: "exclude adds tax", lineNet: 100000, taxType: "exclude", taxRate: 0.1, wantTax: 10000, wantLineTotal: 110000},
		{name: "include extracts tax", lineNet: 110000, taxType: "include", taxRate: 0.1, wantTax: 10000, wantLineTotal: 110000},
		{name: "percentage input", lineNet: 100000, taxType: "exclude", taxRate: 10, wantTax: 10000, wantLineTotal: 110000},
		{name: "zero rate no tax", lineNet: 100000, taxType: "exclude", taxRate: 0, wantTax: 0, wantLineTotal: 100000},
		{name: "non positive line", lineNet: 0, taxType: "exclude", taxRate: 0.1, wantTax: 0, wantLineTotal: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotTax, gotLineTotal := calculateTaxedLineTotal(tc.lineNet, tc.taxType, tc.taxRate)
			if !almostEqual(gotTax, tc.wantTax) {
				t.Fatalf("expected tax %f, got %f", tc.wantTax, gotTax)
			}
			if !almostEqual(gotLineTotal, tc.wantLineTotal) {
				t.Fatalf("expected line total %f, got %f", tc.wantLineTotal, gotLineTotal)
			}
		})
	}
}
