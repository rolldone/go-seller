import type { PropsWithChildren } from "react";

interface FrontSectionProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function FrontSection({ title, subtitle, children, className = "" }: PropsWithChildren<FrontSectionProps>) {
  return (
    <section className={`mt-8 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
      )}

      <div>{children}</div>
    </section>
  );
}
