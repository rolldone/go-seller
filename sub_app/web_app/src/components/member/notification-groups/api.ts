import { memberGet, memberPost, memberPut, memberDelete } from "../businesses/api";
import type {
	MemberNotificationGroup,
	NotificationGroupListResponse,
	CreateNotificationGroupPayload,
	UpdateNotificationGroupPayload,
} from "./types";

export async function listNotificationGroups(
	businessID: string,
): Promise<MemberNotificationGroup[]> {
	const res = await memberGet<NotificationGroupListResponse>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/notification-groups`,
	);
	return res.data ?? [];
}

export async function createNotificationGroup(
	businessID: string,
	payload: CreateNotificationGroupPayload,
): Promise<MemberNotificationGroup> {
	const res = await memberPost<{ data: MemberNotificationGroup }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/notification-groups`,
		payload,
	);
	return res.data;
}

export async function updateNotificationGroup(
	businessID: string,
	id: number,
	payload: UpdateNotificationGroupPayload,
): Promise<MemberNotificationGroup> {
	const res = await memberPut<{ data: MemberNotificationGroup }>(
		`/api/member/businesses/${encodeURIComponent(businessID)}/notification-groups/${id}`,
		payload,
	);
	return res.data;
}

export async function deleteNotificationGroup(
	businessID: string,
	id: number,
): Promise<void> {
	await memberDelete(
		`/api/member/businesses/${encodeURIComponent(businessID)}/notification-groups/${id}`,
	);
}

