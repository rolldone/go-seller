import { useCallback, useEffect, useState } from "react";
import EntityDeleteModal from "../entities/EntityDeleteModal";
import { notifyError, notifySuccess } from "../../../lib/notification";
import DiscountsTable from "../discounts/DiscountsTable";
import { createDiscount, deleteDiscount, listDiscounts, updateDiscount } from "../discounts/api";
import DiscountFormModal, { discountToForm, emptyForm, formToPayload } from "../discounts/DiscountFormModal";
import type { FormState } from "../discounts/DiscountFormModal";
import type { Discount } from "../discounts/types";
import type { Product } from "./types";

type Props = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
};

const defaultLimit = 30;

export default function ProductDiscountsModal({ open, product, onClose }: Props) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadDiscounts = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listDiscounts({ q: "", product_id: product.id, page: 1, limit: defaultLimit });
      setDiscounts(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discounts");
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open && product) {
      setDiscounts([]);
      setError(null);
      setFormState((prev) => ({ ...prev, product_ids: product.id, selectedProductIDs: [product.id] }));
      setSelectedDiscount(null);
      loadDiscounts();
    }
  }, [open, product, loadDiscounts]);

  const handleOpenForm = () => {
    if (!product) return;
    setFormMode("create");
    setSelectedDiscount(null);
    setFormState({ ...emptyForm, product_ids: product.id, selectedProductIDs: [product.id] });
    setFormOpen(true);
  };

  const handleEdit = (discount: Discount) => {
    setFormMode("edit");
    setSelectedDiscount(discount);
    setFormState(discountToForm(discount));
    setFormOpen(true);
  };

  const handleFormChange = (patch: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const handleFormSubmit = async () => {
    if (!product) return;
    setFormSubmitting(true);
    try {
      const payload = formToPayload(formState);
      if (formMode === "create") {
        await createDiscount(payload);
        notifySuccess("Discount created");
      } else if (selectedDiscount) {
        await updateDiscount(selectedDiscount.id, payload);
        notifySuccess("Discount updated");
      }
      setFormOpen(false);
      await loadDiscounts();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to save discount");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = (discount: Discount) => {
    setSelectedDiscount(discount);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDiscount) return;
    setDeleteSubmitting(true);
    try {
      await deleteDiscount(selectedDiscount.id);
      notifySuccess("Discount deleted");
      setDeleteOpen(false);
      await loadDiscounts();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete discount");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 shadow-xl">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Discounts for {product.name}</h3>
            <p className="text-sm text-slate-600">Kelola promo yang hanya berlaku untuk product ini.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-mono text-xs text-slate-400">{product.id.slice(0, 8)}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <button
            type="button"
            onClick={handleOpenForm}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + New Discount
          </button>
          <div className="text-xs text-slate-500">Showing latest {defaultLimit} records</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            <DiscountsTable
              discounts={discounts}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>

      <DiscountFormModal
        open={formOpen}
        mode={formMode}
        form={formState}
        submitting={formSubmitting}
        onChange={handleFormChange}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        hideProductField
      />

      <EntityDeleteModal
        open={deleteOpen}
        title="Delete Discount"
        itemName={selectedDiscount?.name ?? ""}
        description={`Hapus discount "${selectedDiscount?.name ?? ""}"?`}
        submitting={deleteSubmitting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
