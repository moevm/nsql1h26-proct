import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterField } from "../../entities/types";

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeInputValue(value: string) {
  if (!/^-?\d+$/.test(value)) return value;

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toTimestampParam(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : String(timestamp);
}

export function useUrlFilters(fields: FilterField[]) {
  const [params, setParams] = useSearchParams();
  const dateTimeKeys = useMemo(
    () => new Set(fields.filter((field) => field.type === "dateTime").flatMap((field) => [`${field.key}From`, `${field.key}To`])),
    [fields],
  );
  const initial = useMemo(() => {
    const next = Object.fromEntries(params.entries());
    for (const key of dateTimeKeys) {
      if (next[key]) next[key] = toDateTimeInputValue(next[key]);
    }
    return next;
  }, [dateTimeKeys, params]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);

  function paramKeys(field: FilterField) {
    if (field.type === "dateRange" || field.type === "dateTime") return [`${field.key}From`, `${field.key}To`];
    if (field.type === "numberRange") return [`${field.key}Min`, `${field.key}Max`];
    return [field.key];
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    fields.flatMap(paramKeys).forEach((key) => next.delete(key));
    Object.entries(draft).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      next.set(key, dateTimeKeys.has(key) ? toTimestampParam(trimmed) : trimmed);
    });
    next.set("page", "1");
    setParams(next);
  }

  function reset() {
    const next = new URLSearchParams(params);
    fields.flatMap(paramKeys).forEach((key) => next.delete(key));
    setDraft({});
    setParams(next);
  }

  return { params, draft, setDraft, submit, reset };
}
