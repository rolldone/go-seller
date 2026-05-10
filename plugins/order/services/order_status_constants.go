package services

// =============================================================================
// Order Status Domain
// Represents the business lifecycle of an order.
// Transitions: draft → awaiting_quote → quote_ready → processing → shipped
//
//	→ waiting_customer_confirmation → completed
//
// Terminal states: completed | cancelled | refunded
// =============================================================================
const (
	OrderStatusDraft                       = "draft"
	OrderStatusAwaitingQuote               = "awaiting_quote"
	OrderStatusQuoteReady                  = "quote_ready"
	OrderStatusProcessing                  = "processing"
	OrderStatusShipped                     = "shipped"
	OrderStatusWaitingCustomerConfirmation = "waiting_customer_confirmation"
	OrderStatusCompleted                   = "completed"
	OrderStatusCancelled                   = "cancelled"
	OrderStatusInDispute                   = "in_dispute"
	OrderStatusRefunded                    = "refunded"
)

// =============================================================================
// Payment Status Domain
// Represents the payment lifecycle, independent of order or delivery.
// Transitions: pending → paid | failed | cancelled | expired
// Terminal states: paid | failed | cancelled | expired | refunded
// =============================================================================
const (
	PaymentStatusPending   = "pending"
	PaymentStatusUnpaid    = "unpaid" // legacy alias – normalise to pending
	PaymentStatusPaid      = "paid"
	PaymentStatusFailed    = "failed"
	PaymentStatusCancelled = "cancelled"
	PaymentStatusExpired   = "expired"
	PaymentStatusRefunded  = "refunded"
)

// =============================================================================
// Delivery Status Domain  (order-level aggregate, stored in orders.delivery_status)
// Computed from order_shipments rows; updated whenever shipments change.
// Transitions: pending → ready_to_ship → partially_shipped → shipped → delivered
// Problem states: exception | returned
// =============================================================================
const (
	DeliveryStatusNotApplicable    = "not_applicable"    // pickup or digital-only order
	DeliveryStatusPending          = "pending"           // order paid but no shipment created yet
	DeliveryStatusReadyToShip      = "ready_to_ship"     // shipment created, waiting carrier pickup
	DeliveryStatusPartiallyShipped = "partially_shipped" // some but not all items shipped
	DeliveryStatusShipped          = "shipped"           // all active shipments with carrier
	DeliveryStatusDelivered        = "delivered"         // all active shipments delivered
	DeliveryStatusException        = "exception"         // at least one shipment has a problem
	DeliveryStatusReturned         = "returned"          // shipment(s) returned to sender
	DeliveryStatusCancelled        = "cancelled"         // all shipments cancelled
)

// =============================================================================
// Shipment Status Domain  (per-record, stored in order_shipments.status)
// Represents one physical shipment (one resi / tracking number).
// Transitions: pending → ready_to_ship → shipped → in_transit → delivered
// Problem states: exception | returned
// =============================================================================
const (
	ShipmentStatusPending     = "pending"
	ShipmentStatusReadyToShip = "ready_to_ship"
	ShipmentStatusShipped     = "shipped"
	ShipmentStatusInTransit   = "in_transit"
	ShipmentStatusDelivered   = "delivered"
	ShipmentStatusException   = "exception"
	ShipmentStatusReturned    = "returned"
	ShipmentStatusCancelled   = "cancelled"
)
