export type Account = {
  id: string;
  bank: string;
  account_number: string;
  owner_name: string;
  is_verified?: boolean;
  is_primary?: boolean;
  business_id?: string | null;
};

export type Business = {
  id: string;
  name?: string;
};

export type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  processed_at?: string;
};

export type PayoutTab = "accounts" | "history";

export const BANK_OPTIONS = ["BCA", "Mandiri", "BRI", "BNI", "Jago", "GoPay", "Other"];
