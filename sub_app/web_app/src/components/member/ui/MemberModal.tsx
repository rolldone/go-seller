/** @jsxRuntime classic */
import React, { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  isOpen?: boolean;
  title: string;
  onClose: () => void;
  maxWidth?: "md" | "lg" | "xl" | "2xl";
  children: ReactNode;
  footer?: ReactNode;
};

const maxWidthClass: Record<NonNullable<Props["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
  "2xl": "max-w-5xl",
};

export default function MemberModal({ open, isOpen, title, onClose, maxWidth = "lg", children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const visible = typeof isOpen === "boolean" ? isOpen : open;

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center"
      style={{ paddingTop: "4vh" }}
    >
      <div ref={panelRef} className={`flex max-h-[80vh] w-full flex-col rounded-xl bg-white shadow-lg ${maxWidthClass[maxWidth]}`} role="dialog" aria-modal="true">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white p-4">
            <div className="flex justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}