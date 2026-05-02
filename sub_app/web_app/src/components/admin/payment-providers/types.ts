export type PaymentProvider = {
  id: string;
  business_id?: string | null;
  name: string;
  provider_key: string;
  is_active: boolean;
  is_used: boolean;
  config?: Record<string, unknown> | null;
  credentials_encrypted?: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = {
  id: string;
  business_id?: string | null;
  provider_id: string;
  name: string;
  code: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
  provider?: PaymentProvider | null;
};

export type PaymentReconciliationItem = {
  payment_id: string;
  order_id: string;
  order_number: string;
  business_id?: string | null;
  provider_key?: string | null;
  status: string;
  order_payment_status: string;
  amount: number;
  currency: string;
  provider_transaction_id?: string | null;
  external_reference?: string | null;
  reconciled_at?: string | null;
  updated_at: string;
  is_mismatch: boolean;
};

export type PaymentReconciliationSummary = {
  total: number;
  mismatch_count: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
};
