export type TeamInviteRole = "fulfillment" | "finance" | "cs";

export type TeamMemberStatus = "active" | "invited" | "suspended";

export type TeamMemberUser = {
	id: string;
	full_name: string;
	email: string;
	phone_number?: string | null;
	is_active?: boolean;
	is_banned?: boolean;
};

export type TeamMember = {
	id: string;
	business_id: string;
	user_id: string;
	is_owner: boolean;
	role?: string | null;
	status: TeamMemberStatus | string;
	invited_at?: string | null;
	status_changed_at?: string | null;
	suspended_at?: string | null;
	suspension_reason?: string | null;
	invited_by?: string | null;
	created_at: string;
	updated_at: string;
	user?: TeamMemberUser | null;
};

export type TeamListResponse = {
	data: TeamMember[];
	total: number;
	page?: number;
	limit?: number;
};

export type TeamInvitePayload = {
	email: string;
	role?: TeamInviteRole | null;
};

export type TeamStatusPayload = {
	status: TeamMemberStatus;
	reason?: string | null;
};

export type TeamRolePayload = {
	role: TeamInviteRole;
};

export type TeamListParams = {
	status?: string;
	page: number;
	limit: number;
};