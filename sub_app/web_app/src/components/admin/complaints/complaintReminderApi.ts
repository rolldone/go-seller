import { adminGet } from "../entities/adminApi";

export type ComplaintReminderLog = {
	id: string;
	reminder_key: string;
	complaint_case_id: string;
	order_id: string;
	order_number: string;
	complaint_subject: string;
	sender_type: string;
	recipient_type: string;
	recipient_ref_id: string;
	recipient_label: string;
	recipient_emails: string;
	expected_last_message_at: string;
	due_at: string;
	status: string;
	attempt_count: number;
	last_error?: string | null;
	skip_reason?: string | null;
	sent_at?: string | null;
	skipped_at?: string | null;
	next_run_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type ComplaintReminderLogListResponse = {
	data: ComplaintReminderLog[];
	total: number;
	page: number;
	limit: number;
};

function buildQuery(params: Record<string, string | number | undefined | null>): string {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		query.set(key, String(value));
	}
	return query.toString();
}

export async function listComplaintReminderLogs(params: {
	status?: string;
	recipient_type?: string;
	sender_type?: string;
	order_id?: string;
	complaint_case_id?: string;
	q?: string;
	page?: number;
	limit?: number;
} = {}): Promise<ComplaintReminderLogListResponse> {
	const query = buildQuery({
		status: params.status,
		recipient_type: params.recipient_type,
		sender_type: params.sender_type,
		order_id: params.order_id,
		complaint_case_id: params.complaint_case_id,
		q: params.q,
		page: params.page ?? 1,
		limit: params.limit ?? 20,
	});
	const suffix = query ? `?${query}` : "";
	return adminGet<ComplaintReminderLogListResponse>(`/admin/review/complaint-reminders${suffix}`);
}