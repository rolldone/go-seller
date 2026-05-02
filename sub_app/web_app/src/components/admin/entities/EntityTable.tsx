/** @jsxRuntime classic */
import React, { type ReactNode } from "react";
import type { EntityColumn } from "./types";

type WithID = { id: string };

type Props<T extends WithID> = {
  items: T[];
  columns: EntityColumn<T>[];
  loading: boolean;
  error: string | null;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  renderExtraActions?: (item: T) => ReactNode;
};

export default function EntityTable<T extends WithID>({ items, columns, loading, error, onEdit, onDelete, renderExtraActions }: Props<T>) {
  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (items.length === 0) return <div className="text-sm text-slate-500">Belum ada data.</div>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-700">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2">
                {col.label}
              </th>
            ))}
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-slate-800">
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "-")}
                </td>
              ))}
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => onEdit(item)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                    Edit
                  </button>
                  <button type="button" onClick={() => onDelete(item)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
                    Delete
                  </button>
                  {renderExtraActions ? renderExtraActions(item) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
