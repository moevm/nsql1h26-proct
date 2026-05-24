import type { Document } from "mongodb";

export function makeCsv(rows: Document[]) {
  if (!rows.length) return "\uFEFFempty\n";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const raw = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return `"${raw.replaceAll('"', '""')}"`;
  };
  return `\uFEFF${[headers.join(";"), ...rows.map((row) => headers.map((header) => escape(row[header])).join(";"))].join("\n")}`;
}
