export type PaymentReturnStatus = "finish" | "unfinish" | "error";

const PAYMENT_RETURN_PATHS: Record<PaymentReturnStatus, string> = {
	finish: "/payment/finish",
	unfinish: "/payment/unfinish",
	error: "/payment/error",
};

export function normalizePaymentReturnStatus(value?: string | null): PaymentReturnStatus | null {
	const normalized = String(value || "").trim().toLowerCase();
	if (normalized === "finish" || normalized === "unfinish" || normalized === "error") {
		return normalized;
	}
	return null;
}

export function buildPaymentReturnPath(status: PaymentReturnStatus): string {
	return PAYMENT_RETURN_PATHS[status];
}

export function buildPaymentFinishUrl(origin: string): string {
	return new URL(buildPaymentReturnPath("finish"), origin).toString();
}

export function resolvePaymentReturnPaymentID(searchParams: URLSearchParams): string {
	return String(searchParams.get("payment_id") || searchParams.get("order_id") || "").trim();
}

export function buildPaymentConfirmationPath(
	paymentID?: string | null,
	orderID?: string | null,
	status?: PaymentReturnStatus | null,
): string {
	const params = new URLSearchParams();
	const normalizedPaymentID = String(paymentID || "").trim();
	if (normalizedPaymentID) {
		params.set("payment_id", normalizedPaymentID);
	}
	const normalizedOrderID = String(orderID || "").trim();
	if (normalizedOrderID) {
		params.set("order_id", normalizedOrderID);
	}
	const normalizedStatus = normalizePaymentReturnStatus(status);
	if (normalizedStatus) {
		params.set("payment_status", normalizedStatus);
	}
	const query = params.toString();
	return query ? `/order/confirmed?${query}` : "/order/confirmed";
}

export function buildPaymentReturnRedirectPath(status: PaymentReturnStatus, searchParams: URLSearchParams): string {
	return buildPaymentConfirmationPath(resolvePaymentReturnPaymentID(searchParams), null, status);
}