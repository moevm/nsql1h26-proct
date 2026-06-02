import { FormEvent } from "react";
import type { FilterField } from "../../entities/types";
import { dateTimeFilterKeys } from "../lib/filterFields";
import { isValidIsoDateTime } from "../lib/dateTime";
import { FilterDateTimeRange, FilterFormField, FilterNumberRange } from "./FilterField";

type Props = {
  fields: FilterField[];
  draft: Record<string, string>;
  setDraft: (next: Record<string, string>) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
};

export function FilterPanel({ fields, draft, setDraft, onSubmit, onReset }: Props) {
  const setValue = (key: string, value: string) => setDraft({ ...draft, [key]: value });

  function submit(event: FormEvent) {
    const hasInvalidDateTime = dateTimeFilterKeys(fields).some((key) => !isValidIsoDateTime(draft[key] ?? ""));

    if (hasInvalidDateTime) {
      event.preventDefault();
      return;
    }

    onSubmit(event);
  }

  return (
    <form className="bg-card rounded-xl border border-border p-4 space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {fields.map((field) => {
          if (field.type === "dateTime") {
            return (
              <div className="md:col-span-2 min-w-0" key={field.key}>
                <FilterDateTimeRange
                  label={field.label}
                  from={draft[`${field.key}From`] ?? ""}
                  to={draft[`${field.key}To`] ?? ""}
                  onFromChange={(value) => setValue(`${field.key}From`, value)}
                  onToChange={(value) => setValue(`${field.key}To`, value)}
                />
              </div>
            );
          }

          if (field.type === "numberRange") {
            return (
              <FilterNumberRange
                key={field.key}
                label={field.label}
                from={draft[`${field.key}Min`] ?? ""}
                to={draft[`${field.key}Max`] ?? ""}
                onFromChange={(value) => setValue(`${field.key}Min`, value)}
                onToChange={(value) => setValue(`${field.key}Max`, value)}
              />
            );
          }

          return (
            <FilterFormField label={field.label} key={field.key} className={field.type === "dateRange" ? "md:col-span-2" : ""}>
              {field.type === "text" && (
                <input className="w-full h-10" value={draft[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} />
              )}
              {field.type === "select" && (
                <select className="w-full h-10" value={draft[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)}>
                  <option value="">Все</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              {field.type === "dateRange" && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="w-full h-10" value={draft[`${field.key}From`] ?? ""} onChange={(event) => setValue(`${field.key}From`, event.target.value)} aria-label={`${field.label}, от`} />
                  <input type="date" className="w-full h-10" value={draft[`${field.key}To`] ?? ""} onChange={(event) => setValue(`${field.key}To`, event.target.value)} aria-label={`${field.label}, до`} />
                </div>
              )}
            </FilterFormField>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button className="button" type="submit">
          Найти
        </button>
        <button className="button button_secondary" type="button" onClick={onReset}>
          Сбросить
        </button>
      </div>
    </form>
  );
}
