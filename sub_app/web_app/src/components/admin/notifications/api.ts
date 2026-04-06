import { adminPost } from "../entities/adminApi";

export type NotificationLocale = "id" | "en";

export type TestNotificationPayload = {
  to: string;
  locale: NotificationLocale;
  vars?: Record<string, string>;
};

export type TestNotificationResponse = {
  template_id: string;
  sent_to: string;
  locale: NotificationLocale;
  subject: string;
  body: string;
  html_body: string;
  timestamp: string;
};

export async function testNotificationTemplate(
  templateId: string,
  payload: TestNotificationPayload,
): Promise<TestNotificationResponse> {
  return adminPost<TestNotificationResponse>(`/admin/notifications/${encodeURIComponent(templateId)}/test`, payload);
}
