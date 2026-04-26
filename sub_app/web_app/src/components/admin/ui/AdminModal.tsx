/** @jsxRuntime classic */
import React, { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  /** Backwards-compatible alias for `open` used by some callers */
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

export default function AdminModal({ open, isOpen, title, onClose, maxWidth = "lg", children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const visible = typeof isOpen === "boolean" ? isOpen : open;

  // fixed top padding: small viewport offset so modal body can scroll internally

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-3 overflow-y-auto"
      style={{ paddingTop: "4vh" }}
    >
      <div ref={panelRef} className={`w-full rounded-xl bg-white shadow-lg ${maxWidthClass[maxWidth]} flex flex-col max-h-[80vh]`} role="dialog" aria-modal="true">
        <div className="sticky top-0 z-10 p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-slate-100 p-4 bg-white">
            <div className="flex justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
