package services

import (
	"reflect"
	"testing"
	"time"
)

func TestParseBoolSettingValue(t *testing.T) {
	testCases := []struct {
		name         string
		raw          []byte
		defaultValue bool
		want         bool
	}{
		{name: "bool true", raw: []byte("true"), want: true},
		{name: "bool false", raw: []byte("false"), want: false},
		{name: "string true", raw: []byte(`"true"`), want: true},
		{name: "string false", raw: []byte(`"false"`), want: false},
		{name: "null falls back", raw: []byte("null"), defaultValue: true, want: true},
		{name: "invalid falls back", raw: []byte("not-json"), defaultValue: false, want: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := parseBoolSettingValue(testCase.raw, testCase.defaultValue)
			if got != testCase.want {
				t.Fatalf("expected %v, got %v", testCase.want, got)
			}
		})
	}
}

func TestParseOrderMetadataRootHandlesInvalidJSON(t *testing.T) {
	root := parseOrderMetadataRoot([]byte("not-json"))
	if len(root) != 0 {
		t.Fatalf("expected empty root for invalid JSON, got %#v", root)
	}
}

func TestCustomerConfirmationMetadataRoundTrip(t *testing.T) {
	requestedAt := time.Date(2026, 5, 9, 8, 30, 0, 0, time.UTC)
	rejectedAt := requestedAt.Add(2 * time.Hour)
	state := customerConfirmationMetadata{
		Status:        "rejected",
		SellerMessage: normalizeOptionalText("Silakan cek barangnya ya"),
		RequestedAt:   &requestedAt,
		RejectedAt:    &rejectedAt,
		RejectReason:  normalizeOptionalText("Barang belum sampai"),
	}

	root := map[string]any{customerConfirmationMetadataKey: state.toMap()}
	parsed := readCustomerConfirmationMetadata(root)

	if parsed.Status != state.Status {
		t.Fatalf("expected status %q, got %q", state.Status, parsed.Status)
	}
	if parsed.SellerMessage == nil || *parsed.SellerMessage != *state.SellerMessage {
		t.Fatalf("expected seller message %q, got %#v", *state.SellerMessage, parsed.SellerMessage)
	}
	if parsed.RejectReason == nil || *parsed.RejectReason != *state.RejectReason {
		t.Fatalf("expected reject reason %q, got %#v", *state.RejectReason, parsed.RejectReason)
	}
	if parsed.RequestedAt == nil || !parsed.RequestedAt.Equal(requestedAt) {
		t.Fatalf("expected requested_at %s, got %#v", requestedAt, parsed.RequestedAt)
	}
	if parsed.RejectedAt == nil || !parsed.RejectedAt.Equal(rejectedAt) {
		t.Fatalf("expected rejected_at %s, got %#v", rejectedAt, parsed.RejectedAt)
	}
	if parsed.ApprovedAt != nil {
		t.Fatalf("expected approved_at to stay nil, got %#v", parsed.ApprovedAt)
	}

	if got := state.toMap(); !reflect.DeepEqual(got, root[customerConfirmationMetadataKey]) {
		t.Fatalf("expected round-trip map %#v, got %#v", root[customerConfirmationMetadataKey], got)
	}
}

func TestOrderDisputeMetadataRoundTrip(t *testing.T) {
	openedAt := time.Date(2026, 5, 10, 9, 0, 0, 0, time.UTC)
	resolvedAt := openedAt.Add(90 * time.Minute)
	refundedAt := resolvedAt.Add(2 * time.Hour)
	state := orderDisputeMetadata{
		OpenedAt:                 &openedAt,
		CustomerReason:           normalizeOptionalText("Barang belum diterima"),
		SellerNote:               normalizeOptionalText("Resi menunjukkan delivered"),
		SellerNoteAt:             &openedAt,
		SellerMemberID:           normalizeOptionalText("member-1"),
		AdminDecision:            orderDisputeDecisionRefunded,
		AdminNote:                normalizeOptionalText("Refund manual disetujui"),
		ResolvedByAdminID:        normalizeOptionalText("admin-1"),
		ResolvedAt:               &resolvedAt,
		RefundNote:               normalizeOptionalText("Dana dikembalikan via transfer manual"),
		RefundCompletedByAdminID: normalizeOptionalText("admin-2"),
		RefundCompletedAt:        &refundedAt,
	}

	root := map[string]any{orderDisputeMetadataKey: state.toMap()}
	parsed := readOrderDisputeMetadata(root)

	if parsed.CustomerReason == nil || *parsed.CustomerReason != *state.CustomerReason {
		t.Fatalf("expected customer reason %q, got %#v", *state.CustomerReason, parsed.CustomerReason)
	}
	if parsed.SellerNote == nil || *parsed.SellerNote != *state.SellerNote {
		t.Fatalf("expected seller note %q, got %#v", *state.SellerNote, parsed.SellerNote)
	}
	if parsed.AdminDecision != state.AdminDecision {
		t.Fatalf("expected admin decision %q, got %q", state.AdminDecision, parsed.AdminDecision)
	}
	if parsed.RefundCompletedByAdminID == nil || *parsed.RefundCompletedByAdminID != *state.RefundCompletedByAdminID {
		t.Fatalf("expected refund completed by %q, got %#v", *state.RefundCompletedByAdminID, parsed.RefundCompletedByAdminID)
	}
	if parsed.RefundCompletedAt == nil || !parsed.RefundCompletedAt.Equal(refundedAt) {
		t.Fatalf("expected refund completed at %s, got %#v", refundedAt, parsed.RefundCompletedAt)
	}

	if got := state.toMap(); !reflect.DeepEqual(got, root[orderDisputeMetadataKey]) {
		t.Fatalf("expected round-trip map %#v, got %#v", root[orderDisputeMetadataKey], got)
	}
}
