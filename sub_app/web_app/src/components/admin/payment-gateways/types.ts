export type PaymentGatewayProvider = {
  id: string;
  name: string;
  provider_key: string;
  is_active: boolean;
  is_used: boolean;
  config?: Record<string, unknown> | null;
  credentials_encrypted?: string | null;
  created_at: string;
  updated_at: string;
};

export type ValidateGatewayPayload = {
  provider_key: string;
  credentials: Record<string, unknown>;
};

export type ValidateGatewayResult = {
  valid: boolean;
  message?: string;
};

export type GatewayTransactionLog = {
  id: string;
  business_id?: string;
  provider_key: string;
  direction: "inbound" | "outbound";
  event_type: "webhook" | "create_payment" | "get_status" | "refund";
  reference_id?: string;
  provider_transaction_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  error_message?: string;
  ip_address?: string;
  created_at: string;
};

export type LogListResponse = {
  data: GatewayTransactionLog[];
  total: number;
  page: number;
  per_page: number;
};

