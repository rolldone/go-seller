package pgwtypes

import "strings"

const (
	InstructionTypeVA       = "va"
	InstructionTypeQris     = "qris"
	InstructionTypeRedirect = "redirect"
	InstructionTypeEWallet  = "ewallet"
	InstructionTypeCash     = "cash"
	InstructionTypeCStore   = "cstore"

	PaymentStatusPending   = "pending"
	PaymentStatusSucceeded = "succeeded"
	PaymentStatusFailed    = "failed"
	PaymentStatusRefunded  = "refunded"
)

// NormalizeInstructionType maps provider aliases into the canonical payment-instruction type.
func NormalizeInstructionType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "virtual_account", "virtual-account":
		return InstructionTypeVA
	case "qr_code", "qr-code":
		return InstructionTypeQris
	case "e_wallet", "e-wallet":
		return InstructionTypeEWallet
	case "convenience_store", "convenience-store":
		return InstructionTypeCStore
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

// HumanizeInstructionType returns a user-facing fallback label for a payment instruction type.
func HumanizeInstructionType(value string) string {
	switch NormalizeInstructionType(value) {
	case InstructionTypeVA:
		return "Virtual Account"
	case InstructionTypeQris:
		return "QRIS"
	case InstructionTypeRedirect:
		return "Redirect"
	case InstructionTypeEWallet:
		return "E-Wallet"
	case InstructionTypeCash:
		return "Cash"
	case InstructionTypeCStore:
		return "Convenience Store"
	default:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return "Payment"
		}
		return trimmed
	}
}

// CanonicalGatewayStatus maps provider-specific lifecycle states to the shared payment status set.
func CanonicalGatewayStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "paid", "success", "succeeded", "settled", "settlement", "capture", "captured", "completed":
		return PaymentStatusSucceeded
	case "failed", "expire", "expired", "cancelled", "canceled", "rejected", "deny", "voided":
		return PaymentStatusFailed
	case "refund", "refunded", "partial_refund", "partial_refunded":
		return PaymentStatusRefunded
	case "pending", "awaiting_payment", "authorized", "processing", "in_process":
		return PaymentStatusPending
	default:
		return PaymentStatusPending
	}
}

// Normalize returns a copy of the instruction with canonical type and trimmed fields.
func (p PaymentInstruction) Normalize() PaymentInstruction {
	p.Type = NormalizeInstructionType(p.Type)
	p.DisplayName = strings.TrimSpace(p.DisplayName)
	if p.DisplayName == "" {
		p.DisplayName = HumanizeInstructionType(p.Type)
	}
	p.VirtualAccountNumber = normalizeOptionalStringPointer(p.VirtualAccountNumber, strings.TrimSpace)
	p.BankCode = normalizeOptionalStringPointer(p.BankCode, strings.ToLower)
	p.QRString = normalizeOptionalStringPointer(p.QRString, strings.TrimSpace)
	p.RedirectURL = normalizeOptionalStringPointer(p.RedirectURL, strings.TrimSpace)
	p.Currency = strings.ToUpper(strings.TrimSpace(p.Currency))
	p.Steps = compactStrings(p.Steps)
	if len(p.ExtraInfo) == 0 {
		p.ExtraInfo = nil
	}
	return p
}

// LookupKeys returns the candidate identifiers that can be used to resolve a payment from a webhook.
func (e WebhookEvent) LookupKeys() []string {
	return uniqueStrings(
		strings.TrimSpace(e.GatewayTransactionID),
		strings.TrimSpace(stringValue(e.ProviderTransactionID)),
		strings.TrimSpace(stringValue(e.ExternalReference)),
		strings.TrimSpace(stringValue(e.IdempotencyKey)),
	)
}

func normalizeOptionalStringPointer(value *string, transform func(string) string) *string {
	if value == nil {
		return nil
	}
	normalized := strings.TrimSpace(transform(*value))
	if normalized == "" {
		return nil
	}
	return &normalized
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func compactStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func uniqueStrings(values ...string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
