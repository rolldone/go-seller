import type { Order, OrderItem, OrderShipment, Payment, PaymentProof, OrderExtraCharge } from "../../../lib/orderApi";

export type MemberBusiness = {
	id: string;
	name: string;
	slug: string;
	short_description?: string | null;
};

export type MemberOrderListParams = {
	q?: string;
	status?: string;
	payment_status?: string;
	channel?: string;
	sort?: string;
	page?: number;
	limit?: number;
};

export type MemberOrderListResponse = {
	data: Order[];
	total: number;
};

export type MemberOrderDetailResponse = {
	data: {
		order: Order;
		payments: Payment[];
		business?: MemberBusiness | null;
	};
};

export type MemberShipmentListResponse = {
	data: OrderShipment[];
};

export type MemberShippableItemsResponse = {
	data: OrderItem[];
};

export type MemberOrderInvoiceResponse = Blob;

export type MemberReplaceExtraChargesPayload = {
	charges: Array<{
		name: string;
		amount: number;
		notes?: string;
		sort_order: number;
	}>;
};

export type MemberUpdateShippingQuotePayload = {
	shipping_amount: number;
	carrier_name?: string;
	service_name?: string;
	tracking_number?: string;
	estimated_delivery?: string;
	description?: string;
	notes?: string;
};

export type MemberUpdateShippingAddressPayload = {
	address_id: string;
};

export type MemberCreateShipmentPayload = {
	carrier_name?: string;
	service_name?: string;
	tracking_number?: string;
	shipping_amount?: number;
	estimated_delivery?: string;
	description?: string;
	notes?: string;
	item_ids: string[];
};

export type MemberUpdateShipmentPayload = {
	carrier_name?: string;
	service_name?: string;
	tracking_number?: string;
	shipping_amount?: number;
	estimated_delivery?: string;
	description?: string;
	notes?: string;
	status?: "pending" | "processing" | "ready_to_ship" | "shipped" | "in_transit" | "delivered" | "exception" | "returned" | "cancelled";
};

export type { Order, OrderItem, OrderShipment, Payment, PaymentProof, OrderExtraCharge };