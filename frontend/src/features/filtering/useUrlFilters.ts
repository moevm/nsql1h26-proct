import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterField } from "../../entities/types";
import { isoDateTimeToTimestamp, timestampToIsoDateTime } from "../../shared/lib/dateTime";
import { dateTimeFilterKeys, filterParamKeys } from "../../shared/lib/filterFields";

export function useUrlFilters(fields: FilterField[]) {
  const [params, setParams] = useSearchParams();
  const dateTimeKeys = useMemo(
    () => new Set(dateTimeFilterKeys(fields)),
    [fields],
  );
  const initial = useMemo(() => {
    const next = Object.fromEntries(params.entries());
    for (const key of dateTimeKeys) {
      if (next[key]) next[key] = timestampToIsoDateTime(next[key]);
    }
    return next;
  }, [dateTimeKeys, params]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    fields.flatMap(filterParamKeys).forEach((key) => next.delete(key));
    Object.entries(draft).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const nextValue = dateTimeKeys.has(key) ? isoDateTimeToTimestamp(trimmed) : trimmed;
      if (nextValue) next.set(key, nextValue);
    });
    next.set("page", "1");
    setParams(next);
  }

  function reset() {
    const next = new URLSearchParams(params);
    fields.flatMap(filterParamKeys).forEach((key) => next.delete(key));
    setDraft({});
    setParams(next);
  }

  return { params, draft, setDraft, submit, reset };
}
