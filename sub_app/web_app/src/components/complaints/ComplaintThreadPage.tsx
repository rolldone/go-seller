import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquareText, Send, Sparkles, Plus } from "lucide-react";
import {
  addAdminComplaintMessage,
  addMemberComplaintMessage,
  addMyComplaintMessage,
  closeAdminComplaintCase,
  createMyComplaintCase,
  getAdminComplaintCase,
  getMemberComplaintCase,
  getMyComplaintCase,
  listAdminComplaintCases,
  listMemberComplaintCases,
  listMyComplaintCases,
  resolveAdminComplaintCase,
  requestMemberComplaintClose,
  type ComplaintCase,
  type ComplaintCaseDetail,
  type ComplaintMessage,
} from "../../lib/complaintApi";
import { notifyError, notifySuccess } from "../../lib/notification";

type ComplaintScope = "customer" | "member" | "admin";

type Props = {
  scope: ComplaintScope;
  orderID: string;
  backHref: string;
  title: string;
  subtitle?: string;
};

type EmptyCaseForm = {
  subject: string;
  body: string;
};

const emptyCaseForm: EmptyCaseForm = {
  subject: "",
  body: "",
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

const senderLabelMap: Record<string, string> = {
  customer: "Customer",
  member: "Member",
  admin: "Admin",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCaseStatus(status?: string | null): { label: string; className: string } {
  const key = String(status || "").trim().toLowerCase();
  if (key === "open") return { label: "Open", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (key === "resolved") return { label: "Resolved", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (key === "closed") return { label: "Closed", className: "border-slate-200 bg-slate-100 text-slate-700" };
  return { label: key || "-", className: "border-slate-200 bg-slate-100 text-slate-700" };
}

function formatSenderType(senderType?: string | null): string {
  const key = String(senderType || "").trim().toLowerCase();
  return senderLabelMap[key] || key || "Unknown";
}

function messageBubbleClass(senderType?: string | null): string {
  const key = String(senderType || "").trim().toLowerCase();
  if (key === "admin") return "border-slate-200 bg-slate-50";
  if (key === "member") return "border-sky-200 bg-sky-50";
  return "border-rose-200 bg-white";
}

function senderDotClass(senderType?: string | null): string {
  const key = String(senderType || "").trim().toLowerCase();
  if (key === "admin") return "bg-slate-700";
  if (key === "member") return "bg-sky-500";
  return "bg-rose-500";
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

async function fetchComplaintCases(scope: ComplaintScope, orderID: string): Promise<{ data: ComplaintCase[]; total: number; limit: number; offset: number }> {
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

async function fetchComplaintDetail(scope: ComplaintScope, complaintID: string): Promise<ComplaintCaseDetail> {
  switch (scope) {
    case "customer":
      return (await getMyComplaintCase(complaintID)).data;
    case "member":
      return (await getMemberComplaintCase(complaintID)).data;
    case "admin":
      return (await getAdminComplaintCase(complaintID)).data;
  }
  throw new Error("Unsupported complaint scope");
}

async function sendComplaintMessage(scope: ComplaintScope, complaintID: string, body: string): Promise<ComplaintMessage> {
  switch (scope) {
    case "customer":
      return (await addMyComplaintMessage(complaintID, body)).data;
    case "member":
      return (await addMemberComplaintMessage(complaintID, body)).data;
    case "admin":
      return (await addAdminComplaintMessage(complaintID, body)).data;
  }
  throw new Error("Unsupported complaint scope");
}

async function requestComplaintClose(scope: ComplaintScope, complaintID: string, body: string): Promise<ComplaintMessage> {
  switch (scope) {
    case "member":
      return (await requestMemberComplaintClose(complaintID, body)).data;
    default:
      throw new Error("Only member can request close");
  }
}

async function createComplaintCase(payload: { orderID: string; subject: string; body: string }): Promise<ComplaintCaseDetail> {
  return (await createMyComplaintCase({ order_id: payload.orderID, subject: payload.subject, body: payload.body })).data;
}

export default function ComplaintThreadPage({ scope, orderID, backHref, title, subtitle }: Props) {
  const [cases, setCases] = useState<ComplaintCase[]>([]);
  const [selectedCaseID, setSelectedCaseID] = useState("");
  const [detail, setDetail] = useState<ComplaintCaseDetail | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [caseForm, setCaseForm] = useState<EmptyCaseForm>(emptyCaseForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [noteMessage, setNoteMessage] = useState("");

  const scopeLabel = scopeLabelMap[scope];
  const accentClass = scopeAccentMap[scope];
  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseID) || null, [cases, selectedCaseID]);
  const canCreateCase = scope === "customer";
  const canReply = Boolean(detail && detail.case.status !== "closed");
  const visibleMessages = useMemo(() => {
    if (!detail) return [];
    if (scope === "customer") {
      return detail.messages.filter((message) => !message.is_internal);
    }
    return detail.messages;
  }, [detail, scope]);
  const openCaseCount = cases.filter((item) => String(item.status || "").toLowerCase() === "open").length;
  const resolvedCaseCount = cases.filter((item) => String(item.status || "").toLowerCase() === "resolved").length;

  const refreshCases = async (preferredCaseID = "") => {
    setLoadingCases(true);
    setErrorMessage("");
    try {
      const payload = await fetchComplaintCases(scope, orderID);
      const nextCases = payload.data || [];
      setCases(nextCases);
      const nextSelected =
        preferredCaseID && nextCases.some((item) => item.id === preferredCaseID)
          ? preferredCaseID
          : nextCases[0]?.id || "";
      setSelectedCaseID(nextSelected);
      if (!nextSelected) {
        setDetail(null);
      }
      return nextSelected;
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal memuat complaint thread");
      setErrorMessage(message);
      notifyError(message);
      setCases([]);
      setSelectedCaseID("");
      setDetail(null);
      return "";
    } finally {
      setLoadingCases(false);
    }
  };

  const refreshDetail = async (complaintID: string) => {
    if (!complaintID) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setErrorMessage("");
    try {
      const nextDetail = await fetchComplaintDetail(scope, complaintID);
      setDetail(nextDetail);
      setMessageBody("");
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal memuat detail complaint");
      setErrorMessage(message);
      notifyError(message);
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const initialComplaintID = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("complaint_id")?.trim() || "";
    void (async () => {
      await refreshCases(initialComplaintID);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderID, scope]);

  useEffect(() => {
    if (!selectedCaseID) {
      setDetail(null);
      return;
    }
    if (detail?.case.id === selectedCaseID) {
      return;
    }
    void refreshDetail(selectedCaseID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseID]);

  const handleSelectCase = (complaintID: string) => {
    setSelectedCaseID(complaintID);
    setNoteMessage("");
  };

  const handleCreateCase = async () => {
    if (!canCreateCase) return;
    const subject = caseForm.subject.trim();
    const body = caseForm.body.trim();
    if (!subject) {
      notifyError("Subject complaint wajib diisi.");
      return;
    }
    if (!body) {
      notifyError("Isi complaint wajib diisi.");
      return;
    }

    setCreatingCase(true);
    setErrorMessage("");
    try {
      const created = await createComplaintCase({ orderID, subject, body });
      notifySuccess("Complaint thread berhasil dibuat.");
      setCaseForm(emptyCaseForm);
      await refreshCases(created.case.id);
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal membuat complaint thread");
      setErrorMessage(message);
      notifyError(message);
    } finally {
      setCreatingCase(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedCaseID || !canReply) return;
    const body = messageBody.trim();
    if (!body) {
      notifyError("Pesan tidak boleh kosong.");
      return;
    }

    setSendingMessage(true);
    setErrorMessage("");
    try {
      await sendComplaintMessage(scope, selectedCaseID, body);
      notifySuccess("Pesan terkirim.");
      setMessageBody("");
      await refreshDetail(selectedCaseID);
      await refreshCases(selectedCaseID);
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal mengirim pesan complaint");
      setErrorMessage(message);
      notifyError(message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRequestClose = async () => {
    if (scope !== "member" || !selectedCaseID || !canReply) return;
    setSendingMessage(true);
    setErrorMessage("");
    try {
      await requestComplaintClose(scope, selectedCaseID, "");
      notifySuccess("Request close terkirim ke admin.");
      await refreshDetail(selectedCaseID);
      await refreshCases(selectedCaseID);
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal mengirim request close");
      setErrorMessage(message);
      notifyError(message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleResolveCase = async (action: "resolve" | "close") => {
    if (scope !== "admin" || !selectedCaseID) return;
    setNoteMessage("");
    setErrorMessage("");
    try {
      if (action === "resolve") {
        await resolveAdminComplaintCase(selectedCaseID);
        notifySuccess("Complaint marked as resolved.");
      } else {
        await closeAdminComplaintCase(selectedCaseID);
        notifySuccess("Complaint closed.");
      }
      await refreshCases(selectedCaseID);
      await refreshDetail(selectedCaseID);
    } catch (err) {
      const message = extractErrorMessage(err, "Gagal memperbarui status complaint");
      setErrorMessage(message);
      notifyError(message);
    }
  };

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
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Complaint Thread</div>
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
            {canCreateCase ? (
              <section className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-[0_20px_60px_rgba(244,114,182,0.08)]">
                <div className="border-b border-rose-100 bg-gradient-to-r from-rose-500 via-amber-400 to-orange-300 px-5 py-4 text-white">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                    <Plus size={14} />
                    New complaint
                  </div>
                  <div className="mt-2 text-lg font-semibold">Mulai thread baru</div>
                  <p className="mt-1 text-sm text-white/90">Pakai subject order sebagai judul diskusi, lalu jelaskan masalah secara singkat dan jelas.</p>
                </div>
                <div className="space-y-4 p-5">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
                    <input
                      value={caseForm.subject}
                      onChange={(event) => setCaseForm((current) => ({ ...current, subject: event.target.value }))}
                      placeholder="Contoh: Barang tidak sesuai deskripsi"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Complaint</span>
                    <textarea
                      value={caseForm.body}
                      onChange={(event) => setCaseForm((current) => ({ ...current, body: event.target.value }))}
                      placeholder="Tulis kronologi, bukti, dan harapan penyelesaian."
                      className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleCreateCase()}
                    disabled={creatingCase}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingCase ? <Sparkles size={16} className="animate-pulse" /> : <MessageSquareText size={16} />}
                    {creatingCase ? "Creating..." : "Create complaint"}
                  </button>
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Threads</h2>
                  <p className="text-sm text-slate-600">{cases.length} complaint case untuk order ini</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Open: {openCaseCount}</div>
                  <div>Resolved: {resolvedCaseCount}</div>
                </div>
              </div>

              <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
                {loadingCases ? (
                  <div className="p-5 text-sm text-slate-500">Loading complaint cases...</div>
                ) : cases.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">
                    Belum ada complaint untuk order ini.
                    {canCreateCase ? <div className="mt-1 text-xs text-slate-400">Gunakan panel di atas untuk membuka thread pertama.</div> : null}
                  </div>
                ) : (
                  cases.map((item) => {
                    const status = formatCaseStatus(item.status);
                    const isSelected = item.id === selectedCaseID;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectCase(item.id)}
                        className={`block w-full p-4 text-left transition ${isSelected ? "bg-rose-50/70" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">{item.subject}</div>
                            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}>{status.label}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{formatDateTime(item.last_message_at || item.created_at)}</span>
                          <span className="truncate">{item.id}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 px-5 py-4">
                {selectedCase ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        <MessageSquareText size={14} />
                        Active thread
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">{selectedCase.subject}</h2>
                      <p className="mt-1 max-w-3xl text-sm text-slate-600">{selectedCase.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {scope === "admin" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleResolveCase("resolve")}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleResolveCase("close")}
                            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Close
                          </button>
                        </>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${formatCaseStatus(selectedCase.status).className}`}>{formatCaseStatus(selectedCase.status).label}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      <MessageSquareText size={14} />
                      Active thread
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">Pilih thread untuk melihat percakapan</h2>
                    <p className="mt-1 text-sm text-slate-600">{cases.length === 0 ? "Belum ada thread untuk order ini." : "Klik salah satu complaint case di sisi kiri."}</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                {loadingDetail ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading thread detail...</div>
                ) : detail ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</div>
                        <div className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(detail.case.created_at)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last message</div>
                        <div className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(detail.case.last_message_at || detail.case.updated_at)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread ID</div>
                        <div className="mt-2 truncate text-sm font-medium text-slate-900">{detail.case.id}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {visibleMessages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Belum ada pesan di thread ini.</div>
                      ) : (
                        visibleMessages.map((message) => (
                          <article key={message.id} className={`rounded-3xl border p-4 shadow-sm ${messageBubbleClass(message.sender_type)}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${senderDotClass(message.sender_type)}`} />
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{message.sender_name}</div>
                                  <div className="text-xs text-slate-500">{formatSenderType(message.sender_type)}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                {message.is_internal ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-700">Internal</span>
                                ) : null}
                                <span>{formatDateTime(message.created_at)}</span>
                              </div>
                            </div>
                            <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.body}</div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Reply</div>
                          <p className="mt-1 text-sm text-slate-600">Balas thread untuk menambahkan konteks, bukti, atau keputusan penyelesaian.</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${formatCaseStatus(detail.case.status).className}`}>{formatCaseStatus(detail.case.status).label}</span>
                      </div>
                      <label className="mt-4 block text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Message</span>
                        <textarea
                          value={messageBody}
                          onChange={(event) => setMessageBody(event.target.value)}
                          disabled={!canReply || sendingMessage}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                          placeholder={canReply ? "Tulis pesan di thread ini..." : "Thread sudah closed."}
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleSendMessage()}
                            disabled={!canReply || sendingMessage}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Send size={16} />
                            {sendingMessage ? "Sending..." : "Send message"}
                          </button>
                          {scope === "member" ? (
                            <button
                              type="button"
                              onClick={() => void handleRequestClose()}
                              disabled={!canReply || sendingMessage}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Request Close to Admin
                            </button>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {canReply ? "Pesan tersimpan sebagai bagian dari thread pribadi order ini." : "Thread closed tidak menerima balasan baru."}
                          {scope === "member" ? " Request close akan masuk sebagai catatan internal ke admin." : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    {errorMessage || noteMessage || "Belum ada thread yang dipilih."}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Order reference</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{orderID}</div>
                <p className="mt-1 text-sm text-slate-600">Thread ini hanya terkait dengan order yang sedang dibuka.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Messages</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{detail?.messages.length || 0}</div>
                <p className="mt-1 text-sm text-slate-600">Jumlah pesan yang sudah tercatat di complaint thread ini.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Participants</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{detail?.participants.length || 0}</div>
                <p className="mt-1 text-sm text-slate-600">Customer, member, dan admin yang tercatat di thread ini.</p>
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}
