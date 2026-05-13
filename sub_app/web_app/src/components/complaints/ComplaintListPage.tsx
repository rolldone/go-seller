import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquareText, Plus } from "lucide-react";
import {
  listAdminComplaintCases,
  listMemberComplaintCases,
  listMyComplaintCases,
  type ComplaintCase,
} from "../../lib/complaintApi";
import { buildLocalizedPath } from "../../lib/siteLocale";
import { notifyError } from "../../lib/notification";

type ComplaintScope = "customer" | "member" | "admin";

type Props = {
  scope: ComplaintScope;
  orderID?: string;
  backHref: string;
  title: string;
  subtitle?: string;
  locale?: string;
};

const scopeLabelMap: Record<ComplaintScope, string> = {
  customer: "Customer",
  member: "Member",
  admin: "Admin",
};

const scopeAccentMap: Record<ComplaintScope, string> = {
  customer: "from-rose-500 via-amber-400 to-orange-300",
  member: "from-sky-500 via-cyan-400 to-teal-300",
  admin: "from-slate-800 via-slate-700 to-slate-500",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function caseStatusMeta(status?: string | null): { label: string; className: string } {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "open") return { label: "Open", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (normalized === "resolved") return { label: "Resolved", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (normalized === "closed") return { label: "Closed", className: "border-slate-200 bg-slate-100 text-slate-700" };
  return { label: normalized || "-", className: "border-slate-200 bg-slate-100 text-slate-700" };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

async function fetchComplaintCases(scope: ComplaintScope, orderID?: string): Promise<{ data: ComplaintCase[]; total: number; limit: number; offset: number }> {
  switch (scope) {
    case "customer":
      return listMyComplaintCases(orderID);
    case "member":
      return listMemberComplaintCases(orderID);
    case "admin":
      return listAdminComplaintCases(orderID);
  }
  throw new Error("Unsupported complaint scope");
}

function complaintThreadHref(scope: ComplaintScope, complaint: ComplaintCase, locale?: string): string {
  const query = `complaint_id=${encodeURIComponent(complaint.id)}`;
  switch (scope) {
    case "customer":
      return buildLocalizedPath(`/order/${encodeURIComponent(complaint.order_id)}/complaints?${query}`, locale);
    case "member":
      return `/member/orders/${encodeURIComponent(complaint.order_id)}/complaints?${query}`;
    case "admin":
      return `/admin/orders/${encodeURIComponent(complaint.order_id)}/complaints?${query}`;
  }
}

export default function ComplaintListPage({ scope, orderID, backHref, title, subtitle, locale }: Props) {
  const [cases, setCases] = useState<ComplaintCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const scopeLabel = scopeLabelMap[scope];
  const accentClass = scopeAccentMap[scope];
  const activeOrderID = orderID?.trim() || "";
  const createThreadHref =
    scope === "customer" && activeOrderID
      ? buildLocalizedPath(`/order/${encodeURIComponent(activeOrderID)}/complaints`, locale)
      : "";
  const openCount = useMemo(() => cases.filter((item) => String(item.status || "").toLowerCase() === "open").length, [cases]);
  const resolvedCount = useMemo(() => cases.filter((item) => String(item.status || "").toLowerCase() === "resolved").length, [cases]);
  const closedCount = useMemo(() => cases.filter((item) => String(item.status || "").toLowerCase() === "closed").length, [cases]);

  useEffect(() => {
    let cancelled = false;

    const loadCases = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const payload = await fetchComplaintCases(scope, activeOrderID || undefined);
        if (!cancelled) {
          setCases(payload.data || []);
        }
      } catch (err) {
        const message = extractErrorMessage(err, "Gagal memuat daftar complaint");
        if (!cancelled) {
          setErrorMessage(message);
          setCases([]);
        }
        notifyError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadCases();
    return () => {
      cancelled = true;
    };
  }, [activeOrderID, scope]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(255,247,237,1)_40%,_rgba(248,250,252,1)_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center gap-3">
            <a
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
            >
              <ArrowLeft size={16} />
              Back
            </a>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Complaint List</div>
              <h1 className="text-lg font-semibold text-slate-950 sm:text-2xl">{title}</h1>
              {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
            </div>
          </div>
          <div className={`rounded-2xl bg-gradient-to-r ${accentClass} px-4 py-2 text-white shadow-lg shadow-slate-200`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">Scope</div>
            <div className="text-sm font-semibold">{scopeLabel}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Summary</h2>
                <p className="text-sm text-slate-600">Ringkasan complaint yang terlihat dari scope ini.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 p-5 text-center">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4">
                  <div className="text-lg font-semibold text-slate-950">{cases.length}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Total</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-4">
                  <div className="text-lg font-semibold text-amber-700">{openCount}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-amber-700/80">Open</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-4">
                  <div className="text-lg font-semibold text-emerald-700">{resolvedCount + closedCount}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-emerald-700/80">Done</div>
                </div>
              </div>
            </section>

            {scope === "customer" && activeOrderID && createThreadHref ? (
              <section className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-[0_20px_60px_rgba(244,114,182,0.08)]">
                <div className="border-b border-rose-100 bg-gradient-to-r from-rose-500 via-amber-400 to-orange-300 px-5 py-4 text-white">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                    <Plus size={14} />
                    New complaint
                  </div>
                  <div className="mt-2 text-lg font-semibold">Mulai thread baru</div>
                  <p className="mt-1 text-sm text-white/90">Buat complaint untuk order ini jika belum ada thread yang sesuai.</p>
                </div>
                <div className="p-5">
                  <a
                    href={createThreadHref}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <MessageSquareText size={16} className="mr-2" />
                    Buka thread complaint
                  </a>
                </div>
              </section>
            ) : null}
          </aside>

          <section className="space-y-4">
            {activeOrderID ? (
              <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Filter</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium">Order {activeOrderID}</span>
                  <span className="text-slate-500">Menampilkan complaint untuk order ini.</span>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">Loading complaint list...</div>
            ) : errorMessage ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-[0_20px_60px_rgba(244,114,182,0.08)]">{errorMessage}</div>
            ) : cases.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                {activeOrderID ? "Belum ada complaint untuk order ini." : "Belum ada complaint yang bisa ditampilkan."}
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((item) => {
                  const status = caseStatusMeta(item.status);
                  return (
                    <a
                      key={item.id}
                      href={complaintThreadHref(scope, item, locale)}
                      className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_72px_rgba(15,23,42,0.09)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MessageSquareText size={16} className="text-slate-400" />
                            <h3 className="truncate text-base font-semibold text-slate-950">{item.subject}</h3>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">Order {item.order_id}</span>
                            <span>{formatDateTime(item.last_message_at || item.created_at)}</span>
                            <span className="truncate">{item.id}</span>
                          </div>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}>
                          {status.label}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}