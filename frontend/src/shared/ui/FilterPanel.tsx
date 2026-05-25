import { FormEvent } from "react";
import { FilterField } from "../../entities/types";
import { dateTimeFilterKeys } from "../lib/filterFields";
import { isValidIsoDateTime } from "../lib/dateTime";
import { DateTimeIsoInput } from "./DateTimeIsoInput";

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
        {fields.map((field) => (
          <div className={`space-y-1.5 min-w-0 ${field.type === "dateTime" ? "md:col-span-2" : ""}`} key={field.key}>
            <label className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
              {field.label}
            </label>
            {field.type === "text" && <input className="w-full" value={draft[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} />}
            {field.type === "select" && (
              <select className="w-full h-[36px]" value={draft[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)}>
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
                <input type="date" value={draft[`${field.key}From`] ?? ""} onChange={(event) => setValue(`${field.key}From`, event.target.value)} aria-label={`${field.label} от`} />
                <input type="date" value={draft[`${field.key}To`] ?? ""} onChange={(event) => setValue(`${field.key}To`, event.target.value)} aria-label={`${field.label} до`} />
              </div>
            )}
            {field.type === "dateTime" && (
              <div className="grid grid-cols-2 gap-2">
                <DateTimeIsoInput label={`${field.label} от`} value={draft[`${field.key}From`] ?? ""} onUpdate={(value) => setValue(`${field.key}From`, value)} />
                <DateTimeIsoInput label={`${field.label} до`} value={draft[`${field.key}To`] ?? ""} onUpdate={(value) => setValue(`${field.key}To`, value)} />
              </div>
            )}
            {field.type === "numberRange" && (
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={draft[`${field.key}Min`] ?? ""} onChange={(event) => setValue(`${field.key}Min`, event.target.value)} placeholder="От" />
                <input type="number" value={draft[`${field.key}Max`] ?? ""} onChange={(event) => setValue(`${field.key}Max`, event.target.value)} placeholder="До" />
              </div>
            )}
          </div>
        ))}
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
