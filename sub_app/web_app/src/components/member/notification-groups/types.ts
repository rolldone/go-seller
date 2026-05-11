export interface NotificationGroupMemberUser {
	id: string;
	full_name: string;
	email: string;
}

export interface NotificationGroupMember {
	id: number;
	group_id: number;
	user_id: string;
	user?: NotificationGroupMemberUser | null;
	created_at: string;
}

export interface MemberNotificationGroup {
	id: number;
	business_id: string;
	name: string;
	event_types: string; // comma-separated
	is_active: boolean;
	members?: NotificationGroupMember[];
	created_at: string;
	updated_at: string;
}

export interface NotificationGroupListResponse {
	data: MemberNotificationGroup[];
}

export interface CreateNotificationGroupPayload {
	name: string;
	member_ids: string[];
	event_types: string[];
}

export interface UpdateNotificationGroupPayload {
	name?: string;
	member_ids?: string[];
	event_types?: string[];
	is_active?: boolean;
}

export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
	order_created: "Order baru dibuat",
	payment_succeeded: "Pembayaran berhasil",
	payment_failed: "Pembayaran gagal",
	withdrawal_requested: "Penarikan dana diajukan",
	withdrawal_approved: "Penarikan dana disetujui",
	withdrawal_rejected: "Penarikan dana ditolak",
	withdrawal_processed: "Penarikan dana diproses",
	settlement_held: "Settlement escrow ditahan",
	settlement_partially_released: "Settlement escrow partial release",
	settlement_released: "Settlement escrow dilepas",
	settlement_refunded: "Settlement escrow direfund",
};
