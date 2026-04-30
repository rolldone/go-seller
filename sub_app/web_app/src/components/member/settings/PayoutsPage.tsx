import React, { useState, useEffect } from "react";
import { memberGet, memberPost, memberPut, memberDelete } from "../businesses/api";

type Account = {
  id: string;
  bank: string;
  account_number: string;
  owner_name: string;
  is_verified?: boolean;
  is_primary?: boolean;
  business_id?: string | null;
};

type Business = { id: string; name?: string };

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  processed_at?: string;
};

const BANK_OPTIONS = ["BCA", "Mandiri", "BRI", "BNI", "Jago", "GoPay", "Other"];

export default function PayoutsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [bank, setBank] = useState(BANK_OPTIONS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState<number>(0);
  const [requestAccountId, setRequestAccountId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use member helpers which prefix requests with PUBLIC_API_URL

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const bsRes = await memberGet<{ data: Business[] }>("/api/member/businesses?page=1&limit=500");
      const bs = (bsRes && (bsRes as any).data) || bsRes || [];
      setBusinesses(bs || []);
      if ((bs || []).length > 0) setSelectedBusiness(bs[0].id);
      const firstBusinessId = (bs && bs.length > 0 && bs[0].id) || null;
      await fetchAccounts(firstBusinessId);
      await fetchPayouts(firstBusinessId);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async (businessId?: string | null) => {
    const bid = businessId ?? selectedBusiness;
    if (!bid) return setAccounts([]);
    try {
      const res = await memberGet<{ data: Account[] }>(`/api/member/businesses/${encodeURIComponent(bid)}/bank-accounts`);
      const data = (res && (res as any).data) || res || [];
      const normalized = (data || []).map((a: any) => ({
        id: a.id,
        bank: a.bank,
        account_number: a.account_number || a.accountNumber || "",
        owner_name: a.owner_name || a.ownerName || "",
        is_verified: !!(a.is_verified || a.verified),
        is_primary: !!a.is_primary,
        business_id: a.business_id || a.businessID || null,
      }));
      setAccounts(normalized);
      if (normalized.length && !requestAccountId) setRequestAccountId(normalized[0].id);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const fetchPayouts = async (businessId?: string | null) => {
    const bid = businessId ?? selectedBusiness;
    if (!bid) return setPayouts([]);
    try {
      const res = await memberGet<{ data: Payout[] }>(`/api/member/businesses/${encodeURIComponent(bid)}/payouts`);
      const data = (res && (res as any).data) || res || [];
      const normalized = (data || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount || p.amount || 0),
        currency: p.currency || "IDR",
        status: p.status,
        created_at: p.created_at || p.createdAt,
        processed_at: p.processed_at,
      }));
      setPayouts(normalized);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const addAccount = async () => {
    if (!accountNumber.trim() || !ownerName.trim() || !selectedBusiness) return;
    setLoading(true);
    try {
      await memberPost(`/api/member/businesses/${encodeURIComponent(selectedBusiness)}/bank-accounts`, {
        bank,
        account_number: accountNumber.trim(),
        owner_name: ownerName.trim(),
      });
      setAccountNumber("");
      setOwnerName("");
      setFormOpen(false);
      await fetchAccounts(selectedBusiness);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Hapus rekening ini?")) return;
    setLoading(true);
    try {
      const acct = accounts.find((a) => a.id === id);
      const bid = acct?.business_id || selectedBusiness;
      if (!bid) throw new Error("Business ID tidak diketahui");
      await memberDelete(`/api/member/businesses/${encodeURIComponent(bid)}/bank-accounts/${encodeURIComponent(id)}`);
      await fetchAccounts(bid);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const setPrimary = async (id: string) => {
    setLoading(true);
    try {
      const acct = accounts.find((a) => a.id === id);
      const bid = acct?.business_id || selectedBusiness;
      if (!bid) throw new Error("Business ID tidak diketahui");
      await memberPut(`/api/member/businesses/${encodeURIComponent(bid)}/bank-accounts/${encodeURIComponent(id)}`, { is_primary: true });
      await fetchAccounts(bid);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async () => {
    if (!requestAccountId || requestAmount <= 0) return;
    setLoading(true);
    try {
      const acct = accounts.find((a) => a.id === requestAccountId);
      const bid = acct?.business_id || selectedBusiness;
      if (!bid) throw new Error("Business ID tidak diketahui");
      await memberPost(`/api/member/businesses/${encodeURIComponent(bid)}/payouts`, { bank_account_id: requestAccountId, amount: requestAmount, currency: "IDR" });
      setRequestAmount(0);
      setRequestOpen(false);
      await fetchPayouts(bid);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when selected business changes
  useEffect(() => {
    if (!selectedBusiness) return;
    fetchAccounts(selectedBusiness);
    fetchPayouts(selectedBusiness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness]);

  const mask = (s: string) => s.replace(/.(?=.{4})/g, "*");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Penarikan Dana</h2>
          <p className="text-sm text-slate-500 mt-1">Daftarkan rekening bank untuk menerima pencairan dana.</p>
        </div>
        <div>
          <button
            className="inline-flex items-center gap-2 rounded bg-emerald-600 text-white px-3 py-1.5 text-sm"
            onClick={() => setFormOpen(!formOpen)}
          >
            {formOpen ? "Batal" : "Tambah Rekening"}
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-white border rounded shadow-sm">
        <p className="text-sm">Rekomendasi bank untuk proses instan: <strong>BCA, Mandiri, BRI, BNI, Jago, GoPay</strong></p>
        <p className="text-xs text-slate-500 mt-2">Ketentuan: Nama pemilik rekening harus sesuai data toko.</p>
      </div>

      {formOpen && (
        <div className="mb-6 p-4 bg-white border rounded shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600">Toko / Business</label>
              <select className="mt-1 block w-full rounded border px-3 py-2" value={selectedBusiness || ""} onChange={(e) => setSelectedBusiness(e.target.value)}>
                <option value="">Pilih toko</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Bank</label>
              <select className="mt-1 block w-full rounded border px-3 py-2" value={bank} onChange={(e) => setBank(e.target.value)}>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Nomor Rekening</label>
              <input className="mt-1 block w-full rounded border px-3 py-2" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Nama Pemilik</label>
              <input className="mt-1 block w-full rounded border px-3 py-2" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded px-4 py-2 border" onClick={() => { setFormOpen(false); setAccountNumber(""); setOwnerName(""); }}>Cancel</button>
            <button className="rounded bg-emerald-600 text-white px-4 py-2" onClick={addAccount} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded shadow-sm p-4 mb-6">
        <h3 className="text-sm font-semibold mb-4">Daftar Rekening</h3>
        <div className="space-y-3">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between border rounded px-4 py-3">
              <div>
                <div className="font-medium">{a.bank} <span className="text-sm text-slate-500">({mask(a.account_number)})</span></div>
                <div className="text-sm text-slate-600">{a.owner_name}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-sm px-2 py-1 rounded ${a.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {a.is_verified ? 'Verified' : 'Pending'}
                </div>
                <button className="text-sm text-slate-600" onClick={() => { setRequestOpen(true); setRequestAccountId(a.id); }}>Request Payout</button>
                {!a.is_primary && <button className="text-sm text-slate-600" onClick={() => setPrimary(a.id)}>Set Primary</button>}
                <button className="text-sm text-red-600" onClick={() => deleteAccount(a.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Request Payout</h3>
          <div>
            <button className="text-sm text-slate-600" onClick={() => setRequestOpen(!requestOpen)}>{requestOpen ? 'Batal' : 'Buat Request'}</button>
          </div>
        </div>
        {requestOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600">Pilih Rekening</label>
              <select className="mt-1 block w-full rounded border px-3 py-2" value={requestAccountId || ""} onChange={(e) => setRequestAccountId(e.target.value)}>
                <option value="">Pilih rekening</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.bank} ({mask(a.account_number)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Jumlah</label>
              <input type="number" className="mt-1 block w-full rounded border px-3 py-2" value={requestAmount || ''} onChange={(e) => setRequestAmount(Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <button className="rounded bg-emerald-600 text-white px-4 py-2" onClick={requestPayout} disabled={loading}>{loading ? 'Processing...' : 'Request'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-4">Riwayat Penarikan</h3>
        <div className="space-y-3">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded px-4 py-3">
              <div>
                <div className="font-medium">{p.currency} {p.amount.toLocaleString()}</div>
                <div className="text-sm text-slate-600">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className={`text-sm px-2 py-1 rounded ${p.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' : p.status === 'processing' ? 'bg-indigo-100 text-indigo-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {p.status}
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
    </div>
  );
}
