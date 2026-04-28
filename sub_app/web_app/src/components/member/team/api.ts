import { memberDelete, memberGet, memberPatch, memberPost } from "../businesses/api";
import type { TeamInvitePayload, TeamListParams, TeamListResponse, TeamMember, TeamRolePayload, TeamStatusPayload } from "./types";

export async function listBusinessTeamMembers(businessID: string, params: TeamListParams): Promise<TeamListResponse> {
	const query = new URLSearchParams();
	if (params.status && params.status !== "all") {
		query.set("status", params.status);
	}
	query.set("page", String(params.page));
	query.set("limit", String(params.limit));
	return memberGet<TeamListResponse>(`/api/member/businesses/${encodeURIComponent(businessID)}/team/members?${query.toString()}`);
}

export async function inviteBusinessTeamMember(businessID: string, payload: TeamInvitePayload): Promise<TeamMember> {
	const response = await memberPost<{ data: TeamMember }>(`/api/member/businesses/${encodeURIComponent(businessID)}/team/members/invite`, payload);
	return response.data;
}

export async function updateBusinessTeamMemberStatus(businessID: string, memberID: string, payload: TeamStatusPayload): Promise<TeamMember> {
	const response = await memberPatch<{ data: TeamMember }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/team/members/${encodeURIComponent(memberID)}/status`,
		payload,
	);
	return response.data;
}

export async function updateBusinessTeamMemberRole(businessID: string, memberID: string, payload: TeamRolePayload): Promise<TeamMember> {
	const response = await memberPatch<{ data: TeamMember }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/team/members/${encodeURIComponent(memberID)}/role`,
		payload,
	);
	return response.data;
}

export async function deleteBusinessTeamMember(businessID: string, memberID: string): Promise<void> {
	await memberDelete(`/api/member/businesses/${encodeURIComponent(businessID)}/team/members/${encodeURIComponent(memberID)}`);
}