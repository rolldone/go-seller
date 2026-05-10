package services

import "testing"

func TestNextPaidOrderStatus(t *testing.T) {
	testCases := []struct {
		name  string
		input string
		want  string
	}{
		{name: "pending becomes processing", input: "pending", want: OrderStatusProcessing},
		{name: "confirmed becomes processing", input: "confirmed", want: OrderStatusProcessing},
		{name: "completed stays completed", input: "completed", want: "completed"},
		{name: "shipped stays shipped", input: "shipped", want: "shipped"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := nextPaidOrderStatus(testCase.input); got != testCase.want {
				t.Fatalf("expected %q, got %q", testCase.want, got)
			}
		})
	}
}

func TestNextOrderStatusFromShipmentProgress(t *testing.T) {
	testCases := []struct {
		name            string
		currentStatus   string
		paymentStatus   string
		fulfillmentType string
		progress        orderShipmentProgress
		want            string
	}{
		{
			name:            "keeps current when payment unpaid",
			currentStatus:   "pending",
			paymentStatus:   "unpaid",
			fulfillmentType: FulfillmentTypeDelivery,
			progress:        orderShipmentProgress{ActiveShipmentCount: 1, AssignedItemCount: 1, ShippableItemCount: 1, ShippedOrDeliveredCount: 1},
			want:            "pending",
		},
		{
			name:            "processing while shipment partial",
			currentStatus:   "processing",
			paymentStatus:   "paid",
			fulfillmentType: FulfillmentTypeDelivery,
			progress:        orderShipmentProgress{ActiveShipmentCount: 2, AssignedItemCount: 1, ShippableItemCount: 2, ShippedOrDeliveredCount: 1},
			want:            OrderStatusProcessing,
		},
		{
			name:            "shipped when all active shipments are shipped and all items assigned",
			currentStatus:   "processing",
			paymentStatus:   "paid",
			fulfillmentType: FulfillmentTypeDelivery,
			progress:        orderShipmentProgress{ActiveShipmentCount: 2, AssignedItemCount: 2, ShippableItemCount: 2, ShippedOrDeliveredCount: 2, DeliveredCount: 1},
			want:            "shipped",
		},
		{
			name:            "keeps waiting confirmation out of shipment control",
			currentStatus:   OrderStatusWaitingCustomerConfirmation,
			paymentStatus:   "paid",
			fulfillmentType: FulfillmentTypeDelivery,
			progress:        orderShipmentProgress{ActiveShipmentCount: 2, AssignedItemCount: 2, ShippableItemCount: 2, ShippedOrDeliveredCount: 2, DeliveredCount: 2},
			want:            OrderStatusWaitingCustomerConfirmation,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := nextOrderStatusFromShipmentProgress(testCase.currentStatus, testCase.paymentStatus, testCase.fulfillmentType, testCase.progress); got != testCase.want {
				t.Fatalf("expected %q, got %q", testCase.want, got)
			}
		})
	}
}

func TestNextDeliveryStatusFromProgress(t *testing.T) {
	testCases := []struct {
		name            string
		fulfillmentType string
		progress        orderShipmentProgress
		want            string
	}{
		{name: "pickup => not_applicable", fulfillmentType: FulfillmentTypePickup, want: DeliveryStatusNotApplicable},
		{name: "no shippable items => not_applicable", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 0}, want: DeliveryStatusNotApplicable},
		{name: "no active shipments => pending", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 0}, want: DeliveryStatusPending},
		{name: "exception takes priority", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, ExceptionCount: 1, DeliveredCount: 1}, want: DeliveryStatusException},
		{name: "returned takes priority after exception", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, ReturnedCount: 1, DeliveredCount: 1}, want: DeliveryStatusReturned},
		{name: "all delivered => delivered", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, DeliveredCount: 2}, want: DeliveryStatusDelivered},
		{name: "all in transit => shipped", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, InTransitCount: 2}, want: DeliveryStatusShipped},
		{name: "some in transit, one delivered => shipped", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, InTransitCount: 1, DeliveredCount: 1}, want: DeliveryStatusShipped},
		{name: "some in transit, some not => partially_shipped", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 3, ActiveShipmentCount: 3, InTransitCount: 1}, want: DeliveryStatusPartiallyShipped},
		{name: "no in transit or delivered => ready_to_ship", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, ActiveShipmentCount: 2, InTransitCount: 0, DeliveredCount: 0}, want: DeliveryStatusReadyToShip},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := nextDeliveryStatusFromProgress(testCase.fulfillmentType, testCase.progress)
			if got != testCase.want {
				t.Fatalf("expected %q, got %q", testCase.want, got)
			}
		})
	}
}

func TestAutoAdvanceToWaitingConfirmationOnAllDelivered(t *testing.T) {
	// When all items are assigned and all active shipments are delivered,
	// nextOrderStatusFromShipmentProgress should advance to waiting_customer_confirmation
	// (not remain at "shipped").
	progress := orderShipmentProgress{
		ActiveShipmentCount:     2,
		ShippableItemCount:      2,
		AssignedItemCount:       2,
		ShippedOrDeliveredCount: 2,
		DeliveredCount:          2,
	}
	got := nextOrderStatusFromShipmentProgress("shipped", PaymentStatusPaid, FulfillmentTypeDelivery, progress)
	if got != OrderStatusWaitingCustomerConfirmation {
		t.Fatalf("expected %q, got %q", OrderStatusWaitingCustomerConfirmation, got)
	}
}

func TestCanRequestCustomerConfirmation(t *testing.T) {
	testCases := []struct {
		name            string
		fulfillmentType string
		progress        orderShipmentProgress
		want            bool
	}{
		{name: "pickup always allowed", fulfillmentType: FulfillmentTypePickup, want: true},
		{name: "digital only order allowed", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{}, want: true},
		{name: "blocked when not all items assigned", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, AssignedItemCount: 1, ActiveShipmentCount: 1, DeliveredCount: 1}, want: false},
		{name: "blocked until all shipments delivered", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, AssignedItemCount: 2, ActiveShipmentCount: 2, DeliveredCount: 1}, want: false},
		{name: "allowed when all shipments delivered", fulfillmentType: FulfillmentTypeDelivery, progress: orderShipmentProgress{ShippableItemCount: 2, AssignedItemCount: 2, ActiveShipmentCount: 2, DeliveredCount: 2}, want: true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := canRequestCustomerConfirmation(testCase.fulfillmentType, testCase.progress); got != testCase.want {
				t.Fatalf("expected %v, got %v", testCase.want, got)
			}
		})
	}
}
