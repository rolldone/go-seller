interface ProductsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function ProductsPagination({ page, totalPages, onPageChange, className = "mt-6" }: ProductsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`${className} flex items-center justify-center gap-1.5 text-xs text-slate-500`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        &lt;
      </button>
      {Array.from({ length: totalPages }, (_, index) => {
        const targetPage = index + 1;
        const isActive = targetPage === page;
        return (
          <button
            key={targetPage}
            type="button"
            onClick={() => onPageChange(targetPage)}
            className={[
              "rounded-md px-3 py-1.5 transition",
              isActive ? "bg-emerald-600 font-semibold text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {targetPage}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Berikutnya
      </button>
    </div>
  );
}
