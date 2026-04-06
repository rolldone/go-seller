export type NotificationAction = {
  label: string;
  href?: string;
};

type Callback = (payload: { type: "success" | "error" | "info"; message: string; action?: NotificationAction }) => void;

const evt = new EventTarget();

export function notify(type: "success" | "error" | "info", message: string) {
  const e = new CustomEvent("notify", { detail: { type, message } });
  evt.dispatchEvent(e as Event);
}

export function notifyWithAction(type: "success" | "error" | "info", message: string, action: NotificationAction) {
  const e = new CustomEvent("notify", { detail: { type, message, action } });
  evt.dispatchEvent(e as Event);
}

export function notifySuccess(message: string) {
  notify("success", message);
}

export function notifyError(message: string) {
  notify("error", message);
}

export function subscribe(cb: Callback) {
  const handler = (e: Event) => cb((e as CustomEvent).detail);
  evt.addEventListener("notify", handler);
  return () => evt.removeEventListener("notify", handler);
}

export default { notify, notifySuccess, notifyError, subscribe };
