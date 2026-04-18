/** @jsxRuntime classic */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  /** Backwards-compatible alias for `open` */
  isOpen?: boolean;
  title?: ReactNode;
  onClose: () => void;
  maxWidth?: "md" | "lg" | "xl" | "full";
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdropClick?: boolean;
};

const maxWidthClass: Record<NonNullable<Props["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
  full: "max-w-full",
};

export default function PublicModal({
  open,
  isOpen,
  title,
  onClose,
  maxWidth = "lg",
  children,
  footer,
  closeOnBackdropClick = true,
}: Props) {
  const visible = typeof isOpen === "boolean" ? isOpen : open;

  const contentRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleIdRef = useRef<string>(`public-modal-title-${Math.random().toString(36).slice(2, 9)}`);

  const FOCUSABLE_SELECTORS =
    'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

  useEffect(() => {
    if (!visible || typeof document === "undefined") return;

    // preserve focus
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = typeof window !== "undefined" ? window.innerWidth - document.documentElement.clientWidth : 0;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // focus first focusable element inside modal
    setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter((f) => f.offsetParent !== null);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        el.focus();
      }
    }, 0);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight || "";
      document.removeEventListener("keydown", onKey);
      // restore focus
      try {
        previouslyFocusedRef.current?.focus();
      } catch {
        /* ignore */
      }
    };
  }, [visible, onClose]);

  if (!visible) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (closeOnBackdropClick) onClose();
        }}
      />
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`relative w-full rounded-2xl bg-white shadow-2xl flex flex-col ${maxWidthClass[maxWidth]} max-h-[80vh]`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const el = contentRef.current;
          if (!el) return;
          const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter((f) => f.offsetParent !== null);
          if (focusables.length === 0) {
            e.preventDefault();
            return;
          }
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleIdRef.current : undefined}
      >
        {title ? (
          <div className="sticky top-0 z-10 p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div id={titleIdRef.current} className="pr-4">
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="p-5 overflow-y-auto flex-1 min-h-0 text-sm leading-relaxed text-slate-700">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 z-10 border-t border-slate-100 p-4 bg-white">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
