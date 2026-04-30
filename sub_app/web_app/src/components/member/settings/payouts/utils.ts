export const maskAccountNumber = (value: string) => value.replace(/.(?=.{4})/g, "*");

export const formatCurrencyIDR = (value: number) => `IDR ${new Intl.NumberFormat("id-ID").format(Number(value || 0))}`;

export const formatDateTimeID = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
};

export const payoutStatusClass = (status: string) => {
  const normalized = (status || "").toLowerCase();
  if (["succeeded", "success", "paid", "completed"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["processing"].includes(normalized)) {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }
  if (["failed", "rejected", "cancelled", "canceled"].includes(normalized)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
};

export const accountStatusClass = (verified?: boolean) => {
  return verified
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
};
