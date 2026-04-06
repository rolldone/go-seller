import type { PropsWithChildren, ReactNode } from "react";

interface SectionGroupProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}

const defaultContentClassName =
  "rounded-2xl border border-slate-200 bg-white p-5 md:p-6";

export default function SectionGroup({
  title,
  subtitle,
  action,
  className = "",
  contentClassName = defaultContentClassName,
  children,
}: PropsWithChildren<SectionGroupProps>) {
  return (
    <section className={`mt-8 ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="pt-1">{action}</div>}
        </div>
      )}

      <div className={contentClassName}>{children}</div>
    </section>
  );
}
