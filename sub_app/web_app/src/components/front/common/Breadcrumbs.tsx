import React from "react";
import { buildLocalizedPath } from "../../../lib/siteLocale";

type Crumb = { id?: string; name?: string | null; slug?: string | null };

interface BreadcrumbsProps {
  ancestors?: Crumb[];
  locale?: string;
  rootLabel?: string;
}

export default function Breadcrumbs({ ancestors = [], locale = "id", rootLabel }: BreadcrumbsProps) {
  const isEnglish = locale === "en";
  const rootText = rootLabel ?? (isEnglish ? "Categories" : "Kategori");
  const rootHref = buildLocalizedPath("/categories", locale);

  return (
    <nav aria-label="breadcrumb" className="text-sm text-slate-600">
      <ol className="flex items-center gap-2">
        <li>
          <a href={rootHref} className="text-slate-500">{rootText}</a>
        </li>
        {ancestors.map((crumb, i) => {
          const isLast = i === ancestors.length - 1;
          const name = String(crumb.name || "");
          const slug = String(crumb.slug || "");
          return (
            <li key={String(crumb.id || `${i}-${slug}`)} className="flex items-center gap-2">
              <span className="text-slate-400">›</span>
              {isLast ? (
                <span aria-current="page" className="text-slate-900">{name}</span>
              ) : (
                <a href={buildLocalizedPath(`/categories/${encodeURIComponent(slug)}`, locale)} className="text-slate-500">{name}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
