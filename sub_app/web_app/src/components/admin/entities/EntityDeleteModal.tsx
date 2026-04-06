type Props = {
  open: boolean;
  title: string;
  itemName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function EntityDeleteModal({ open, title, itemName, submitting, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h3 className="text-base font-semibold text-slate-900">Delete {title}</h3>
        <p className="mt-2 text-sm text-slate-600">
          Hapus <span className="font-medium text-slate-900">{itemName}</span>?
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
          >
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
