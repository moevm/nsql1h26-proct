import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterField } from "../../entities/types";

export function useUrlFilters(fields: FilterField[]) {
  const [params, setParams] = useSearchParams();
  const initial = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);

  function paramKeys(field: FilterField) {
    if (field.type === "dateRange") return [`${field.key}From`, `${field.key}To`];
    if (field.type === "numberRange") return [`${field.key}Min`, `${field.key}Max`];
    return [field.key];
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    fields.flatMap(paramKeys).forEach((key) => next.delete(key));
    Object.entries(draft).forEach(([key, value]) => {
      if (value.trim()) next.set(key, value.trim());
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
