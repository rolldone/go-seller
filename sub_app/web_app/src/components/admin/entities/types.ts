import type { ReactNode } from "react";

export type EntityField = {
  key: string;
  label: string;
  type: "text" | "number" | "checkbox" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  // when `type` is `select`, provide options as label/value pairs
  options?: { label: string; value: string }[];
};

export type EntityColumn<T> = {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
};

export type PaginatedResponse<T> = { data: T[]; total: number };

export type EntityAdapter<T> = {
  list: (page?: number, limit?: number) => Promise<PaginatedResponse<T>>;
  create: (payload: Record<string, unknown>) => Promise<T>;
  update: (id: string, payload: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<void>;
};

export type EntityRecordBase = {
  id: string;
  created_at?: string;
  updated_at?: string;
};
