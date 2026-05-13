import { customerApiRequest } from "../components/customer/auth/authApi";
import { memberGet, memberPost } from "../components/member/businesses/api";
import { adminGet, adminPost } from "../components/admin/entities/adminApi";

export type ComplaintStatus = "open" | "resolved" | "closed";
export type ComplaintSenderType = "customer" | "member" | "admin";

export type ComplaintCase = {
  id: string;
  order_id: string;
  customer_id: string;
  subject: string;
  description: string;
  status: ComplaintStatus | string;
  last_message_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintMessage = {
  id: string;
  complaint_case_id: string;
  sender_type: ComplaintSenderType | string;
  sender_id: string;
  sender_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type ComplaintParticipant = {
  id: string;
  complaint_case_id: string;
  participant_type: ComplaintSenderType | string;
  participant_id: string;
  participant_name: string;
  last_read_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintCaseDetail = {
  case: ComplaintCase;
  messages: ComplaintMessage[];
  participants: ComplaintParticipant[];
};

export type ComplaintCaseListResponse = {
  data: ComplaintCase[];
  total: number;
  limit: number;
  offset: number;
};

export type ComplaintCaseDetailResponse = {
  data: ComplaintCaseDetail;
};

export type ComplaintMessageResponse = {
  data: ComplaintMessage;
};

export type CreateComplaintPayload = {
  order_id: string;
  subject: string;
  body: string;
};

export type AddComplaintMessagePayload = {
  body: string;
};

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

function customerBasePath(path: string): string {
  return `/api/review/complaints${path}`;
}

function memberBasePath(path: string): string {
  return `/api/member/review/complaints${path}`;
}

function adminBasePath(path: string): string {
  return `/admin/review/complaints${path}`;
}

export async function listMyComplaintCases(orderID?: string, params: { limit?: number; offset?: number } = {}): Promise<ComplaintCaseListResponse> {
  const query = buildQuery({ order_id: orderID, limit: params.limit ?? 20, offset: params.offset ?? 0 });
  return customerApiRequest<ComplaintCaseListResponse>(customerBasePath(`?${query}`), { method: "GET" });
}

export async function createMyComplaintCase(payload: CreateComplaintPayload): Promise<ComplaintCaseDetailResponse> {
  return customerApiRequest<ComplaintCaseDetailResponse>(customerBasePath(""), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyComplaintCase(complaintID: string): Promise<ComplaintCaseDetailResponse> {
  return customerApiRequest<ComplaintCaseDetailResponse>(customerBasePath(`/${encodeURIComponent(complaintID)}`), { method: "GET" });
}

export async function addMyComplaintMessage(complaintID: string, body: string): Promise<ComplaintMessageResponse> {
  return customerApiRequest<ComplaintMessageResponse>(customerBasePath(`/${encodeURIComponent(complaintID)}/messages`), {
    method: "POST",
    body: JSON.stringify({ body } satisfies AddComplaintMessagePayload),
  });
}

export async function listMemberComplaintCases(orderID?: string, params: { limit?: number; offset?: number } = {}): Promise<ComplaintCaseListResponse> {
  const query = buildQuery({ order_id: orderID, limit: params.limit ?? 20, offset: params.offset ?? 0 });
  return memberGet<ComplaintCaseListResponse>(memberBasePath(`?${query}`));
}

export async function getMemberComplaintCase(complaintID: string): Promise<ComplaintCaseDetailResponse> {
  return memberGet<ComplaintCaseDetailResponse>(memberBasePath(`/${encodeURIComponent(complaintID)}`));
}

export async function addMemberComplaintMessage(complaintID: string, body: string): Promise<ComplaintMessageResponse> {
  return memberPost<ComplaintMessageResponse>(memberBasePath(`/${encodeURIComponent(complaintID)}/messages`), {
    body,
  });
}

export async function requestMemberComplaintClose(complaintID: string, body = ""): Promise<ComplaintMessageResponse> {
  return memberPost<ComplaintMessageResponse>(memberBasePath(`/${encodeURIComponent(complaintID)}/request-close`), {
    body,
  });
}

export async function listAdminComplaintCases(orderID?: string, params: { limit?: number; offset?: number } = {}): Promise<ComplaintCaseListResponse> {
  const query = buildQuery({ order_id: orderID, limit: params.limit ?? 20, offset: params.offset ?? 0 });
  return adminGet<ComplaintCaseListResponse>(adminBasePath(`?${query}`));
}

export async function getAdminComplaintCase(complaintID: string): Promise<ComplaintCaseDetailResponse> {
  return adminGet<ComplaintCaseDetailResponse>(adminBasePath(`/${encodeURIComponent(complaintID)}`));
}

export async function addAdminComplaintMessage(complaintID: string, body: string): Promise<ComplaintMessageResponse> {
  return adminPost<ComplaintMessageResponse>(adminBasePath(`/${encodeURIComponent(complaintID)}/messages`), {
    body,
  });
}

export async function resolveAdminComplaintCase(complaintID: string): Promise<ComplaintCaseDetailResponse> {
  return adminPost<ComplaintCaseDetailResponse>(adminBasePath(`/${encodeURIComponent(complaintID)}/resolve`));
}

export async function closeAdminComplaintCase(complaintID: string): Promise<ComplaintCaseDetailResponse> {
  return adminPost<ComplaintCaseDetailResponse>(adminBasePath(`/${encodeURIComponent(complaintID)}/close`));
}
