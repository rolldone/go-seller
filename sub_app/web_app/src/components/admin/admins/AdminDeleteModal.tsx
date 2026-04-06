import AdminModal from "../ui/AdminModal";
import type { Admin } from "./types";

type Props = {
  open: boolean;
  item: Admin | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function AdminDeleteModal({ open, item, submitting, onClose, onConfirm }: Props) {
  if (!item) return null;

  return (
    <AdminModal
      open={open}
      title="Delete Admin"
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
          >
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Hapus admin <span className="font-medium text-slate-900">{item.username}</span>?
      </p>
    </AdminModal>
  );
}
