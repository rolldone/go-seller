import React, { useEffect, useMemo, useState } from "react";

import { memberDelete, memberGet, memberPost, memberPut } from "../businesses/api";
import AddBankAccountModal from "./payouts/AddBankAccountModal";
import BankAccountsPanel from "./payouts/BankAccountsPanel";
import PayoutHistoryPanel from "./payouts/PayoutHistoryPanel";
import PayoutTabs from "./payouts/PayoutTabs";
import PayoutsHeader from "./payouts/PayoutsHeader";
import RequestPayoutModal from "./payouts/RequestPayoutModal";
import type { Account, Business, Payout, PayoutTab } from "./payouts/types";

export default function PayoutsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedBusinessID, setSelectedBusinessID] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PayoutTab>("accounts");
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [requestPayoutOpen, setRequestPayoutOpen] = useState(false);
  const [requestAccountID, setRequestAccountID] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBusinessName = useMemo(() => {
    return businesses.find((item) => item.id === selectedBusinessID)?.name || "-";
  }, [businesses, selectedBusinessID]);

  useEffect(() => {
    void fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBusinessID) return;
    void fetchAccounts(selectedBusinessID);
    void fetchPayouts(selectedBusinessID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessID]);

  const fetchInitial = async () => {
    setLoading(true);
    setError(null);
    try {
      const businessResponse = await memberGet<{ data: Business[] }>("/api/member/businesses?page=1&limit=500");
      const nextBusinesses = (businessResponse as any)?.data || [];
      setBusinesses(nextBusinesses);

      const firstBusinessID = nextBusinesses[0]?.id || null;
      setSelectedBusinessID(firstBusinessID);

      if (firstBusinessID) {
        await Promise.all([fetchAccounts(firstBusinessID), fetchPayouts(firstBusinessID)]);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async (businessID: string) => {
    try {
      const response = await memberGet<{ data: Account[] }>(
        `/api/member/businesses/${encodeURIComponent(businessID)}/bank-accounts`,
      );
      const data = (response as any)?.data || [];
      const normalized = (data || []).map((item: any) => ({
        id: item.id,
        bank: item.bank,
        account_number: item.account_number || item.accountNumber || "",
        owner_name: item.owner_name || item.ownerName || "",
        is_verified: !!(item.is_verified || item.verified),
        is_primary: !!item.is_primary,
        business_id: item.business_id || item.businessID || null,
      }));
      setAccounts(normalized);
      if (normalized.length === 0) {
        setRequestAccountID(null);
      } else if (!requestAccountID || !normalized.some((item: Account) => item.id === requestAccountID)) {
        setRequestAccountID(normalized[0].id);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const fetchPayouts = async (businessID: string) => {
    try {
      const response = await memberGet<{ data: Payout[] }>(
        `/api/member/businesses/${encodeURIComponent(businessID)}/payouts`,
      );
      const data = (response as any)?.data || [];
      const normalized = (data || []).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount || 0),
        currency: item.currency || "IDR",
        status: item.status,
        created_at: item.created_at || item.createdAt,
        processed_at: item.processed_at,
      }));
      setPayouts(normalized);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const handleAddAccount = async (payload: { businessID: string; bank: string; accountNumber: string; ownerName: string }) => {
    setLoading(true);
    setError(null);
    try {
      await memberPost(`/api/member/businesses/${encodeURIComponent(payload.businessID)}/bank-accounts`, {
        bank: payload.bank,
        account_number: payload.accountNumber,
        owner_name: payload.ownerName,
      });
      setAddAccountOpen(false);
      setSelectedBusinessID(payload.businessID);
      await fetchAccounts(payload.businessID);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountID: string) => {
    if (!confirm("Hapus rekening ini?")) return;
    setLoading(true);
    setError(null);
    try {
      const account = accounts.find((item) => item.id === accountID);
      const businessID = account?.business_id || selectedBusinessID;
      if (!businessID) throw new Error("Business ID tidak diketahui");
      await memberDelete(
        `/api/member/businesses/${encodeURIComponent(businessID)}/bank-accounts/${encodeURIComponent(accountID)}`,
      );
      await fetchAccounts(businessID);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (accountID: string) => {
    setLoading(true);
    setError(null);
    try {
      const account = accounts.find((item) => item.id === accountID);
      const businessID = account?.business_id || selectedBusinessID;
      if (!businessID) throw new Error("Business ID tidak diketahui");
      await memberPut(
        `/api/member/businesses/${encodeURIComponent(businessID)}/bank-accounts/${encodeURIComponent(accountID)}`,
        { is_primary: true },
      );
      await fetchAccounts(businessID);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (payload: { accountID: string; amount: number }) => {
    setLoading(true);
    setError(null);
    try {
      const account = accounts.find((item) => item.id === payload.accountID);
      const businessID = account?.business_id || selectedBusinessID;
      if (!businessID) throw new Error("Business ID tidak diketahui");

      await memberPost(`/api/member/businesses/${encodeURIComponent(businessID)}/payouts`, {
        bank_account_id: payload.accountID,
        amount: payload.amount,
        currency: "IDR",
      });

      setRequestPayoutOpen(false);
      setRequestAccountID(payload.accountID);
      await fetchPayouts(businessID);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const openRequestModal = (accountID?: string) => {
    if (accounts.length === 0) {
      setActiveTab("accounts");
      setError("Belum ada rekening untuk toko ini. Tambahkan rekening dulu.");
      return;
    }
    const fallbackID = accountID || accounts[0]?.id || null;
    setRequestAccountID(fallbackID);
    setRequestPayoutOpen(true);
  };

  return (
    <div className="space-y-6">
      <PayoutsHeader selectedBusinessName={selectedBusinessName} accountCount={accounts.length} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-[24px] border border-[#eadfce] bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Konfigurasi Payout</h3>
            <p className="mt-1 text-sm text-slate-500">Tab untuk rekening dan riwayat, dengan form melalui modal.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              value={selectedBusinessID || ""}
              onChange={(event) => setSelectedBusinessID(event.target.value || null)}
            >
              <option value="">Pilih toko</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name || business.id}</option>
              ))}
            </select>

            <button
              type="button"
              className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              onClick={() => setAddAccountOpen(true)}
            >
              Tambah Rekening
            </button>

            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => openRequestModal()}
            >
              Request Payout
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Rekomendasi proses instan: <span className="font-semibold text-slate-800">BCA, Mandiri, BRI, BNI, Jago, GoPay</span>. Nama pemilik rekening harus sesuai data toko.
        </div>
      </section>

      <div className="flex items-center justify-between">
        <PayoutTabs value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "accounts" ? (
        <BankAccountsPanel
          accounts={accounts}
          loading={loading}
          onDelete={(id) => void handleDeleteAccount(id)}
          onSetPrimary={(id) => void handleSetPrimary(id)}
          onRequestPayout={(id) => openRequestModal(id)}
        />
      ) : (
        <PayoutHistoryPanel payouts={payouts} />
      )}

      <AddBankAccountModal
        open={addAccountOpen}
        businesses={businesses}
        defaultBusinessID={selectedBusinessID}
        submitting={loading}
        onClose={() => setAddAccountOpen(false)}
        onSubmit={handleAddAccount}
      />

      <RequestPayoutModal
        open={requestPayoutOpen}
        accounts={accounts}
        initialAccountID={requestAccountID}
        submitting={loading}
        onClose={() => setRequestPayoutOpen(false)}
        onSubmit={handleRequestPayout}
      />
    </div>
  );
}
