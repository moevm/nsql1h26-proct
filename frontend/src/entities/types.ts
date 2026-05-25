import type { ReactNode } from "react";

export type AnyRecord = Record<string, unknown> & { _id?: string };

export type User = {
  _id: string;
  email: string;
  fullName: string;
  role: "admin" | "teacher";
};

export type FilterField = {
  key: string;
  label: string;
  type: "text" | "select" | "dateRange" | "numberRange" | "dateTime";
  options?: string[];
};

export type EntityConfig = {
  title: string;
  endpoint: string;
  createEndpoint?: string;
  detailTitleKey?: string;
  detailBackPath?: string;
  detailAdditionalNodes?: (record: AnyRecord) => ReactNode;
  detailEditable?: boolean;
  columns: { key: string; label: string }[];
  filters: FilterField[];
  createTemplate: AnyRecord;
};

export function valueByPath(record: AnyRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, record);
}

export function printable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.length > 4 ? `${value.length} элементов` : value.map(printable).join(", ");
  if (typeof value === "object") {
    const maybeDate = (value as { $date?: string }).$date;
    if (maybeDate) return new Date(maybeDate).toLocaleString("ru-RU");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return String(value);
}
