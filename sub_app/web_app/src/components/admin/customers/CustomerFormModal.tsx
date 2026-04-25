import { useEffect, useMemo, useState } from "react";
import AdminModal from "../ui/AdminModal";
import type { Customer, CustomerAddress, CustomerAddressInput } from "./types";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  setPrimaryCustomerAddress,
  updateCustomerAddress,
} from "./api";
import { notifyError, notifySuccess } from "../../../lib/notification";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const textareaClass =
  "min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

type AddressFormState = {
  label: string;
  receiver_name: string;
  phone_number: string;
  address_line_1: string;
  address_line_2: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  notes: string;
  is_primary: boolean;
};

const defaultAddressForm: AddressFormState = {
  label: "",
  receiver_name: "",
  phone_number: "",
  address_line_1: "",
  address_line_2: "",
  subdistrict: "",
  district: "",
  city: "",
  province: "",
  postal_code: "",
  country: "ID",
  notes: "",
  is_primary: false,
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: Record<string, unknown>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export default function CustomerFormModal({ open, mode, initialValues, submitting, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>(initialValues || {});
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState("");
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(defaultAddressForm);
  const [editingAddressID, setEditingAddressID] = useState<string>("");
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const customerID = useMemo(() => String(form.id ?? initialValues?.id ?? "").trim(), [form.id, initialValues]);

  useEffect(() => {
    if (!open) return;
    setForm(initialValues || {});
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || mode !== "edit" || !customerID) {
      setAddresses([]);
      setAddressesError("");
      setAddressFormOpen(false);
      setEditingAddressID("");
      setAddressForm(defaultAddressForm);
      return;
    }

    let cancelled = false;
    (async () => {
      setAddressesLoading(true);
      setAddressesError("");
      try {
        const rows = await listCustomerAddresses(customerID);
        if (!cancelled) setAddresses(rows);
      } catch (err) {
        if (!cancelled) {
          setAddresses([]);
          setAddressesError(err instanceof Error ? err.message : "Gagal memuat alamat");
        }
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, customerID]);

  const resetAddressForm = () => {
    setEditingAddressID("");
    setAddressForm(defaultAddressForm);
    setAddressFormOpen(false);
  };

  const openAddressForm = (address?: CustomerAddress) => {
    if (!customerID) return;
    if (address) {
      setEditingAddressID(address.id);
      setAddressForm({
        label: address.label || "",
        receiver_name: address.receiver_name || "",
        phone_number: address.phone_number || "",
        address_line_1: address.address_line_1 || "",
        address_line_2: address.address_line_2 || "",
        subdistrict: address.subdistrict || "",
        district: address.district || "",
        city: address.city || "",
        province: address.province || "",
        postal_code: address.postal_code || "",
        country: address.country || "ID",
        notes: address.notes || "",
        is_primary: address.is_primary,
      });
    } else {
      setEditingAddressID("");
      setAddressForm(defaultAddressForm);
    }
    setAddressFormOpen(true);
  };

  const toAddressInput = (): CustomerAddressInput => ({
    label: String(addressForm.label || ""),
    receiver_name: String(addressForm.receiver_name || "").trim(),
    phone_number: String(addressForm.phone_number || "").trim(),
    address_line_1: String(addressForm.address_line_1 || "").trim(),
    address_line_2: String(addressForm.address_line_2 || "").trim() || undefined,
    subdistrict: String(addressForm.subdistrict || "").trim() || undefined,
    district: String(addressForm.district || "").trim() || undefined,
    city: String(addressForm.city || "").trim(),
    province: String(addressForm.province || "").trim(),
    postal_code: String(addressForm.postal_code || "").trim(),
    country: String(addressForm.country || "ID").trim() || "ID",
    notes: String(addressForm.notes || "").trim() || undefined,
    is_primary: Boolean(addressForm.is_primary),
  });

  const reloadAddresses = async () => {
    if (!customerID) return;
    const rows = await listCustomerAddresses(customerID);
    setAddresses(rows);
  };

  const handleAddressSubmit = async () => {
    if (!customerID) {
      notifyError("Customer ID belum tersedia");
      return;
    }
    if (!addressForm.receiver_name.trim() || !addressForm.phone_number.trim() || !addressForm.address_line_1.trim() || !addressForm.city.trim() || !addressForm.province.trim() || !addressForm.postal_code.trim()) {
      notifyError("Field alamat utama wajib diisi");
      return;
    }

    setAddressSubmitting(true);
    try {
      const payload = toAddressInput();
      if (editingAddressID) {
        await updateCustomerAddress(customerID, editingAddressID, payload);
        notifySuccess("Alamat customer berhasil diperbarui");
      } else {
        await createCustomerAddress(customerID, payload);
        notifySuccess("Alamat customer berhasil ditambahkan");
      }
      await reloadAddresses();
      resetAddressForm();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan alamat customer");
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleSetPrimary = async (addressID: string) => {
    if (!customerID) return;
    setAddressSubmitting(true);
    try {
      await setPrimaryCustomerAddress(customerID, addressID);
      notifySuccess("Alamat utama diperbarui");
      await reloadAddresses();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menjadikan alamat utama");
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressID: string) => {
    if (!customerID) return;
    if (!window.confirm("Hapus alamat ini?")) return;
    setAddressSubmitting(true);
    try {
      await deleteCustomerAddress(customerID, addressID);
      notifySuccess("Alamat customer dihapus");
      await reloadAddresses();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menghapus alamat customer");
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.name || String(form.name).trim() === "") {
        notifyError("Name wajib diisi");
        return;
      }
      if (!form.email || String(form.email).trim() === "") {
        notifyError("Email wajib diisi");
        return;
      }
      await onSubmit(form);
    } catch (err) {
      // onSubmit will surface errors
      throw err;
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Customer" : "Edit Customer"}
      maxWidth="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Name</span>
            <input
              className={inputClass}
              value={String(form.name ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Email</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={String(form.email ?? "")}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@domain.com"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Locale</span>
            <select
              className={inputClass}
              value={String(form.locale ?? "id")}
              onChange={(e) => setForm((prev) => ({ ...prev, locale: e.target.value }))}
            >
              <option value="id">Indonesia (id)</option>
              <option value="en">English (en)</option>
            </select>
          </label>

          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Status: <strong>{String((form as Customer).is_active ?? true) === "true" ? "active" : "inactive"}</strong>
            </p>
          </div>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase text-slate-500">Phone</span>
          <input
            className={inputClass}
            value={String(form.phone ?? "")}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Optional phone"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase text-slate-500">Notes</span>
          <textarea
            className={textareaClass}
            value={String(form.notes ?? "")}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </label>

        {mode === "edit" && customerID ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Customer Addresses</h4>
                <p className="mt-1 text-xs text-slate-500">Kelola alamat pengiriman customer di sini. Order detail akan memilih address dari daftar ini.</p>
              </div>
              <button
                type="button"
                onClick={() => openAddressForm()}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                + Add Address
              </button>
            </div>

            {addressesError ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{addressesError}</div> : null}
            {addressesLoading ? <div className="mt-3 text-sm text-slate-500">Memuat alamat...</div> : null}
            {!addressesLoading && addresses.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">Belum ada alamat customer.</div>
            ) : null}

            <div className="mt-3 space-y-2">
              {addresses.map((address) => (
                <div key={address.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{address.label || "Alamat"}</p>
                        {address.is_primary ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Utama</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{address.receiver_name} · {address.phone_number}</p>
                      <p className="mt-1 text-xs text-slate-500">{[address.address_line_1, address.address_line_2, address.subdistrict, address.district, address.city, address.province, address.postal_code].filter(Boolean).join(", ")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!address.is_primary ? (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(address.id)}
                          disabled={addressSubmitting}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          Set Primary
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openAddressForm(address)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(address.id)}
                        disabled={addressSubmitting}
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {addressFormOpen ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-slate-900">{editingAddressID ? "Edit Address" : "Add Address"}</h5>
                  <button type="button" onClick={resetAddressForm} className="text-xs font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Label</span>
                    <input className={inputClass} value={addressForm.label} onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Rumah / Kantor" />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Receiver Name</span>
                    <input className={inputClass} value={addressForm.receiver_name} onChange={(e) => setAddressForm((prev) => ({ ...prev, receiver_name: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Phone</span>
                    <input className={inputClass} value={addressForm.phone_number} onChange={(e) => setAddressForm((prev) => ({ ...prev, phone_number: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Country</span>
                    <input className={inputClass} value={addressForm.country} onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))} placeholder="ID" />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="text-xs uppercase text-slate-500">Address Line 1</span>
                    <textarea className={textareaClass} value={addressForm.address_line_1} onChange={(e) => setAddressForm((prev) => ({ ...prev, address_line_1: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="text-xs uppercase text-slate-500">Address Line 2</span>
                    <input className={inputClass} value={addressForm.address_line_2} onChange={(e) => setAddressForm((prev) => ({ ...prev, address_line_2: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Subdistrict</span>
                    <input className={inputClass} value={addressForm.subdistrict} onChange={(e) => setAddressForm((prev) => ({ ...prev, subdistrict: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">District</span>
                    <input className={inputClass} value={addressForm.district} onChange={(e) => setAddressForm((prev) => ({ ...prev, district: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">City</span>
                    <input className={inputClass} value={addressForm.city} onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Province</span>
                    <input className={inputClass} value={addressForm.province} onChange={(e) => setAddressForm((prev) => ({ ...prev, province: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs uppercase text-slate-500">Postal Code</span>
                    <input className={inputClass} value={addressForm.postal_code} onChange={(e) => setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="text-xs uppercase text-slate-500">Notes</span>
                    <textarea className={textareaClass} value={addressForm.notes} onChange={(e) => setAddressForm((prev) => ({ ...prev, notes: e.target.value }))} />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={addressForm.is_primary} onChange={(e) => setAddressForm((prev) => ({ ...prev, is_primary: e.target.checked }))} />
                    <span className="text-slate-700">Set as primary address</span>
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddressSubmit}
                    disabled={addressSubmitting}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                  >
                    {addressSubmitting ? "Saving..." : editingAddressID ? "Update Address" : "Create Address"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminModal>
  );
}
